import {
  getWebsiteContent,
  publicAmenities,
  publicServices,
  publicGallery,
  publicOffers,
  publicHotelInfo,
} from '../services/websiteContent.js';
import ContactEnquiry from '../models/ContactEnquiry.js';
import { sendEmail } from '../services/notificationService.js';
import { publicRoomView, storefrontRoomView, PUBLIC_ROOM_FIELDS } from '../services/publicRoom.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Guest from '../models/Guest.js';
import Settings from '../models/Settings.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import BanquetHall from '../models/BanquetHall.js';
import BanquetBooking from '../models/BanquetBooking.js';
import paymentService from '../services/paymentService.js';
import { sendBookingNotification } from '../services/notificationService.js';
import { syncRoomBookingIncome } from '../services/accountingSync.js';
import { emitNewWebsiteBooking } from '../config/socket.js';
import { getBilling } from '../config/operationalConfig.js';
import { priceOrder, OrderPricingError } from '../services/orderPricing.js';
import { quoteStay, BookingPricingError } from '../services/bookingPricing.js';
import { secretsMatch } from '../utils/secretCompare.js';
import { findSlotConflict, findSlotConflicts, describeSlotConflict } from './banquetController.js';
import { nextSequence } from '../services/sequence.js';
import { getInventorySnapshot, availabilityByType, availabilityConflict } from '../services/inventory.js';
import { withInventoryLock, InventoryBusyError } from '../services/inventoryLock.js';
import { nextCustomerId } from '../services/bookingIds.js';

// ── Public restaurant ─────────────────────────────────────────────────────────

export const getPublicMenu = async (_req, res) => {
  try {
    const menuItems = await MenuItem.find({ isAvailable: true })
      .populate('category')
      .sort({ name: 1 });
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Error fetching menu items' });
  }
};

export const getPublicCategories = async (_req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      displayOrder: 1,
      name: 1,
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

// ── Banquet halls ─────────────────────────────────────────────────────────────

export const getBanquetHalls = async (_req, res) => {
  try {
    const halls = await BanquetHall.find({ isAvailable: true }).sort({ name: 1 });
    res.json(halls);
  } catch (error) {
    console.error('Error fetching banquet halls:', error);
    res.status(500).json({ message: 'Error fetching banquet halls' });
  }
};

export const getBanquetHallById = async (req, res) => {
  try {
    const hall = await BanquetHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ message: 'Banquet hall not found' });
    res.json(hall);
  } catch (error) {
    console.error('Error fetching banquet hall:', error);
    res.status(500).json({ message: 'Error fetching banquet hall' });
  }
};

export const createBanquetBooking = async (req, res) => {
  try {
    const { hallId, eventDate, eventType, guestName, guestEmail, guestPhone, guestCount, setupType, notes } = req.body;

    if (!hallId || !eventDate || !guestName || !guestPhone || !guestCount) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const hall = await BanquetHall.findById(hallId);
    if (!hall) return res.status(404).json({ message: 'Banquet hall not found' });

    const eventDuration = 5;
    const startTime = '10:00 AM';
    const endTime = '03:00 PM';

    // The public flow never checked whether the hall was already taken, so two
    // visitors could reserve the same hall on the same day. The reception path
    // has always enforced this via findSlotConflict; it now understands halls as
    // well as floors, so both paths ask the same question. It throws a 409.
    await findSlotConflict({ hallId, eventDate: new Date(eventDate), startTime, endTime });
    const totalAmount = hall.pricePerHour * eventDuration;

    const VALID_EVENT_TYPES = ['Wedding', 'Engagement', 'Reception', 'Anniversary', 'Birthday', 'Meeting', 'Corporate', 'Conference', 'Party', 'Other'];
    const resolvedEventType = VALID_EVENT_TYPES.includes(eventType) ? eventType : 'Other';

    const booking = new BanquetBooking({
      hallId,
      customerName: guestName,
      customerEmail: guestEmail || '',
      customerPhone: guestPhone,
      eventDate: new Date(eventDate),
      eventName: `${resolvedEventType} on ${new Date(eventDate).toLocaleDateString()}`,
      eventType: resolvedEventType,
      guestCount: parseInt(guestCount),
      setupType: setupType || 'Banquet',
      totalAmount,
      advanceAmount: 0,
      remainingAmount: totalAmount,
      startTime,
      endTime,
      eventDuration,
      specialRequirements: notes || '',
      status: 'Pending',
      paymentStatus: 'Pending',
      source: 'website',
    });

    await booking.save();

    // Insert-then-verify. The check above is a read followed by a write, so two
    // visitors submitting in the same moment both pass it -- measured at 10 of
    // 10 getting through before this. Re-checking after the insert makes the
    // race decidable: everyone now sees everyone, and the booking with the
    // lowest _id (created first) keeps the slot while the rest withdraw. Mongo
    // cannot express "no overlapping range" as a unique index, so the guarantee
    // has to be built rather than declared.
    const clashes = await findSlotConflicts(
      { hallId, eventDate: new Date(eventDate) },
      booking._id
    );
    const lost = clashes.find((c) => String(c.booking._id) < String(booking._id));
    if (lost) {
      await BanquetBooking.deleteOne({ _id: booking._id });
      return res.status(409).json({ success: false, message: describeSlotConflict(lost) });
    }

    res.status(201).json({
      success: true,
      // A DTO rather than the saved document, so server-side fields cannot be
      // widened into this public reply by a later schema change.
      data: {
        id: booking._id,
        eventDate: booking.eventDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
      },
      message: 'Banquet booking created successfully',
    });
  } catch (error) {
    // findSlotConflict throws a 409 carrying a guest-readable reason.
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error creating banquet booking:', error);
    res.status(500).json({ message: 'Error creating banquet booking' });
  }
};

