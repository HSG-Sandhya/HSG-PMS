import Room from '../models/Room.js';
import { getBilling, roomGst } from '../config/operationalConfig.js';
import { roundMoney } from '../utils/money.js';
import { calculateNights } from '../utils/dateHelpers.js';

/**
 * The single source of truth for what a stay COSTS.
 *
 * /api/website/bookings is public, and it used to persist the money straight
 * from the request body:
 *
 *     totalAmount: bookingData.totalAmount || 0,
 *     baseAmount:  bookingData.baseAmount  || 0,
 *     gstAmount:   bookingData.gstAmount   || 0,
 *
 * So a crafted request could book a week in the best room and record a total of
 * ₹1. The online-payment guard looked like it caught this -- it compared the
 * captured payment against the booking total -- but the caller supplied that
 * total too, so it only ever confirmed that the guest had paid what they
 * themselves had claimed. Both sides of the comparison were attacker-controlled.
 *
 * Now the browser sends only WHICH category and WHICH dates. The tariff, the
 * nights, the GST and the total are derived here, and the same quote is used
 * three times: to show the guest a price, to create the payment order, and to
 * write the booking. One calculation, so the three cannot drift.
 */

/** A quoting error the caller should surface as a 400. */
export class BookingPricingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BookingPricingError';
    this.status = 400;
  }
}

/** Whole nights between two dates, minimum one (a day-use stay still bills a night). */
export const nightsBetween = (checkIn, checkOut) => {
  const from = new Date(checkIn);
  const to = new Date(checkOut);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BookingPricingError('Valid check-in and check-out dates are required');
  }
  if (to <= from) {
    throw new BookingPricingError('Check-out must be after check-in');
  }
  return Math.max(1, Math.ceil((to - from) / 86_400_000));
};

/**
 * The nightly tariff for a category.
 *
 * Mirrors what the storefront shows a guest browsing: the cheapest room in the
 * category. Preference goes to rooms that are currently available, which is the
 * set the site builds its category list from; if the whole category is occupied
 * we still quote from the category rather than refusing, because availability
 * for the requested DATES is a separate question that canReserve() answers.
 */
const tariffForType = async (roomType) => {
  const rooms = await Room.find({ type: roomType }).select('pricePerNight status');
  if (!rooms.length) {
    throw new BookingPricingError(`"${roomType}" is not a room category we offer`);
  }
  const priceOf = (r) => Number(r.pricePerNight) || 0;
  const available = rooms.filter((r) => r.status === 'available' && priceOf(r) > 0);
  const pool = available.length ? available : rooms.filter((r) => priceOf(r) > 0);
  if (!pool.length) {
    throw new BookingPricingError(`"${roomType}" has no published tariff. Please contact the hotel.`);
  }
  return Math.min(...pool.map(priceOf));
};

/**
 * Price a stay. Accepts either a specific `roomId` or a `roomType` category.
 *
 * Returns every figure the booking record needs, so callers never compute money
 * of their own:
 *   { roomType, nights, roomCount, ratePerNight, baseAmount, gstAmount,
 *     totalAmount, gstRate }
 */
export const quoteStay = async ({ roomId, roomType, checkIn, checkOut, roomCount = 1 } = {}) => {
  const nights = nightsBetween(checkIn, checkOut);

  const count = Math.max(1, Math.floor(Number(roomCount) || 1));
  if (count > 50) {
    throw new BookingPricingError('A single booking cannot hold more than 50 rooms');
  }

  let ratePerNight;
  let resolvedType = roomType;
  if (roomId) {
    const room = await Room.findById(roomId).select('type pricePerNight');
    if (!room) throw new BookingPricingError('That room does not exist');
    ratePerNight = Number(room.pricePerNight) || 0;
    resolvedType = room.type;
    if (ratePerNight <= 0) {
      throw new BookingPricingError('That room has no published tariff. Please contact the hotel.');
    }
  } else if (roomType) {
    ratePerNight = await tariffForType(roomType);
  } else {
    throw new BookingPricingError('A room category is required');
  }

  const billing = await getBilling();
  const baseAmount = roundMoney(ratePerNight * nights * count);
  const gstAmount = roundMoney(roomGst(baseAmount, billing));

  return {
    roomType: resolvedType,
    nights,
    roomCount: count,
    ratePerNight: roundMoney(ratePerNight),
    baseAmount,
    gstAmount,
    totalAmount: roundMoney(baseAmount + gstAmount),
    gstRate: billing.roomGstRate,
  };
};

