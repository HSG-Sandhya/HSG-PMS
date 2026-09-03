// The front desk decides WHAT is sold. The server decides what it COSTS.
//
// createBooking used to read totalAmount, baseAmount and gstAmount out of the
// request body, check only that the total exceeded zero, and spread the whole
// body into the document. Any account allowed to create a booking could create
// a one-rupee one, or a fully-settled one, by posting its preferred numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Settings from '../models/Settings.js';
import { createBooking, updateBooking } from '../controllers/bookingController.js';
import { quoteDeskStay } from '../services/bookingPricing.js';
import { resetSequenceCache } from '../services/sequence.js';
import { invalidateOperationalConfig } from '../config/operationalConfig.js';

const ready = await startDb();

const RATE = 2000;
const CHECK_IN = '2027-05-10';
const CHECK_OUT = '2027-05-13';   // 3 nights
const NIGHTS = 3;

const call = async (body) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await createBooking({ body, params: {}, query: {}, user: { _id: new mongoose.Types.ObjectId() } }, res);
  return res;
};

const put = async (id, body) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await updateBooking({ params: { id: String(id) }, body, query: {}, user: { _id: new mongoose.Types.ObjectId() } }, res);
  return res;
};

const seedRoom = () => Room.create({
  roomNumber: '101', type: 'Deluxe', pricePerNight: RATE,
  status: 'available', capacity: { adults: 2, children: 1 },
});

const booking = (roomId, extra = {}) => ({
  guestName: 'Desk Guest', phone: '9000000001', roomId: String(roomId),
  checkIn: CHECK_IN, checkOut: CHECK_OUT, bookingStatus: 'Confirmed', ...extra,
});