// ── Room availability & booking ───────────────────────────────────────────────

export const getAvailability = async (req, res) => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: 'checkIn and checkOut are required' });
    }
    const minGuests = guests ? parseInt(guests, 10) : 0;

    const allRooms = await Room.find({});
    // One inventory snapshot — assigned bookings, banquet blocks AND the
    // category holds every website booking creates. See services/inventory.js.
    const snapshot = await getInventorySnapshot(checkIn, checkOut);
    const byType = availabilityByType(allRooms, snapshot, { minGuests });

    const categories = Array.from(byType.values());
    const totalAvailable = categories.reduce((n, c) => n + c.available, 0);

    // Public DTO, never the Mongoose documents: a Room carries operational
    // fields (maintenanceHistory, lastCleaned, housekeeping status) that have no
    // business on an anonymous endpoint.
    const publicRoom = (r) => ({
      id: r._id,
      type: r.type,
      capacity: r.capacity,
      price: r.pricePerNight,
      amenities: r.amenities,
      description: r.description,
      image: (r.images && r.images[0]) || null,
    });

    // Only surface as many concrete rooms as are actually sellable: a category
    // hold removes a slot without naming a room, so the free-room list can be
    // longer than the sellable count.
    const rooms = categories.flatMap((c) => c.freeRooms.slice(0, c.available)).map(publicRoom);

    res.json({
      available: totalAvailable > 0,
      rooms,
      count: totalAvailable,
      byCategory: categories
        .map(({ freeRooms, ...c }) => c)
        .sort((a, b) => a.price - b.price),
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: 'Error checking availability' });
  }
};

export const getRoomTypes = async (req, res) => {
  try {
    // Accepts an optional date range. Without one this reported whatever was
    // free at this instant (room.status) as though it were bookable for any
    // future stay — and it never subtracted category holds at all.
    const { checkIn, checkOut } = req.query;
    const rooms = await Room.find({});

    let byType;
    if (checkIn && checkOut) {
      byType = availabilityByType(rooms, await getInventorySnapshot(checkIn, checkOut));
    } else {
      // No range asked for: report current free-now status, still net of any
      // category hold that is live today.
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 86400000);
      byType = availabilityByType(rooms, await getInventorySnapshot(now, tomorrow));
    }

    const roomTypes = Array.from(byType.values()).map(({ freeRooms, ...c }) => ({
      ...c,
      // `count` kept as a back-compat alias for the available count.
      count: c.available,
    }));
    res.json(roomTypes);
  } catch (error) {
    console.error('Error getting room types:', error);
    res.status(500).json({ message: 'Error getting room types' });
  }
};

export const getRoomTypeById = async (req, res) => {
  try {
    // Only the fields the public view needs are fetched, so operational data —
    // housekeeping state, maintenanceHistory with its fault descriptions,
    // repair costs and resolver names — never leaves the database.
    const room = await Room.findById(req.params.id).select(PUBLIC_ROOM_FIELDS).lean();
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(publicRoomView(room, await getBilling()));
  } catch (error) {
    console.error('Error getting room details:', error);
    res.status(500).json({ message: 'Error getting room details' });
  }
};