/**
 * Price a stay booked at the FRONT DESK.
 *
 * createBooking used to take totalAmount, baseAmount and gstAmount straight from
 * the request body and check only that the total was above zero, then spread the
 * whole body into `new Booking(...)`. So any account that could create a booking
 * could also create a one-rupee one -- or a fully-paid one -- by posting the
 * numbers it preferred. The public site had already been fixed; the desk had not.
 *
 * The desk is not the website, though, and the difference is deliberate: a
 * bargained tariff is a normal thing at a hotel counter. So the inputs it may
 * choose are the ones a clerk legitimately decides -- which room, which dates,
 * a negotiated nightly rate, a discount percentage, whether breakfast is
 * included -- and every RUPEE figure is derived here from those.
 *
 * The arithmetic deliberately mirrors, step for step, what the admin screen
 * shows the clerk while they fill the form (client/src/pages/operations/
 * Bookings.js). If the two disagreed, the desk would quote one price and the
 * invoice would carry another, which is worse than the hole being closed is
 * good. In particular:
 *
 *   - GST is charged on the PRE-discount subtotal, so a discount never reduces
 *     the tax.
 *   - The discount is a percentage off the ROOM base only -- not breakfast,
 *     not GST.
 *   - Extra charges and late-checkout fees are NOT part of a new booking's
 *     total. They are posted to the folio during the stay and settled at
 *     checkout, which is how the screen treats them too.
 *
 * @returns every rupee figure the booking record needs.
 */
export const quoteDeskStay = async ({
  roomId,
  checkIn,
  checkOut,
  roomRate,
  tariffType = '',
  discountPercent = 0,
} = {}) => {
  const room = await Room.findById(roomId).select('type pricePerNight');
  if (!room) throw new BookingPricingError('That room does not exist');

  // Calendar nights, matching the desk screen and the rest of the controller.
  // nightsBetween() ceils elapsed milliseconds, which is right for the website's
  // date-only input but would disagree here the moment a time is attached.
  const nights = calculateNights(checkIn, checkOut);
  const billing = await getBilling();

  // A negotiated tariff is the clerk's to set, INCLUDING zero for a
  // complimentary stay -- so this tests for a usable number, not truthiness.
  // Anything absent, negative or unparseable falls back to the published rate.
  const negotiated = Number(roomRate);
  const usesNegotiated = roomRate !== undefined && roomRate !== null && roomRate !== ''
    && Number.isFinite(negotiated) && negotiated >= 0;
  const ratePerNight = usesNegotiated ? negotiated : (Number(room.pricePerNight) || 0);

  const baseAmount = roundMoney(ratePerNight * nights);
  const breakfastAmount = tariffType === 'breakfast'
    ? roundMoney((Number(billing.breakfastChargePerNight) || 0) * nights)
    : 0;

  const subtotal = roundMoney(baseAmount + breakfastAmount);
  const gstAmount = roundMoney(roomGst(subtotal, billing));

  // Clamped to the configured ceiling, so a request cannot discount past what
  // the hotel allows however the screen is bypassed.
  const maxPct = Number(billing.maxDiscountPercent);
  const pct = Math.min(
    Number.isFinite(maxPct) ? maxPct : 100,
    Math.max(0, Number(discountPercent) || 0),
  );
  const discountAmount = roundMoney(baseAmount * (pct / 100));

  return {
    roomType: room.type,
    nights,
    ratePerNight: roundMoney(ratePerNight),
    negotiated: usesNegotiated,
    tariffType,
    baseAmount,
    breakfastAmount,
    gstAmount,
    discountPercent: pct,
    discountAmount,
    totalAmount: roundMoney(subtotal + gstAmount - discountAmount),
    gstRate: billing.roomGstRate,
  };
};

export default quoteStay;