test('front-desk pricing', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => {
    silenceOutbound(); await clearDb(); resetSequenceCache(); invalidateOperationalConfig();
  });

  await t.test('a one-rupee booking is priced properly instead', async () => {
    const room = await seedRoom();

    const res = await call(booking(room._id, { totalAmount: 1, baseAmount: 1, gstAmount: 0 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.baseAmount, RATE * NIGHTS, 'the client set the base');
    assert.equal(stored.gstAmount, RATE * NIGHTS * 0.05, 'the client set the GST');
    assert.equal(stored.totalAmount, RATE * NIGHTS * 1.05, 'the client set the total');
    assert.notEqual(stored.totalAmount, 1);
  });

  await t.test('a booking cannot be posted as already paid', async () => {
    const room = await seedRoom();

    // The other half of the same trick: claim the money is already in.
    const res = await call(booking(room._id, {
      totalAmount: 1, paidAmount: 1, remainingAmount: 0, paymentStatus: 'Paid',
    }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.paidAmount, 1, 'a genuine 1-rupee advance is still recorded');
    assert.equal(stored.remainingAmount, RATE * NIGHTS * 1.05 - 1, 'the balance must reflect the real bill');
    assert.equal(stored.paymentStatus, 'Partial', 'the booking was accepted as settled');
  });

  await t.test('an advance larger than the bill is clamped, not banked', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { paidAmount: 999999 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.paidAmount, RATE * NIGHTS * 1.05);
    assert.equal(stored.remainingAmount, 0);
    assert.equal(stored.paymentStatus, 'Paid');
  });

  await t.test('the invoice number cannot be chosen by the caller', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { invoiceNumber: 'HSG-000000-XX-0001' }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.notEqual(stored.invoiceNumber, 'HSG-000000-XX-0001', 'the caller picked its own invoice number');
    assert.match(stored.invoiceNumber, /^[A-Z]+-\d{6}-DG-\d{4}$/);
  });

  // ── The nuance: negotiated rates are legitimate ───────────────────────────
  await t.test('a bargained tariff is honoured, and priced from', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { roomRate: 1500 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.roomRate, 1500);
    assert.equal(stored.baseAmount, 1500 * NIGHTS);
    assert.equal(stored.totalAmount, 1500 * NIGHTS * 1.05);
  });

  await t.test('a complimentary stay is allowed — zero is a rate, not a missing one', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { roomRate: 0 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.baseAmount, 0);
    assert.equal(stored.totalAmount, 0);
    assert.equal(stored.paymentStatus, 'Pending');
  });

  await t.test('a negative rate falls back to the published tariff', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { roomRate: -5000 }));
    assert.equal(res.statusCode, 201, res.body?.message);
    assert.equal((await Booking.findOne().lean()).baseAmount, RATE * NIGHTS);
  });

  await t.test('a discount is a percentage, and GST is charged before it', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { discount: 10 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const base = RATE * NIGHTS;
    const stored = await Booking.findOne().lean();
    assert.equal(stored.discountAmount, base * 0.10);
    assert.equal(stored.gstAmount, base * 0.05, 'the discount must not reduce the tax');
    assert.equal(stored.totalAmount, base + base * 0.05 - base * 0.10);
  });

  await t.test('a discount past the configured ceiling is clamped', async () => {
    await Settings.create({ hotelName: 'Test Hotel', billing: { maxDiscountPercent: 20, roomGstRate: 5 } });
    invalidateOperationalConfig();
    const room = await seedRoom();

    const res = await call(booking(room._id, { discount: 100 }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.discount, 20, 'the ceiling was ignored');
    assert.equal(stored.discountAmount, RATE * NIGHTS * 0.20);
  });

  await t.test('a breakfast tariff is added, and now actually recorded', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, { tariffType: 'breakfast' }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const base = RATE * NIGHTS;
    const breakfast = 200 * NIGHTS;      // breakfastChargePerNight default
    const stored = await Booking.findOne().lean();
    assert.equal(stored.breakfastAmount, breakfast, 'breakfastAmount was dropped by the schema again');
    assert.equal(stored.tariffType, 'breakfast', 'tariffType was dropped by the schema again');
    assert.equal(stored.gstAmount, (base + breakfast) * 0.05);
    assert.equal(stored.totalAmount, base + breakfast + (base + breakfast) * 0.05);
  });

  await t.test('extraChargesTotal is recomputed from its own components', async () => {
    const room = await seedRoom();
    const res = await call(booking(room._id, {
      extraCharges: { extraBed: 500, laundry: 250 },
      extraChargesTotal: 999999,
    }));
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Booking.findOne().lean();
    assert.equal(stored.extraChargesTotal, 750, 'the caller asserted its own extras total');
    // Extras are settled at checkout, so they stay out of the booking total —
    // matching what the desk screen shows.
    assert.equal(stored.totalAmount, RATE * NIGHTS * 1.05);
  });

  await t.test('a nonexistent room is a 400, not a 500', async () => {
    await seedRoom();
    const res = await call(booking(new mongoose.Types.ObjectId()));
    assert.equal(res.statusCode, 404);
  });

  // ── Editing is the same door ──────────────────────────────────────────────
  // Fixing createBooking alone fixed nothing: a correctly-priced booking could
  // be rewritten with a PUT.
  await t.test('an edit cannot rewrite the money', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const before = await Booking.findOne().lean();
    assert.equal(before.totalAmount, RATE * NIGHTS * 1.05);

    const res = await put(before._id, {
      totalAmount: 1, baseAmount: 1, gstAmount: 0, paidAmount: 1, paymentStatus: 'Paid',
    });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.totalAmount, before.totalAmount, 'the caller rewrote the total');
    assert.equal(after.paidAmount, 1, 'a genuine 1-rupee payment is still recorded');
    assert.equal(after.paymentStatus, 'Partial', 'the booking was marked settled without the money');
    assert.equal(after.remainingAmount, before.totalAmount - 1);
  });

  await t.test('an edit that changes nothing priceable leaves the money alone', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const before = await Booking.findOne().lean();

    const res = await put(before._id, { bookingStatus: 'Confirmed', specialRequests: 'high floor' });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.totalAmount, before.totalAmount);
    assert.equal(after.baseAmount, before.baseAmount);
    assert.equal(after.gstAmount, before.gstAmount);
  });

  await t.test('extending the stay re-prices it', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const before = await Booking.findOne().lean();

    const res = await put(before._id, { checkOut: '2027-05-15' });   // 3 -> 5 nights
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.baseAmount, RATE * 5);
    assert.equal(after.totalAmount, RATE * 5 * 1.05);
  });

  await t.test('a rate bargained at the edit is honoured and priced from', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const before = await Booking.findOne().lean();

    const res = await put(before._id, { roomRate: 1200 });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.roomRate, 1200);
    assert.equal(after.baseAmount, 1200 * NIGHTS);
    assert.equal(after.totalAmount, 1200 * NIGHTS * 1.05);
  });

  await t.test('a booking predating roomRate is not zeroed out when re-priced', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const created = await Booking.findOne().lean();
    // Every booking written before the desk recorded a rate has roomRate: 0.
    await Booking.updateOne({ _id: created._id }, { $set: { roomRate: 0 } });

    const res = await put(created._id, { checkOut: '2027-05-14' });   // 4 nights
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.baseAmount, RATE * 4, 'a stored rate of 0 was read as a complimentary tariff');
    assert.equal(after.totalAmount, RATE * 4 * 1.05);
  });

  // ── Checkout ──────────────────────────────────────────────────────────────
  await t.test('checkout settles on the nights actually stayed, with the late fee on top', async () => {
    const room = await seedRoom();
    await call(booking(room._id, { checkedIn: true }));   // walk-in, in house
    const created = await Booking.findOne().lean();

    // Guest leaves a night early, and pays a late-checkout charge on the last day.
    const res = await put(created._id, {
      bookingStatus: 'Completed',
      actualNights: 2,
      lateCheckoutFee: 500,
      checkOut: '2027-05-12',
      paidAmount: 2 * RATE * 1.05 + 500,
    });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    const roomBase = RATE * 2;
    assert.equal(after.baseAmount, roomBase, 'the stay was not re-priced to the nights stayed');
    assert.equal(after.gstAmount, roomBase * 0.05, 'the late fee must not be taxed as room nights');
    assert.equal(after.lateCheckoutFee, 500, 'the fee is its own invoice line');
    assert.equal(after.totalAmount, roomBase * 1.05 + 500, 'the guest must be billed the fee');
    assert.equal(after.remainingAmount, 0);
    assert.equal(after.paymentStatus, 'Paid');
  });

  await t.test('a late fee is never counted twice', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const created = await Booking.findOne().lean();

    await put(created._id, { actualNights: 3, lateCheckoutFee: 500 });
    const once = (await Booking.findOne().lean()).totalAmount;
    // A second edit that names no new fee must not add it again.
    await put(created._id, { specialRequests: 'late departure' });
    const twice = (await Booking.findOne().lean()).totalAmount;

    assert.equal(once, RATE * NIGHTS * 1.05 + 500);
    assert.equal(twice, once, 'the late fee was applied a second time');
  });

  await t.test('an overpayment covering restaurant charges is not clamped away', async () => {
    const room = await seedRoom();
    await call(booking(room._id, { checkedIn: true }));   // walk-in, in house
    const created = await Booking.findOne().lean();

    // Paid = room bill + a food bill settled on the same invoice.
    const paid = RATE * NIGHTS * 1.05 + 1200;
    const res = await put(created._id, { bookingStatus: 'Completed', paidAmount: paid });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findOne().lean();
    assert.equal(after.paidAmount, paid, 'money actually collected was discarded');
    assert.equal(after.remainingAmount, 0);
    assert.equal(after.paymentStatus, 'Paid');
  });

  await t.test('a refund status is preserved, not derived away', async () => {
    const room = await seedRoom();
    await call(booking(room._id));
    const created = await Booking.findOne().lean();

    const res = await put(created._id, { paymentStatus: 'Refunded', paidAmount: 0 });
    assert.equal(res.statusCode, 200, res.body?.message);
    assert.equal((await Booking.findOne().lean()).paymentStatus, 'Refunded');
  });

  // ── The desk screen and the server must agree, figure for figure ──────────
  // client/src/pages/operations/Bookings.js computes:
  //   base      = pricePerNight * nights
  //   breakfast = tariffType === 'breakfast' ? breakfastChargePerNight * nights : 0
  //   gst       = (base + breakfast) * roomGstRate/100      <- pre-discount
  //   discount  = base * pct/100                            <- room base only
  //   total     = base + breakfast + gst - discount
  await t.test('the quote matches the arithmetic the clerk is shown', async () => {
    const room = await seedRoom();
    const billing = { roomGstRate: 5, breakfastChargePerNight: 200, maxDiscountPercent: 100 };

    for (const [rate, tariff, pct] of [
      [2000, '', 0], [2000, 'breakfast', 0], [2000, '', 15],
      [2000, 'breakfast', 25], [1500, 'breakfast', 10], [0, '', 0],
    ]) {
      const q = await quoteDeskStay({
        roomId: room._id, checkIn: CHECK_IN, checkOut: CHECK_OUT,
        roomRate: rate, tariffType: tariff, discountPercent: pct,
      });

      const base = rate * NIGHTS;
      const breakfast = tariff === 'breakfast' ? billing.breakfastChargePerNight * NIGHTS : 0;
      const gst = (base + breakfast) * (billing.roomGstRate / 100);
      const disc = base * (pct / 100);

      assert.equal(q.baseAmount, base, `base mismatch for ${rate}/${tariff}/${pct}`);
      assert.equal(q.breakfastAmount, breakfast, `breakfast mismatch for ${rate}/${tariff}/${pct}`);
      assert.equal(q.gstAmount, gst, `gst mismatch for ${rate}/${tariff}/${pct}`);
      assert.equal(q.discountAmount, disc, `discount mismatch for ${rate}/${tariff}/${pct}`);
      assert.equal(q.totalAmount, base + breakfast + gst - disc, `total mismatch for ${rate}/${tariff}/${pct}`);
    }
  });
});