const generateUniqueInvoiceNumber = async () => {
  const { invoicePrefix } = await getBilling();
  const seqRegex = new RegExp(`^${invoicePrefix}-(\\d+)$`);

  // One atomic $inc instead of read-latest-then-add-one, which handed the same
  // number to two simultaneous bookings. Seeded once from the highest number
  // already in the collection so it continues the existing series.
  const seq = await nextSequence(`invoice:${invoicePrefix}`, {
    start: 1000,
    seed: async () => {
      const latest = await Booking.find({ invoiceNumber: { $regex: seqRegex } })
        .select('invoiceNumber').sort({ invoiceNumber: -1 }).limit(25).lean();
      return latest.reduce((max, b) => {
        const n = parseInt(b.invoiceNumber?.match(seqRegex)?.[1], 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 1000);
    },
  });
  return `${invoicePrefix}-${seq}`;
};

export const createRoomBooking = async (req, res) => {
  try {
    const bookingData = req.body;
    if (
      !bookingData.guest ||
      (!bookingData.roomId && !bookingData.roomType) ||
      !bookingData.checkIn ||
      !bookingData.checkOut
    ) {
      return res.status(400).json({
        message: 'Guest information, a room category, and check-in/check-out dates are required',
      });
    }

    // Enforce what /availability reports. Showing the right number is not the
    // same as enforcing it: without this, a stale page, a retry, a race between
    // two guests, or a direct API call could still reserve a sold-out category.
    //
    // This check only ran when the request named a CATEGORY. A request naming a
    // specific roomId was checked against nothing at all -- not the category,
    // not the room -- so posting the roomId of an occupied room booked straight
    // over the guest already in it. availabilityConflict covers both.
    //
    // This is the EARLY answer, deliberately before payment is verified so a
    // sold-out stay is refused before money enters the picture. It is NOT the
    // binding one: the same check runs again inside the reservation lock below,
    // which is what actually makes a double booking impossible.
    const reservation = {
      roomId: bookingData.roomId || null,
      roomType: bookingData.roomType || null,
      roomCount: bookingData.roomCount,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
    };
    const earlyConflict = await availabilityConflict(Booking, Room, reservation);
    if (earlyConflict) {
      return res.status(earlyConflict.status).json({
        message: earlyConflict.message,
        available: earlyConflict.available,
      });
    }

    // Price the stay before anything else touches money. Every amount below
    // comes from this quote; nothing from the request body does.
    const quote = await quoteStay({
      roomId: bookingData.roomId,
      roomType: bookingData.roomType,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      roomCount: bookingData.roomCount,
    });

    // An "online" booking is only trusted as Paid after we verify the payment
    // server-side. Without this a crafted request could mark a booking Paid (and
    // post income) without ever paying, or confirm a large booking with a tiny
    // real payment. The client already sends the three Razorpay fields.
    const isOnline = bookingData.paymentMethod === 'online';
    if (isOnline) {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = bookingData;
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: 'Online payment verification details are required' });
      }

      let signatureValid = false;
      try {
        signatureValid = await paymentService.verifyPaymentSignature(
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature
        );
      } catch (err) {
        console.error('Payment signature verification error:', err.message);
        return res.status(400).json({ message: 'Payment could not be verified' });
      }
      if (!signatureValid) {
        return res.status(400).json({ message: 'Payment verification failed' });
      }

      // In live mode, confirm with the gateway that the payment was actually
      // captured and covers the booking total. Skipped only when the service has
      // no real keys (demo mode), where there is no gateway payment to fetch.
      if (!(await paymentService.isDemoMode())) {
        try {
          const payment = await paymentService.getPaymentDetails(razorpayPaymentId);
          // Against the SERVER's quote. This compared the payment with
          // bookingData.totalAmount, which the same caller supplied -- so it
          // only confirmed they had paid whatever they claimed to owe.
          const expectedPaise = Math.round(quote.totalAmount * 100);
          const paidPaise = Number(payment?.amount || 0);
          if (payment?.status !== 'captured') {
            return res.status(400).json({ message: 'Payment has not been captured' });
          }
          if (paidPaise < expectedPaise) {
            return res.status(400).json({ message: 'Paid amount does not match the booking total' });
          }
        } catch (err) {
          console.error('Payment confirmation with gateway failed:', err.message);
          return res.status(400).json({ message: 'Unable to confirm payment with the gateway' });
        }
      }
    }

    let guest = await Guest.findOne({ email: bookingData.guest.email });
    if (!guest) {
      const guestName = `${bookingData.guest.firstName || ''} ${
        bookingData.guest.lastName || ''
      }`.trim();
      guest = new Guest({
        name: guestName,
        email: bookingData.guest.email,
        phone: bookingData.guest.phone || bookingData.phone,
        gender: bookingData.guest.gender,
        age: bookingData.guest.age,
        address: bookingData.guest.streetName || bookingData.guest.address,
        identityType: bookingData.guest.idCardType,
        identityNumber: bookingData.guest.idCardNumber,
        nationality: bookingData.guest.nationality,
        specialNotes: bookingData.guest.specialRequests,
      });
      await guest.save();
    }

    const guestName = `${bookingData.guest.firstName || ''} ${
      bookingData.guest.lastName || ''
    }`.trim();
    const customerId = await nextCustomerId(guestName, bookingData.checkIn);
    const invoiceNumber = await generateUniqueInvoiceNumber();
    const { defaultCheckInTime, defaultCheckOutTime } = await getBilling();

    // Website bookings reserve a category only — staff assign the specific room
    // at check-in. A roomId is set only if one was explicitly chosen.
    const assignedRoom = bookingData.roomId
      ? await Room.findById(bookingData.roomId).lean()
      : null;
    const roomType = assignedRoom?.type || bookingData.roomType || '';

    const mapped = {
      guestName,
      email: bookingData.guest.email,
      phone: bookingData.guest.phone,
      age: bookingData.guest.age,
      gender: bookingData.guest.gender,
      nationality: bookingData.guest.nationality,
      idCardType: bookingData.guest.idCardType,
      idCardNumber: bookingData.guest.idCardNumber,
      idCardImage: bookingData.guest.idCardImage,
      streetName: bookingData.guest.streetName,
      area: bookingData.guest.area,
      pincode: bookingData.guest.pincode,
      district: bookingData.guest.district,
      state: bookingData.guest.state,
      roomId: bookingData.roomId || null,
      roomType,
      checkIn: new Date(bookingData.checkIn),
      checkOut: new Date(bookingData.checkOut),
      checkInTime: bookingData.checkInTime || defaultCheckInTime,
      checkOutTime: bookingData.checkOutTime || defaultCheckOutTime,
      adults: bookingData.adults || 1,
      children: bookingData.children || 0,
      roomCount: Math.max(1, Number(bookingData.roomCount) || 1),
      // Server-priced, not client-supplied. An online booking is paid in full
      // (the gateway confirmation above enforces that); pay-at-hotel owes it all.
      totalAmount: quote.totalAmount,
      baseAmount: quote.baseAmount,
      gstAmount: quote.gstAmount,
      paidAmount: isOnline ? quote.totalAmount : 0,
      remainingAmount: isOnline ? 0 : quote.totalAmount,
      paymentStatus: isOnline ? 'Paid' : 'Pending',
      paymentMethod: bookingData.paymentMethod || 'pay_at_hotel',
      // Persist the gateway transaction so an online booking can be reconciled
      // against Razorpay settlements and refunded from the record. The frontend
      // sends these after a verified payment; without mapping them here they
      // were being silently dropped.
      paymentGateway: bookingData.paymentGateway || 'manual',
      razorpayPaymentId: bookingData.razorpayPaymentId,
      razorpayOrderId: bookingData.razorpayOrderId,
      razorpaySignature: bookingData.razorpaySignature,
      paymentDate: bookingData.paymentDate,
      bookingStatus: bookingData.bookingStatus || 'Pending',
      specialRequests: bookingData.specialRequests || bookingData.notes,
      customerId,
      invoiceNumber,
    };

    // The binding check. Availability and the insert now happen inside one
    // critical section, so two guests clicking "Book" in the same second cannot
    // both be told the room is free. Everything expensive -- pricing, payment
    // verification, the guest record, the invoice number -- is already done, so
    // the lock is held only for a couple of queries and one write.
    const booking = new Booking(mapped);
    const conflict = await withInventoryLock(async () => {
      const clash = await availabilityConflict(Booking, Room, reservation);
      if (clash) return clash;
      await booking.save();
      return null;
    });

    if (conflict) {
      // The stay sold out between the guest paying and this request landing.
      // Refunding is the only honest answer; the alternative is holding money
      // for a room they cannot have.
      let refunded = false;
      if (isOnline && bookingData.razorpayPaymentId && !(await paymentService.isDemoMode())) {
        try {
          await paymentService.refundPayment(
            bookingData.razorpayPaymentId,
            quote.totalAmount,
            'Room sold out before the booking could be confirmed',
          );
          refunded = true;
        } catch (err) {
          console.error('Refund after a sold-out booking failed:', err.message);
        }
      }
      return res.status(conflict.status).json({
        message: isOnline
          ? `${conflict.message} ${refunded
              ? 'Your payment has been refunded and should appear in 5-7 working days.'
              : 'Your payment could not be refunded automatically -- please contact the hotel and we will return it.'}`
          : conflict.message,
        available: conflict.available,
        ...(isOnline ? { refunded } : {}),
      });
    }

    // Mirror any prepaid amount into the accounting ledger as income.
    await syncRoomBookingIncome(booking);

    // Instant "we've received your booking" notification (email/SMS/WhatsApp).
    // Fire-and-forget: never blocks or fails the booking response.
    sendBookingNotification('received', booking);

    // Live pop-up alert for back-office staff over Socket.IO.
    try {
      emitNewWebsiteBooking({
        _id: booking._id.toString(),
        guestName,
        roomType: roomType || 'Room',
        roomNumber: assignedRoom?.roomNumber || '',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults: booking.adults,
        children: booking.children,
        roomCount: booking.roomCount,
        phone: booking.phone,
        totalAmount: booking.totalAmount,
        createdAt: booking.createdAt || new Date(),
      });
    } catch (emitErr) {
      console.error('Error emitting new-booking alert:', emitErr.message);
    }

    res.status(201).json({
      success: true,
      bookingId: booking._id,
      // What the guest needs to check their booking later. The reference is the
      // human-readable half; the token is the secret that authorises the
      // lookup, and this response is the only place it is ever disclosed.
      bookingReference: booking.invoiceNumber,
      trackingToken: booking.trackingToken,
      message: 'Booking created successfully',
    });
  } catch (error) {
    if (error instanceof BookingPricingError) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error instanceof InventoryBusyError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Error creating booking' });
  }
};

/**
 * Let a guest check their own booking, and nothing else.
 *
 * This used to be `res.json({ status: booking.status, booking })` -- the entire
 * Mongoose document, on a public route, to anyone holding an ObjectId. That
 * shipped the guest's name, email, phone, address, age, gender, nationality,
 * ID-card type and number, the stored paths of their ID scans, company and GST
 * details, special requests and the Razorpay payment/order/signature ids. An
 * ObjectId is not a secret -- it encodes a timestamp and a counter, so one
 * leaked booking link made its neighbours guessable.
 *
 * `booking.status` was also undefined: the field is `bookingStatus`. The
 * endpoint's headline value had never once been populated.
 *
 * Now: a per-booking tracking token is required, and the reply is a fixed DTO.
 */
export const getBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token || req.get('x-booking-token');

    // One reply for "no such booking", "wrong token" and "legacy booking with
    // no token", so this cannot be used to probe which ObjectIds are real.
    const deny = () => res.status(404).json({ message: 'Booking not found' });
    if (!token) return deny();

    // Accept either the booking reference the guest was given or its id; the
    // token is what actually authorises, so neither needs to be unguessable.
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { invoiceNumber: String(id).toUpperCase() };
    const booking = await Booking.findOne(query).select(
      '+trackingToken invoiceNumber bookingStatus checkIn checkOut roomType roomId'
    );
    if (!booking || !secretsMatch(token, booking.trackingToken)) return deny();

    // A booking assigned to a specific room carries roomId and leaves roomType
    // blank, so the guest would be shown an empty "Room" line. Fall back to the
    // room's category -- the type only, never the room NUMBER, which says where
    // a current guest is sleeping.
    let roomType = booking.roomType;
    if (!roomType && booking.roomId) {
      const room = await Room.findById(booking.roomId).select('type');
      roomType = room?.type || '';
    }

    // A strict DTO. Fields are listed explicitly so that adding a column to the
    // Booking schema can never widen what this endpoint discloses.
    res.json({
      bookingReference: booking.invoiceNumber,
      bookingStatus: booking.bookingStatus,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomType,
    });
  } catch (error) {
    console.error('Error getting booking status:', error);
    res.status(500).json({ message: 'Error getting booking status' });
  }
};

// ── Marketing / informational endpoints ───────────────────────────────────────

// Escape before interpolating a stranger's text into the notification email.
const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public contact form.
 *
 * This used to console.log the request body and reply "we will get back to you
 * soon". Nothing stored it, nobody was told, and the one thing it did do was
 * copy a member of the public's name, email and phone into the log files.
 *
 * Now the enquiry is persisted first and reception is emailed second: if the
 * mail fails, the record still exists and `notified: false` says so, which is
 * what to look for when someone says they never heard back. The guest is only
 * promised a reply once the enquiry is actually saved.
 */
export const submitContact = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body || {};

    const clean = (v, max) => String(v ?? '').trim().slice(0, max);
    const enquiry = {
      firstName: clean(firstName, 100),
      lastName: clean(lastName, 100),
      email: clean(email, 200).toLowerCase(),
      phone: clean(phone, 30),
      subject: clean(subject, 200),
      message: clean(message, 5000),
    };

    if (!enquiry.firstName || !enquiry.email || !enquiry.message) {
      return res.status(400).json({
        success: false,
        message: 'Please give your name, an email address and a message.',
      });
    }
    if (!EMAIL_SHAPE.test(enquiry.email)) {
      return res.status(400).json({
        success: false,
        message: 'That email address does not look right. Please check it.',
      });
    }

    // Stored before anything else, so a mail outage cannot lose the enquiry.
    const saved = await ContactEnquiry.create({
      ...enquiry,
      sourceIp: req.ip || '',
    });

    // Tell reception. A failure here is logged and recorded on the enquiry, but
    // never fails the request — the message is safely stored either way.
    try {
      const settings = await Settings.findOne({}, { hotelProfile: 1, contact: 1 }).lean();
      const to =
        settings?.hotelProfile?.contact?.email ||
        settings?.contact?.email ||
        process.env.CONTACT_NOTIFY_EMAIL ||
        process.env.EMAIL_USER;

      if (to) {
        const name = [enquiry.firstName, enquiry.lastName].filter(Boolean).join(' ');
        const sent = await sendEmail(to, {
          subject: `Website enquiry: ${enquiry.subject || 'No subject'} — ${name}`,
          text:
            `From: ${name} <${enquiry.email}>\n` +
            `Phone: ${enquiry.phone || 'not given'}\n` +
            `Subject: ${enquiry.subject || 'not given'}\n\n${enquiry.message}\n`,
          html:
            `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(enquiry.email)}&gt;` +
            `${enquiry.phone ? ` · ${escapeHtml(enquiry.phone)}` : ''}</p>` +
            `<p><em>${escapeHtml(enquiry.subject || 'No subject')}</em></p>` +
            `<p style="white-space:pre-wrap">${escapeHtml(enquiry.message)}</p>`,
        });
        // Only true when mail actually went out. With no SMTP configured
        // sendEmail skips silently, and recording a notification that never
        // happened would hide exactly the enquiries nobody has seen.
        if (sent) {
          saved.notified = true;
          saved.notifiedAt = new Date();
          await saved.save();
        }
      }
    } catch (mailError) {
      // Identify the enquiry, not the person who sent it.
      console.error(`Contact enquiry ${saved._id}: reception email failed:`, mailError.message);
    }

    res.json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
  } catch (error) {
    // No req.body here: it holds a member of the public's contact details.
    console.error('Error submitting contact form:', error.message);
    res.status(500).json({ message: 'Error submitting contact form' });
  }
};

export const getSpecialOffers = async (_req, res) => {
  try {
    // Offers are this hotel's own, and one whose validUntil has passed drops
    // out on its own rather than advertising a promotion that has ended.
    res.json(publicOffers(await getWebsiteContent()));
  } catch (error) {
    console.error('Error getting special offers:', error.message);
    res.status(500).json({ message: 'Error getting special offers' });
  }
};

export const getHotelInfo = async (_req, res) => {
  try {
    // Every field comes from this hotel's Settings. Anything unset comes back
    // empty: the endpoint used to publish a US placeholder phone number for an
    // Indian hotel because it read settings.phone, while the real number lives
    // at hotelProfile.contact.phone.
    const [settings, content, billing] = await Promise.all([
      Settings.findOne({}, { hotelProfile: 1, contact: 1, policies: 1, hotelName: 1, description: 1, address: 1 }).lean(),
      getWebsiteContent(),
      getBilling(),
    ]);
    res.json(publicHotelInfo(settings, content, billing));
  } catch (error) {
    console.error('Error getting hotel info:', error.message);
    res.status(500).json({ message: 'Error getting hotel info' });
  }
};

export const getGallery = async (_req, res) => {
  try {
    res.json(publicGallery(await getWebsiteContent()));
  } catch (error) {
    console.error('Error getting gallery:', error.message);
    res.status(500).json({ message: 'Error getting gallery' });
  }
};

export const getAmenities = async (_req, res) => {
  try {
    res.json(publicAmenities(await getWebsiteContent()));
  } catch (error) {
    console.error('Error getting amenities:', error.message);
    res.status(500).json({ message: 'Error getting amenities' });
  }
};

export const getServices = async (_req, res) => {
  try {
    res.json(publicServices(await getWebsiteContent()));
  } catch (error) {
    console.error('Error getting services:', error.message);
    res.status(500).json({ message: 'Error getting services' });
  }
};

export const getRoomsForWebsite = async (_req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    // Return the whole room inventory — including occupied/maintenance/cleaning
    // rooms — so the storefront can display every room. The client renders
    // non-available rooms as view-only (booking disabled), so guests can see a
    // room exists even when it can't be booked right now.
    const rooms = await Room.find({}).select(PUBLIC_ROOM_FIELDS).lean();
    const billing = await getBilling();
    // Same serializer as the single-room view, plus the room number the card is
    // labelled with and the availability flag the site gates booking on.
    res.json(rooms.map((room) => storefrontRoomView(room, billing)));
  } catch (error) {
    console.error('Error getting rooms for website:', error);
    res.status(500).json({ message: 'Error getting rooms' });
  }
};

/**
 * The tax rates the server will actually charge.
 *
 * The storefront has to show a running total as the guest builds a cart or picks
 * dates, so it needs the rate client-side. It used to hardcode 5%, which is
 * merely the current default -- change posGstRate or roomGstRate in Settings and
 * the site would quote one figure and the server would charge another.
 *
 * Publishing the rate is not a disclosure: it is printed on every invoice and
 * required to be. What stays server-side is the arithmetic that binds money to
 * an order -- see services/orderPricing.js.
 */
export const getTaxConfig = async (_req, res) => {
  try {
    const { roomGstRate, posGstRate, roundAmounts, currencyCode, currencySymbol } = await getBilling();
    // Short cache: rates change about never, but a settings edit should reach
    // the storefront within a few minutes without a redeploy.
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ roomGstRate, posGstRate, roundAmounts, currencyCode, currencySymbol });
  } catch (error) {
    console.error('Error getting tax config:', error);
    res.status(500).json({ message: 'Error getting tax configuration' });
  }
};

/**
 * What a stay will cost, priced by the server.
 *
 * The booking page used to do this arithmetic itself (rate x nights x rooms,
 * plus a hardcoded 5%) and post the result. Now it asks, displays what comes
 * back, and posts no money at all -- so the figure quoted is by construction
 * the figure charged.
 */
export const getStayQuote = async (req, res) => {
  try {
    const { roomId, roomType, checkIn, checkOut, roomCount } = req.query;
    const quote = await quoteStay({ roomId, roomType, checkIn, checkOut, roomCount });
    res.json(quote);
  } catch (error) {
    if (error instanceof BookingPricingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error quoting stay:', error);
    res.status(500).json({ message: 'Error calculating the price for those dates' });
  }
};

// ── Restaurant / room-service orders ──────────────────────────────────────────

export const createRestaurantOrder = async (req, res) => {
  try {
    const orderData = req.body;

    // Names, prices, availability and tax are resolved from the live menu. The
    // request body only gets to say WHICH items and HOW MANY -- see
    // services/orderPricing.js for why nothing else in it is trusted.
    const { items, subtotal, gst, total } = await priceOrder(orderData.items);

    // If the customer is staying with us and entered a room number, attach the
    // order to that active booking so it surfaces alongside room-service orders.
    let booking = null;
    let room = null;
    const rawRoom = orderData.roomNumber || orderData.customerInfo?.roomNumber;
    const roomNumber = rawRoom ? String(rawRoom).trim() : '';
    if (roomNumber) {
      const result = await findActiveBookingByRoomNumber(roomNumber, stayTokenOf(req));
      if (result.error) {
        return res.status(result.error.status).json({
          success: false,
          message: `${result.error.message} (room "${roomNumber}")`,
        });
      }
      ({ room, booking } = result);
    }

    const order = new Order({
      orderType: booking ? 'room' : 'pos',
      ...(booking ? { roomId: booking._id } : {}),
      items,
      totalAmount: total,
      gst,
      status: 'Pending',
      specialInstructions: orderData.specialInstructions || '',
      customerName: booking?.guestName || orderData.customerInfo?.name || 'Website Customer',
      customerPhone: booking?.phone || orderData.customerInfo?.phone || 'N/A',
      paymentMethod: 'cash',
      createdAt: new Date(),
    });
    await order.save();

    res.status(201).json({
      success: true,
      orderNumber: order.orderNumber,
      message: booking
        ? `Order placed for Room ${room.roomNumber}`
        : 'Order placed successfully',
      orderId: order._id,
      // The authoritative figures, so the guest is shown what they will actually
      // be charged rather than the browser's own arithmetic.
      subtotal,
      gst: order.gst,
      totalAmount: order.totalAmount,
      ...(room ? { roomNumber: room.roomNumber, guestName: booking.guestName } : {}),
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error creating restaurant order:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
};

/** The stay token from the room-service link (?t=…) or an explicit header. */
const stayTokenOf = (req) => req.query?.t || req.query?.token || req.get('x-stay-token') || null;

const findActiveBookingByRoomNumber = async (rawNumber, stayToken = null) => {
  // Be forgiving about how the guest typed the room number. We first try
  // an exact match (covers "R-304"), then fall back to a case-insensitive
  // suffix match on the digits ("304" → "R-304"). This avoids forcing the
  // guest to mirror the back-office's prefix convention.
  const typed = String(rawNumber ?? '').trim();
  let room = await Room.findOne({ roomNumber: typed });
  if (!room) {
    const digits = typed.match(/\d+/)?.[0];
    if (digits) {
      room = await Room.findOne({ roomNumber: { $regex: new RegExp(`${digits}$`, 'i') } });
    }
  }
  if (!room) return { error: { status: 404, message: 'Room not found' } };

  // Accept both Confirmed (front desk has confirmed/checked in) and
  // Pending (website booking that the desk hasn't acted on yet). As long
  // as today falls inside the stay window, the guest is in residence and
  // can charge to their folio. Sort by latest checkIn so a back-to-back
  // booking on the same room picks the current stay rather than an older
  // one.  Guest details are flat fields on the Booking doc, so no
  // .populate('guestId') — that path was the cause of an earlier
  // StrictPopulateError.
  // Presence is `checkedIn`, not "a reservation whose dates cover today".
  //
  // This used to match bookingStatus Confirmed/Pending over today's range and
  // call that "in residence". They are not the same thing: a Pending booking
  // for tonight satisfies checkIn <= now <= checkOut from the moment it is
  // created, so anyone could charge food to a room whose guest had not yet
  // arrived -- and the folio would carry it. The Booking model has a dedicated
  // flag for physical presence and the rest of the app derives occupancy from
  // it; this is now consistent with that.
  const booking = await Booking.findOne({
    roomId: room._id,
    checkedIn: true,
    bookingStatus: { $nin: ['Completed', 'Cancelled', 'Rejected'] },
  }).select('+trackingToken').sort({ checkedInAt: -1, checkIn: -1 });

  // A room number is not a credential. "304" is guessable by anyone who has
  // walked the corridor, and these endpoints charge food to a guest's folio, so
  // the stay's own secret is required -- the same per-booking token the guest
  // gets in their welcome message, carried by the in-room QR code.
  //
  // The reply is identical whether the room is empty or the token is wrong, so
  // walking room numbers reveals nothing about who is staying.
  const tokenOk = booking && secretsMatch(stayToken, booking.trackingToken);
  if (booking && !tokenOk) {
    return {
      error: {
        status: 403,
        message: 'This room-service link is not valid for the guest currently in this room. '
          + 'Please scan the QR code in your room, or ask reception to resend your menu link.',
      },
    };
  }

  if (!booking) {
    return {
      error: {
        status: 404,
        message: `We can't see a checked-in guest in room ${room.roomNumber}. `
          + 'If you have just arrived, please ask reception to complete your check-in.',
      },
    };
  }
  return { room, booking };
};

export const getRoomServiceContext = async (req, res) => {
  try {
    const result = await findActiveBookingByRoomNumber(req.params.roomNumber, stayTokenOf(req));
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });

    const { room, booking } = result;

    const menuItems = await MenuItem.find({ isAvailable: true })
      .populate('category')
      .sort({ 'category.displayOrder': 1, name: 1 });
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });

    // This endpoint is reachable by anyone who can type a room number, so it
    // returns the minimum the in-room menu actually renders: a first name to
    // greet the guest and the stay dates. It previously returned the guest's
    // full name, phone number, email and booking number — enumerable by walking
    // room numbers. The order endpoint reads phone/name from the booking
    // server-side, so nothing needs them here.
    res.json({
      room: { roomNumber: room.roomNumber, type: room.type, floor: room.floor },
      guest: {
        name: String(booking.guestName || '').trim().split(/\s+/)[0] || 'Guest',
      },
      booking: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      },
      menuItems,
      categories,
    });
  } catch (error) {
    console.error('Error getting room service data:', error);
    res.status(500).json({ message: 'Error getting room service data' });
  }
};

export const createRoomServiceOrder = async (req, res) => {
  try {
    const orderData = req.body;

    // Same rule as the restaurant endpoint: the cart says what and how many,
    // the menu says what it costs.
    const { items, subtotal, gst, total } = await priceOrder(orderData.items);

    const result = await findActiveBookingByRoomNumber(req.params.roomNumber, stayTokenOf(req));
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });

    const { room, booking } = result;

    const order = new Order({
      orderType: 'room',
      roomId: booking._id,
      items,
      totalAmount: total,
      gst,
      status: 'Pending',
      specialInstructions: orderData.specialInstructions || '',
      customerName: orderData.customerName || booking.guestName,
      customerPhone: orderData.customerPhone || booking.phone,
      paymentMethod: 'cash',
      createdAt: new Date(),
    });
    await order.save();

    res.status(201).json({
      success: true,
      orderNumber: order.orderNumber,
      message: 'Room service order placed successfully',
      orderId: order._id,
      roomNumber: room.roomNumber,
      guestName: booking.guestName,
      subtotal,
      gst: order.gst,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error creating room service order:', error);
    res.status(500).json({ message: 'Error creating room service order' });
  }
};

export const getRoomServiceOrders = async (req, res) => {
  try {
    // Was a third variant of the same lookup (Confirmed only, no Pending, date
    // range). One helper now answers "who is in this room" for all three
    // room-service endpoints.
    const result = await findActiveBookingByRoomNumber(req.params.roomNumber, stayTokenOf(req));
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const { booking } = result;

    const orders = await Order.find({ roomId: booking._id, orderType: 'room' }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    console.error('Error getting room service orders:', error);
    res.status(500).json({ message: 'Error getting room service orders' });
  }
};

// ── Payment ───────────────────────────────────────────────────────────────────

export const getPaymentConfig = async (_req, res) => {
  try {
    const settings = await paymentService.getSettings();
    if (!settings) {
      return res.status(503).json({ message: 'Payment gateway not configured', enabled: false });
    }
    res.json({ enabled: settings.enabled, keyId: settings.keyId, environment: settings.environment });
  } catch (error) {
    console.error('Error getting payment config:', error);
    res.status(500).json({ message: 'Error getting payment configuration' });
  }
};

export const createRazorpayOrder = async (req, res) => {
  try {
    const { currency = 'INR', receipt, stay } = req.body;

    // The amount is quoted here, not accepted. Taking it from the request let a
    // caller open a Rs1 order for a Rs20,000 stay and then present that payment
    // as settlement in full.
    const quote = await quoteStay(stay || {});
    const order = await paymentService.createOrder(quote.totalAmount, currency, receipt);
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
      quote,
    });
  } catch (error) {
    if (error instanceof BookingPricingError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters',
      });
    }

    const isValid = await paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const isDemoOrder =
      razorpay_order_id.includes('demo') || razorpay_payment_id.includes('demo');

    if (isDemoOrder) {
      return res.json({
        success: true,
        message: 'Payment verified successfully (Demo Mode)',
        payment: {
          id: razorpay_payment_id,
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000),
        },
      });
    }

    const paymentDetails = await paymentService.getPaymentDetails(razorpay_payment_id);
    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: paymentDetails.id,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: paymentDetails.status,
        method: paymentDetails.method,
        created_at: paymentDetails.created_at,
      },
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed', error: error.message });
  }
};

// processPayment (POST /process-payment) was removed. It was an unused, public
// second path into booking creation that did `new Booking({ ...bookingData })`
// -- spreading the request body straight into the document, so a caller set
// their own totalAmount, paidAmount, bookingStatus and invoiceNumber -- with no
// tariff calculation and no availability check. It verified the Razorpay
// signature and nothing else, and recorded `paidAmount: bookingData.totalAmount`
// from that same body. createRoomBooking covers the online flow properly:
// server-priced via quoteStay, inventory-checked under a lock via
// availabilityConflict, and the
// captured payment confirmed against the server's own total.

// refundPayment / getPaymentDetails moved to controllers/paymentController.js —
// they are staff-only gateway operations, not part of the public website API.

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = req.body;
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        await Booking.updateOne(
          { razorpayPaymentId: payment.id },
          { paymentStatus: 'Paid', paidAmount: payment.amount / 100 }
        );
        // Post the captured payment to accounting.
        const paidBooking = await Booking.findOne({ razorpayPaymentId: payment.id });
        if (paidBooking) await syncRoomBookingIncome(paidBooking);
        break;
      }
      case 'payment.failed': {
        const failedPayment = event.payload.payment.entity;
        await Booking.updateOne(
          { razorpayPaymentId: failedPayment.id },
          { paymentStatus: 'Failed' }
        );
        break;
      }
      case 'order.paid':
        break;
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};
