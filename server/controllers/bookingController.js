import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Guest from '../models/Guest.js';
import Company from '../models/Company.js';
import Housekeeping from '../models/Housekeeping.js';
import mongoose from 'mongoose';
import { getBanquetBlockedRoomIds } from './roomController.js';
import { calculateNights } from '../utils/dateHelpers.js';
import { emitHousekeepingTask } from '../config/socket.js';
import { sendBookingNotification } from '../services/notificationService.js';
import { getBilling, getOps } from '../config/operationalConfig.js';
import { syncRoomBookingIncome, removeEntriesBySource } from '../services/accountingSync.js';
import { upsertGuest } from '../services/guestDirectory.js';

// Generate invoice number — the prefix comes from billing settings so the whole
// numbering scheme is configurable (Billing & Tariff → Invoice prefix).
const generateInvoiceNumber = async (guestName, checkIn) => {
  const { invoicePrefix } = await getBilling();
  const nameParts = guestName.trim().split(' ');
  const firstInitial = nameParts[0]?.[0]?.toUpperCase() || '';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
  const initials = firstInitial + lastInitial;

  const dateObj = new Date(checkIn);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const regex = new RegExp(`^${invoicePrefix}-${initials}-${dateStr}-\\d{4}$`);
  const latestBooking = await Booking.findOne(
    { invoiceNumber: { $regex: regex } },
    { invoiceNumber: 1 },
    { sort: { invoiceNumber: -1 } }
  );

  let sequenceNumber = 1001;
  if (latestBooking && latestBooking.invoiceNumber) {
    const parts = latestBooking.invoiceNumber.split('-');
    if (parts.length === 4) {
      const lastSeq = parseInt(parts[3]);
      if (!isNaN(lastSeq)) {
        sequenceNumber = lastSeq + 1;
      }
    }
  }

  return `${invoicePrefix}-${initials}-${dateStr}-${String(sequenceNumber).padStart(4, '0')}`;
};

// Create booking
export const createBooking = async (req, res) => {
  try {
    let bookingData;
    
    // Handle FormData (when file is uploaded) vs regular JSON
    if (req.body.data) {
      // If data comes as FormData with JSON string
      bookingData = JSON.parse(req.body.data);

      // Persist uploaded ID document image paths (front + optional Aadhaar back).
      // Note: these go into the schema fields idCardImage / idCardImageBack —
      // the old code wrote idCardImagePath, which strict mode silently dropped.
      const frontFile = req.files?.idCardImage?.[0];
      const backFile = req.files?.idCardImageBack?.[0];
      if (frontFile) bookingData.idCardImage = frontFile.path;
      if (backFile) bookingData.idCardImageBack = backFile.path;
    } else {
      // Regular JSON body
      bookingData = req.body;
    }

    // Validate required fields
    if (!bookingData.guestName || !bookingData.phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Guest name and phone number are required' 
      });
    }

    if (!bookingData.roomId) {
      return res.status(400).json({ 
        success: false,
        message: 'Room selection is required' 
      });
    }

    if (!bookingData.checkIn || !bookingData.checkOut) {
      return res.status(400).json({ 
        success: false,
        message: 'Check-in and check-out dates are required' 
      });
    }

    if (!bookingData.totalAmount || bookingData.totalAmount <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Total amount is required and must be greater than 0' 
      });
    }

    // Ensure bookingStatus is valid
    if (!bookingData.bookingStatus) {
      bookingData.bookingStatus = 'Pending';
    }

    // Validate roomId format
    if (!mongoose.Types.ObjectId.isValid(bookingData.roomId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid room ID format' 
      });
    }

    // Check if room exists
    const room = await Room.findById(bookingData.roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: 'Selected room not found' 
      });
    }

    // Convert roomId to ObjectId
    bookingData.roomId = new mongoose.Types.ObjectId(bookingData.roomId);

    // Parse dates
    bookingData.checkIn = new Date(bookingData.checkIn);
    bookingData.checkOut = new Date(bookingData.checkOut);

    // Reject if the room is reserved for a banquet/marriage event on these dates
    const banquetBlocked = await getBanquetBlockedRoomIds(bookingData.checkIn, bookingData.checkOut);
    if (bookingData.roomId && banquetBlocked.has(bookingData.roomId.toString())) {
      return res.status(409).json({
        success: false,
        message: 'This room is reserved for a banquet event on the selected dates and cannot be booked.'
      });
    }

    // Generate customer ID
    const guestName = bookingData.guestName || '';
    const checkInDate = bookingData.checkIn || new Date();
    const nameParts = guestName.trim().split(' ');
    const firstInitial = nameParts[0]?.[0]?.toUpperCase() || '';
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
    const initials = firstInitial + lastInitial;
    
    const dateObj = new Date(checkInDate);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    
    const dateStart = new Date(dateObj.setHours(0,0,0,0));
    const dateEnd = new Date(dateObj.setHours(23,59,59,999));
    const bookingsForDay = await Booking.find({
      checkIn: { $gte: dateStart, $lte: dateEnd }
    }).sort({ createdAt: -1 });
    
    let seq = 1001;
    if (bookingsForDay.length > 0) {
      const lastId = bookingsForDay[0].customerId;
      const lastSeq = lastId ? parseInt(lastId.slice(-4)) : 1000;
      seq = isNaN(lastSeq) ? 1001 : lastSeq + 1;
    }
    
    bookingData.customerId = `${initials}${dateStr}${seq}`;

    // Create or update guest record
    const guestFields = {
      name: bookingData.guestName,
      email: bookingData.email,
      phone: bookingData.phone,
      gender: bookingData.gender,
      age: bookingData.age,
      address: [
        bookingData.streetName,
        bookingData.area,
        bookingData.district,
        bookingData.state,
        bookingData.pincode
      ].filter(Boolean).join(', '),
      identityType: bookingData.idCardType,
      identityNumber: bookingData.idCardNumber,
      nationality: bookingData.nationality
    };

    await upsertGuest(guestFields);

    // Generate invoice number
    if (!bookingData.invoiceNumber) {
      bookingData.invoiceNumber = await generateInvoiceNumber(guestName, checkInDate);
    }

    // Calculate and store baseAmount (room tariff per night)
    if (!bookingData.baseAmount && room.pricePerNight) {
      const { defaultCheckOutTime } = await getBilling();
      const nights = calculateNights(
        bookingData.checkIn,
        bookingData.checkOut,
        bookingData.checkOutTime || defaultCheckOutTime
      );
      bookingData.baseAmount = room.pricePerNight * nights;
    }

    // A booking only occupies the room when the guest is physically checked
    // in. Walk-ins can pass checkedIn:true to occupy immediately; advance
    // reservations (the default) leave the room available/reserved until the
    // front desk checks the guest in.
    if (bookingData.checkedIn === true) {
      bookingData.checkedInAt = bookingData.checkedInAt || new Date();
    } else {
      bookingData.checkedIn = false;
    }

    // Create booking
    const booking = new Booking(bookingData);
    const savedBooking = await booking.save();

    // Occupy the room only for a checked-in guest.
    if (bookingData.checkedIn === true) {
      await Room.findByIdAndUpdate(
        bookingData.roomId,
        { status: 'occupied', isAvailable: false }
      );
    }

    // Populate room data
    const populatedBooking = await Booking.findById(savedBooking._id).populate('roomId');

    // Mirror any advance/paid amount into the accounting ledger as income.
    await syncRoomBookingIncome(populatedBooking);

    res.status(201).json({
      success: true,
      data: populatedBooking,
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create booking', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get all bookings
export const getBookings = async (req, res) => {
  try {
    // Optional server-side filtering so pollers/badges (e.g. the pending-booking
    // notifier that runs every 30s) fetch only what they need instead of the
    // whole collection. No params → unchanged behaviour (all bookings).
    const filter = {};
    if (req.query.status) {
      const statuses = String(req.query.status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) filter.bookingStatus = statuses[0];
      else if (statuses.length > 1) filter.bookingStatus = { $in: statuses };
    }

    // Only populate the room fields the client actually reads off the joined
    // document (roomNumber + type). `.lean()` skips Mongoose hydration, which
    // halves the time for large result sets.
    let query = Booking.find(filter)
      .populate('roomId', 'roomNumber type')
      .sort({ checkIn: -1 })
      .lean();

    // Optional cap for notification/preview use (?limit=50).
    const limit = parseInt(req.query.limit, 10);
    if (Number.isInteger(limit) && limit > 0) query = query.limit(limit);

    const bookings = await query;

    // The global request-timeout middleware may have already returned a 503
    // for this request while the populate was running. Don't try to write a
    // second response — Node throws ERR_HTTP_HEADERS_SENT.
    if (res.headersSent || req.timedout) return;

    res.json({
      success: true,
      data: bookings,
      message: 'Bookings fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    if (res.headersSent || req.timedout) return;
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// Get booking by ID
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('roomId');

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking not found' 
      });
    }

    res.json({
      success: true,
      data: booking,
      message: 'Booking fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update booking
export const updateBooking = async (req, res) => {
  try {
    // Edits may arrive as multipart (when new ID images are attached) or plain
    // JSON. Parse the FormData `data` blob and merge any uploaded image paths.
    let bookingData;
    if (req.body.data) {
      bookingData = JSON.parse(req.body.data);
      const frontFile = req.files?.idCardImage?.[0];
      const backFile = req.files?.idCardImageBack?.[0];
      if (frontFile) bookingData.idCardImage = frontFile.path;
      if (backFile) bookingData.idCardImageBack = backFile.path;
    } else {
      bookingData = req.body;
    }
    const bookingId = req.params.id;

    // Get existing booking
    const existingBooking = await Booking.findById(bookingId).populate('roomId');
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Block updates that would put a guest into a room reserved for a banquet event
    const touchesRoomOrDates = bookingData.roomId || bookingData.checkIn || bookingData.checkOut || bookingData.bookingStatus === 'Confirmed';
    if (touchesRoomOrDates) {
      const effRoomId = bookingData.roomId || existingBooking.roomId?._id || existingBooking.roomId;
      const effCheckIn = new Date(bookingData.checkIn || existingBooking.checkIn);
      const effCheckOut = new Date(bookingData.checkOut || existingBooking.checkOut);
      if (effRoomId) {
        const blocked = await getBanquetBlockedRoomIds(effCheckIn, effCheckOut);
        if (blocked.has(effRoomId.toString())) {
          return res.status(409).json({
            success: false,
            message: 'This room is reserved for a banquet event on the selected dates and cannot be booked.'
          });
        }
      }
    }

    // Generate invoice number if not present and booking is being completed
    if (!existingBooking.invoiceNumber && (bookingData.bookingStatus === 'Completed' || bookingData.paymentStatus === 'Paid')) {
      bookingData.invoiceNumber = await generateInvoiceNumber(existingBooking.guestName, existingBooking.checkIn);
    }

    // Calculate and store baseAmount if not provided and room data is available
    if (!bookingData.baseAmount && existingBooking.roomId?.pricePerNight) {
      const { defaultCheckOutTime } = await getBilling();
      const nights = calculateNights(
        bookingData.checkIn || existingBooking.checkIn,
        bookingData.checkOut || existingBooking.checkOut,
        bookingData.checkOutTime || existingBooking.checkOutTime || defaultCheckOutTime
      );
      bookingData.baseAmount = existingBooking.roomId.pricePerNight * nights;
    }

    // Presence transitions — occupancy follows checkedIn, not the reservation
    // status. Persist these onto bookingData before the write below.
    if (bookingData.bookingStatus === 'Completed') {
      bookingData.checkedIn = false;
      bookingData.checkedOutAt = new Date();
    } else if (bookingData.bookingStatus === 'Cancelled' || bookingData.bookingStatus === 'Rejected') {
      bookingData.checkedIn = false;
    } else if (bookingData.checkedIn === true && !existingBooking.checkedIn) {
      bookingData.checkedInAt = new Date();
      bookingData.checkedOutAt = null;
    }

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      bookingData,
      { new: true, runValidators: true }
    ).populate('roomId');

    // Reconcile the room from the booking's resulting state. Category holds have
    // no room yet (assigned at check-in) — nothing to reconcile in that case.
    const roomId = existingBooking.roomId?._id || existingBooking.roomId;
    const effStatus = bookingData.bookingStatus || existingBooking.bookingStatus;
    const effCheckedIn = bookingData.checkedIn !== undefined ? bookingData.checkedIn : existingBooking.checkedIn;

    if (roomId && effStatus === 'Completed') {
      // Guest checked out → room needs cleaning. Whether a task is raised, and
      // at what priority, is configurable (Operations → Housekeeping).
      try {
        const { housekeeping } = await getOps();
        if (housekeeping.autoCreateOnCheckout) {
          const task = await Housekeeping.ensureCleaningTask({
            roomId,
            source: 'checkout_booking',
            notes: 'Room requires cleaning after guest checkout.',
            priority: housekeeping.checkoutCleaningPriority,
          });
          // existingBooking.roomId is the populated Room doc → carries roomNumber.
          emitHousekeepingTask(task, existingBooking.roomId);
        }
      } catch (taskError) {
        console.error('Error creating housekeeping task:', taskError);
      }
      await Room.findByIdAndUpdate(roomId, { status: 'cleaning', isAvailable: false });
    } else if (roomId && (effStatus === 'Cancelled' || effStatus === 'Rejected')) {
      await Room.findByIdAndUpdate(roomId, { status: 'available', isAvailable: true });
    } else if (roomId && effCheckedIn) {
      // In-house guest → occupied.
      await Room.findByIdAndUpdate(roomId, { status: 'occupied', isAvailable: false });
    }
    // Otherwise a reservation (Pending/Confirmed, not checked in): leave the
    // room's manual state (available / cleaning / maintenance) untouched.

    // Keep the accounting income entry in step with the booking's paid amount.
    await syncRoomBookingIncome(updatedBooking);

    res.json({
      success: true,
      data: updatedBooking,
      message: 'Booking updated successfully'
    });

    // Notify the guest when the back-office moves a booking to Confirmed or
    // Rejected — but only on an actual transition (skip no-op re-saves).
    const newStatus = bookingData.bookingStatus;
    if (
      (newStatus === 'Confirmed' || newStatus === 'Rejected') &&
      existingBooking.bookingStatus !== newStatus
    ) {
      sendBookingNotification(newStatus === 'Confirmed' ? 'confirmed' : 'rejected', updatedBooking);
    }

  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete booking
export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Free the room unless another confirmed booking still holds it
    if (booking.roomId) {
      const otherActive = await Booking.findOne({
        _id: { $ne: booking._id },
        roomId: booking.roomId,
        bookingStatus: 'Confirmed'
      });
      if (!otherActive) {
        await Room.findByIdAndUpdate(booking.roomId, { status: 'available', isAvailable: true });
      }
    }

    await Booking.findByIdAndDelete(req.params.id);

    // Drop the linked accounting income entry.
    await removeEntriesBySource('room_booking', req.params.id);

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Check in guest
export const checkInGuest = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking not found' 
      });
    }
    
    // Mark the guest as physically present. The room becomes occupied only
    // here — never at reservation time.
    booking.bookingStatus = 'Confirmed';
    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    booking.checkedOutAt = null;
    await booking.save();

    await Room.findByIdAndUpdate(
      booking.roomId,
      {
        status: 'occupied',
        isAvailable: false
      }
    );

    res.json({
      success: true,
      message: 'Guest checked in successfully',
      data: booking
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to check in guest', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get checked out bookings
export const getCheckedOutBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ bookingStatus: 'Completed' })
      .populate('roomId')
      .sort({ checkOut: -1 });

    res.json({
      success: true,
      data: bookings,
      message: 'Checked-out bookings fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching checked-out bookings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch checked-out bookings', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Generate invoice numbers for existing bookings that don't have them
export const generateMissingInvoiceNumbers = async (req, res) => {
  try {
    // Find bookings without invoice numbers or with the placeholder default
    // (prefix-1001 — the seed value the Booking model stamps before the
    // controller overwrites it). Prefix is taken from billing settings.
    const { invoicePrefix } = await getBilling();
    const placeholder = `${invoicePrefix}-1001`;
    const bookingsWithoutInvoiceNumbers = await Booking.find({
      $or: [
        { invoiceNumber: { $exists: false } },
        { invoiceNumber: null },
        { invoiceNumber: placeholder },
        { invoiceNumber: { $regex: new RegExp(`^${invoicePrefix}-1001`) } }
      ]
    });

    let updated = 0;
    for (const booking of bookingsWithoutInvoiceNumbers) {
      try {
        const newInvoiceNumber = await generateInvoiceNumber(booking.guestName, booking.checkIn);
        await Booking.findByIdAndUpdate(booking._id, { invoiceNumber: newInvoiceNumber });
        updated++;
      } catch (error) {
        console.error(`Error updating invoice number for booking ${booking._id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Updated ${updated} bookings with new invoice numbers`,
      data: { updated, total: bookingsWithoutInvoiceNumbers.length }
    });

  } catch (error) {
    console.error('Error generating missing invoice numbers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate missing invoice numbers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ── Shared helper: generate a unique customerId for a check-in date ─────────
// Mirrors the inline logic in createBooking so group rooms each get a unique,
// sequential id even when created in the same request.
const generateCustomerId = async (guestName, checkInDate, offset = 0) => {
  const nameParts = String(guestName || '').trim().split(' ');
  const firstInitial = nameParts[0]?.[0]?.toUpperCase() || 'G';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
  const initials = firstInitial + lastInitial;

  const dateObj = new Date(checkInDate);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const dateStart = new Date(new Date(dateObj).setHours(0, 0, 0, 0));
  const dateEnd = new Date(new Date(dateObj).setHours(23, 59, 59, 999));
  const bookingsForDay = await Booking.find({ checkIn: { $gte: dateStart, $lte: dateEnd } })
    .sort({ createdAt: -1 })
    .limit(1);

  let seq = 1001;
  if (bookingsForDay.length > 0) {
    const lastId = bookingsForDay[0].customerId;
    const lastSeq = lastId ? parseInt(lastId.slice(-4), 10) : 1000;
    seq = isNaN(lastSeq) ? 1001 : lastSeq + 1;
  }
  return `${initials}${dateStr}${seq + offset}`;
};

// Booking statuses that still hold a room against availability.
const ACTIVE_HOLD_STATUSES = ['Confirmed', 'Pending', 'Tentative', 'Checked-In'];

// Allowed group/company lifecycle transitions (Section 8 workflow). Terminal
// states (Completed, Cancelled, Rejected) have no onward moves.
const STATUS_TRANSITIONS = {
  Draft: ['Tentative', 'Confirmed', 'Cancelled'],
  Tentative: ['Confirmed', 'Cancelled'],
  Pending: ['Confirmed', 'Tentative', 'Cancelled'],
  Confirmed: ['Checked-In', 'Completed', 'Cancelled'],
  'Checked-In': ['Completed', 'Cancelled'],
};

// Map the group advance payment mode onto the Booking.paymentMethod enum.
// Bank Transfer / Cheque have no enum slot, so they fall back to "Other"
// (the precise mode is preserved in groupDetails.advancePaymentMode).
const mapAdvanceMode = (m) => ({ Cash: 'Cash', UPI: 'UPI', Card: 'Card' }[m] || (m ? 'Other' : ''));

// ── Create a group booking from a ROOM BLOCK ────────────────────────────────
// Blocks inventory by room type/qty/rate (specific rooms are assigned later via
// the rooming list, so each booking is created with roomId=null). The first
// booking is the group master and carries the rich groupDetails + advance.
const createGroupFromRoomBlock = async (res, ctx) => {
  const { body, coordinator, groupName, checkInDate, checkOutDate, roomBlock } = ctx;
  const nights = Math.max(1, calculateNights(checkInDate, checkOutDate) || 1);

  // Availability: ensure enough free rooms of each blocked type for the window.
  const allRooms = await Room.find({ status: { $ne: 'maintenance' } });
  const overlapping = await Booking.find({
    $and: [
      { checkIn: { $lt: checkOutDate } },
      { checkOut: { $gt: checkInDate } },
      { bookingStatus: { $in: ACTIVE_HOLD_STATUSES } },
      { roomId: { $ne: null } },
    ],
  });
  const bookedRoomIds = new Set(overlapping.map((b) => b.roomId.toString()));
  const banquetBlocked = await getBanquetBlockedRoomIds(checkInDate, checkOutDate);
  const freeByType = {};
  for (const r of allRooms) {
    const id = r._id.toString();
    if (bookedRoomIds.has(id) || banquetBlocked.has(id)) continue;
    freeByType[r.type] = (freeByType[r.type] || 0) + 1;
  }
  for (const b of roomBlock) {
    const free = freeByType[b.roomType] || 0;
    if (Number(b.qty) > free) {
      return res.status(409).json({
        success: false,
        message: `Only ${free} "${b.roomType}" room(s) free for these dates (you blocked ${b.qty}).`,
      });
    }
  }

  const groupId = `GRP-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
  const status = body.bookingStatus || 'Tentative';
  const { defaultCheckInTime, defaultCheckOutTime } = await getBilling();

  // Upsert coordinator into the Guest collection once.
  await upsertGuest({ name: coordinator.guestName, email: coordinator.email, phone: coordinator.phone });

  const advanceAmount = Math.max(0, Number(body.advanceAmount) || 0);
  const cleanBlock = roomBlock.map((b) => ({
    roomType: b.roomType,
    qty: Number(b.qty) || 0,
    rate: Number(b.rate) || 0,
    pax: Number(b.pax) || 0,
  }));
  const totalRooms = cleanBlock.reduce((s, b) => s + b.qty, 0);
  const groupTotalAmount = roomBlock.reduce(
    (sum, b) => sum + (Number(b.totalAmount) || 0) * (Number(b.qty) || 0),
    0,
  );

  const groupDetails = {
    groupType: body.groupType || '',
    address: coordinator.address || body.address || '',
    notes: body.notes || body.specialRequests || '',
    adults: Number(body.adults) || 0,
    children: Number(body.children) || 0,
    male: Number(body.male) || 0,
    female: Number(body.female) || 0,
    roomBlock: cleanBlock,
    billingType: ['master', 'individual', 'split'].includes(body.billingType) ? body.billingType : 'master',
    advanceAmount,
    advancePaymentMode: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].includes(body.advancePaymentMode)
      ? body.advancePaymentMode : '',
    advanceTransactionId: body.advanceTransactionId || '',
  };

  const created = [];
  let idx = 0;
  for (const b of roomBlock) {
    const qty = Number(b.qty) || 0;
    const perBase = Number(b.baseAmount) || (Number(b.rate) || 0) * nights;
    const perGst = Number(b.gstAmount) || 0;
    const perTotal = Number(b.totalAmount) || perBase + perGst;
    const paxTotal = Number(b.pax) || 0;

    for (let k = 0; k < qty; k++) {
      const isMaster = idx === 0;
      // Spread the block's pax across its rooms (min 1 adult per room).
      const adults = qty > 0
        ? Math.max(1, Math.floor(paxTotal / qty) + (k < paxTotal % qty ? 1 : 0))
        : 1;

      const customerId = await generateCustomerId(coordinator.guestName, checkInDate, idx);
      const invoiceNumber = await generateInvoiceNumber(coordinator.guestName, checkInDate);

      const booking = new Booking({
        guestName: coordinator.guestName,
        email: coordinator.email,
        phone: coordinator.phone,
        roomId: null,
        roomType: b.roomType,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        checkInTime: body.arrivalTime || defaultCheckInTime,
        checkOutTime: body.departureTime || defaultCheckOutTime,
        adults: adults || 1,
        children: 0,
        baseAmount: perBase,
        gstAmount: perGst,
        totalAmount: perTotal,
        bookingStatus: status,
        specialRequests: body.specialRequests || '',
        bookingType: 'group',
        groupId,
        groupName: groupName || `${coordinator.guestName}'s group`,
        isGroupMaster: isMaster,
        groupTotalAmount: isMaster ? groupTotalAmount : 0,
        groupRoomCount: isMaster ? totalRooms : 0,
        groupDetails: isMaster ? groupDetails : undefined,
        paidAmount: isMaster ? advanceAmount : 0,
        remainingAmount: isMaster ? Math.max(0, groupTotalAmount - advanceAmount) : 0,
        paymentMethod: isMaster ? mapAdvanceMode(body.advancePaymentMode) : '',
        paymentStatus: isMaster && advanceAmount > 0 ? 'Partial' : 'Pending',
        customerId,
        invoiceNumber,
      });
      created.push(await booking.save());
      idx++;
    }
  }

  const populated = await Booking.find({ groupId });
  for (const b of populated) await syncRoomBookingIncome(b); // posts the master's advance as income
  return res.status(201).json({
    success: true,
    data: { groupId, groupName: groupName || `${coordinator.guestName}'s group`, bookings: populated, totalRooms },
    message: `Group "${groupName || coordinator.guestName}" created — ${totalRooms} room(s) blocked across ${cleanBlock.length} type(s)`,
  });
};

// ── Create a group booking (one coordinator, several rooms, one folio) ──────
// Body: {
//   coordinator: { guestName, phone, email, ... shared guest fields },
//   groupName, checkIn, checkOut, checkInTime, checkOutTime,
//   roomBlock: [{ roomType, qty, rate, pax, baseAmount, gstAmount, totalAmount }],  // new: block flow
//   rooms: [{ roomId, guestName?, adults?, children?, baseAmount, gstAmount, totalAmount }],  // legacy: per-room
//   groupType, billingType, advanceAmount, advancePaymentMode, advanceTransactionId,
//   adults, children, male, female, arrivalTime, departureTime,
//   bookingStatus, specialRequests, paymentMethod
// }
export const createGroupBooking = async (req, res) => {
  try {
    const body = req.body || {};
    const { coordinator = {}, groupName, checkIn, checkOut } = body;
    const rooms = Array.isArray(body.rooms) ? body.rooms : [];
    const roomBlock = Array.isArray(body.roomBlock)
      ? body.roomBlock.filter((b) => b && b.roomType && Number(b.qty) > 0)
      : [];

    if (!coordinator.guestName || !coordinator.phone) {
      return res.status(400).json({ success: false, message: 'Coordinator name and phone are required' });
    }
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'Check-in and check-out dates are required' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // New flow: block inventory by room type/qty. Falls through to the legacy
    // per-room flow when no roomBlock is supplied.
    if (roomBlock.length > 0) {
      return await createGroupFromRoomBlock(res, {
        body, coordinator, groupName, checkInDate, checkOutDate, roomBlock,
      });
    }

    if (rooms.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one room for the group' });
    }

    // Validate every room id and fetch the room docs up front.
    const roomDocs = [];
    for (const r of rooms) {
      if (!r.roomId || !mongoose.Types.ObjectId.isValid(r.roomId)) {
        return res.status(400).json({ success: false, message: 'One or more rooms have an invalid id' });
      }
      const roomDoc = await Room.findById(r.roomId);
      if (!roomDoc) {
        return res.status(404).json({ success: false, message: `Room ${r.roomId} not found` });
      }
      roomDocs.push(roomDoc);
    }

    // Reject if any room is reserved for a banquet event on these dates.
    const banquetBlocked = await getBanquetBlockedRoomIds(checkInDate, checkOutDate);
    const clash = roomDocs.find((rd) => banquetBlocked.has(rd._id.toString()));
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `Room ${clash.roomNumber} is reserved for a banquet event on these dates.`,
      });
    }

    const groupId = `GRP-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    const status = body.bookingStatus || 'Pending';
    const groupTotalAmount = rooms.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const { defaultCheckInTime, defaultCheckOutTime } = await getBilling();

    // Upsert the coordinator into the Guest collection once.
    await upsertGuest({
      name: coordinator.guestName,
      email: coordinator.email,
      phone: coordinator.phone,
      gender: coordinator.gender,
      age: coordinator.age,
      nationality: coordinator.nationality,
    });

    const created = [];
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const roomDoc = roomDocs[i];
      const isMaster = i === 0;
      const occupantName = (r.guestName && r.guestName.trim()) || coordinator.guestName;

      const customerId = await generateCustomerId(coordinator.guestName, checkInDate, i);
      const invoiceNumber = await generateInvoiceNumber(occupantName, checkInDate);

      const booking = new Booking({
        guestName: occupantName,
        email: coordinator.email,
        phone: coordinator.phone,
        gender: coordinator.gender,
        age: coordinator.age,
        nationality: coordinator.nationality,
        idCardType: coordinator.idCardType,
        idCardNumber: coordinator.idCardNumber,
        streetName: coordinator.streetName,
        area: coordinator.area,
        district: coordinator.district,
        state: coordinator.state,
        pincode: coordinator.pincode,

        roomId: roomDoc._id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        checkInTime: body.checkInTime || defaultCheckInTime,
        checkOutTime: body.checkOutTime || defaultCheckOutTime,
        adults: Number(r.adults) || 1,
        children: Number(r.children) || 0,

        baseAmount: Number(r.baseAmount) || 0,
        gstAmount: Number(r.gstAmount) || 0,
        totalAmount: Number(r.totalAmount) || 0,
        paymentMethod: body.paymentMethod || '',
        paymentStatus: 'Pending',

        bookingStatus: status,
        specialRequests: body.specialRequests || '',

        bookingType: 'group',
        groupId,
        groupName: groupName || `${coordinator.guestName}'s group`,
        isGroupMaster: isMaster,
        groupTotalAmount: isMaster ? groupTotalAmount : 0,
        groupRoomCount: isMaster ? rooms.length : 0,

        checkedIn: body.checkedIn === true,
        checkedInAt: body.checkedIn === true ? new Date() : null,

        customerId,
        invoiceNumber,
      });

      const saved = await booking.save();

      // Occupy each room only if the whole party is checked in on arrival.
      // By default a group is a reservation — rooms stay available until each
      // guest physically checks in.
      if (body.checkedIn === true) {
        await Room.findByIdAndUpdate(roomDoc._id, { status: 'occupied', isAvailable: false });
      }
      created.push(saved);
    }

    const populated = await Booking.find({ groupId }).populate('roomId');
    for (const b of populated) await syncRoomBookingIncome(b); // posts the master's advance as income
    return res.status(201).json({
      success: true,
      data: { groupId, groupName: groupName || `${coordinator.guestName}'s group`, bookings: populated },
      message: `Group booking created — ${created.length} room(s)`,
    });
  } catch (error) {
    console.error('Error creating group booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create group booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Create a company / corporate booking ────────────────────────────────────
// Several employee bookings share one groupId (CMP-…), bookingType='company'.
// Rooms are blocked by requirement (type/qty, roomId=null, assigned later). The
// master booking carries companyDetails (contacts, employees, credit terms) and
// the advance; the `company` sub-object is copied to every booking for invoices.
// Body: {
//   company: { name, companyType, gstNumber, pan, billingAddress, creditLimit },
//   primaryContact: { name, designation, phone, email }, alternateContact: { name, phone },
//   employees: [{ name, mobile, email, employeeId, department, designation }],
//   roomRequirement: [{ roomType, qty, rate, baseAmount, gstAmount, totalAmount }],
//   checkIn, checkOut, arrivalTime, departureTime,
//   payBy, creditType, creditDays, poNumber, referenceNumber, gstInvoice,
//   advanceAmount, advancePaymentMode, advanceTransactionId, bookingStatus, specialRequests
// }
export const createCompanyBooking = async (req, res) => {
  try {
    const body = req.body || {};
    const company = body.company || {};
    const primaryContact = body.primaryContact || {};
    const { checkIn, checkOut } = body;
    const roomRequirement = Array.isArray(body.roomRequirement)
      ? body.roomRequirement.filter((b) => b && b.roomType && Number(b.qty) > 0)
      : [];

    if (!company.name || !company.name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }
    if (!primaryContact.name || !primaryContact.phone) {
      return res.status(400).json({ success: false, message: 'Primary contact name and phone are required' });
    }
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'Check-in and check-out dates are required' });
    }
    if (roomRequirement.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one room requirement' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.max(1, calculateNights(checkInDate, checkOutDate) || 1);

    // Availability: enough free rooms of each required type for the window.
    const allRooms = await Room.find({ status: { $ne: 'maintenance' } });
    const overlapping = await Booking.find({
      $and: [
        { checkIn: { $lt: checkOutDate } },
        { checkOut: { $gt: checkInDate } },
        { bookingStatus: { $in: ACTIVE_HOLD_STATUSES } },
        { roomId: { $ne: null } },
      ],
    });
    const bookedRoomIds = new Set(overlapping.map((b) => b.roomId.toString()));
    const banquetBlocked = await getBanquetBlockedRoomIds(checkInDate, checkOutDate);
    const freeByType = {};
    for (const r of allRooms) {
      const id = r._id.toString();
      if (bookedRoomIds.has(id) || banquetBlocked.has(id)) continue;
      freeByType[r.type] = (freeByType[r.type] || 0) + 1;
    }
    for (const b of roomRequirement) {
      const free = freeByType[b.roomType] || 0;
      if (Number(b.qty) > free) {
        return res.status(409).json({
          success: false,
          message: `Only ${free} "${b.roomType}" room(s) free for these dates (you need ${b.qty}).`,
        });
      }
    }

    const groupId = `CMP-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    const status = body.bookingStatus || 'Confirmed';
    const { defaultCheckInTime, defaultCheckOutTime } = await getBilling();
    const employees = Array.isArray(body.employees)
      ? body.employees.filter((e) => e && (e.name || '').trim())
      : [];

    // Upsert the primary contact into the Guest collection.
    await upsertGuest({ name: primaryContact.name, email: primaryContact.email, phone: primaryContact.phone });

    const advanceAmount = Math.max(0, Number(body.advanceAmount) || 0);
    const companySub = {
      name: company.name,
      companyType: ['Corporate', 'Travel Agent', 'Government', 'Local Business', 'Other'].includes(company.companyType)
        ? company.companyType : '',
      gstNumber: company.gstNumber || '',
      pan: company.pan || '',
      billingAddress: company.billingAddress || '',
      creditLimit: Number(company.creditLimit) || 0,
      contactPerson: primaryContact.name || '',
      contactPhone: primaryContact.phone || '',
      contactEmail: primaryContact.email || '',
    };

    const cleanReq = roomRequirement.map((b) => ({ roomType: b.roomType, qty: Number(b.qty) || 0, rate: Number(b.rate) || 0 }));
    const totalRooms = cleanReq.reduce((s, b) => s + b.qty, 0);
    const groupTotalAmount = roomRequirement.reduce(
      (sum, b) => sum + (Number(b.totalAmount) || 0) * (Number(b.qty) || 0), 0,
    );

    const companyDetails = {
      primaryContact: {
        name: primaryContact.name || '', designation: primaryContact.designation || '',
        phone: primaryContact.phone || '', email: primaryContact.email || '',
      },
      alternateContact: { name: body.alternateContact?.name || '', phone: body.alternateContact?.phone || '' },
      employees: employees.map((e) => ({
        name: e.name || '', mobile: e.mobile || '', email: e.email || '',
        employeeId: e.employeeId || '', department: e.department || '', designation: e.designation || '',
      })),
      roomRequirement: cleanReq,
      payBy: ['guest', 'company', 'split'].includes(body.payBy) ? body.payBy : 'company',
      creditType: ['advance', 'credit'].includes(body.creditType) ? body.creditType : 'advance',
      creditDays: Number(body.creditDays) || 0,
      poNumber: body.poNumber || '',
      referenceNumber: body.referenceNumber || '',
      gstInvoice: body.gstInvoice === true,
      advanceAmount,
      advancePaymentMode: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].includes(body.advancePaymentMode)
        ? body.advancePaymentMode : '',
      advanceTransactionId: body.advanceTransactionId || '',
    };

    // ── Company account link + credit (Phase 2) ──────────────────────────────
    const onCredit = companyDetails.creditType === 'credit';
    let companyDoc = null;
    if (body.companyId && mongoose.Types.ObjectId.isValid(body.companyId)) {
      companyDoc = await Company.findById(body.companyId);
    }
    // Optionally persist/refresh the company profile (incl. contract rates).
    if (body.saveCompany) {
      const profile = {
        name: company.name,
        companyType: companySub.companyType,
        gstNumber: companySub.gstNumber,
        pan: companySub.pan,
        billingAddress: companySub.billingAddress,
        creditLimit: Number(company.creditLimit) || 0,
        creditDays: Number(body.creditDays) || 0,
        primaryContact: companyDetails.primaryContact,
        alternateContact: companyDetails.alternateContact,
        contractRates: cleanReq.map((r) => ({ roomType: r.roomType, rate: r.rate })),
      };
      if (!companyDoc) companyDoc = await Company.findOne({ name: company.name });
      if (companyDoc) { Object.assign(companyDoc, profile); await companyDoc.save(); }
      else { companyDoc = await Company.create(profile); }
    }
    // Enforce the credit limit before committing the bookings.
    if (onCredit && companyDoc) {
      const available = (companyDoc.creditLimit || 0) - (companyDoc.creditUsed || 0);
      if (groupTotalAmount > available) {
        return res.status(409).json({
          success: false,
          message: `Booking total ${Math.round(groupTotalAmount)} exceeds available credit ${Math.round(available)} for ${companyDoc.name}.`,
        });
      }
    }
    if (companyDoc) companySub.ref = companyDoc._id;

    let idx = 0;
    for (const b of roomRequirement) {
      const qty = Number(b.qty) || 0;
      const perBase = Number(b.baseAmount) || (Number(b.rate) || 0) * nights;
      const perGst = Number(b.gstAmount) || 0;
      const perTotal = Number(b.totalAmount) || perBase + perGst;

      for (let k = 0; k < qty; k++) {
        const isMaster = idx === 0;
        const occupant = (employees[idx]?.name || '').trim() || primaryContact.name;
        const customerId = await generateCustomerId(company.name, checkInDate, idx);
        const invoiceNumber = await generateInvoiceNumber(occupant, checkInDate);

        const booking = new Booking({
          guestName: occupant,
          email: employees[idx]?.email || primaryContact.email || '',
          phone: employees[idx]?.mobile || primaryContact.phone,
          roomId: null,
          roomType: b.roomType,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          checkInTime: body.arrivalTime || defaultCheckInTime,
          checkOutTime: body.departureTime || defaultCheckOutTime,
          adults: 1,
          children: 0,
          baseAmount: perBase,
          gstAmount: perGst,
          totalAmount: perTotal,
          bookingStatus: status,
          specialRequests: body.specialRequests || '',
          bookingType: 'company',
          groupId,
          groupName: company.name,
          isGroupMaster: isMaster,
          groupTotalAmount: isMaster ? groupTotalAmount : 0,
          groupRoomCount: isMaster ? totalRooms : 0,
          company: companySub,
          companyDetails: isMaster ? companyDetails : undefined,
          paidAmount: isMaster ? advanceAmount : 0,
          remainingAmount: isMaster ? Math.max(0, groupTotalAmount - advanceAmount) : 0,
          paymentMethod: isMaster ? mapAdvanceMode(body.advancePaymentMode) : '',
          paymentStatus: isMaster && advanceAmount > 0 ? 'Partial' : 'Pending',
          customerId,
          invoiceNumber,
        });
        await booking.save();
        idx++;
      }
    }

    // Draw down the company's credit once the bookings are committed.
    if (onCredit && companyDoc) {
      companyDoc.creditUsed = (companyDoc.creditUsed || 0) + groupTotalAmount;
      await companyDoc.save();
    }

    const populated = await Booking.find({ groupId });
    for (const b of populated) await syncRoomBookingIncome(b); // posts the master's advance as income
    return res.status(201).json({
      success: true,
      data: { groupId, companyName: company.name, bookings: populated, totalRooms, companyId: companyDoc?._id || null },
      message: `Company booking "${company.name}" created — ${totalRooms} room(s)`,
    });
  } catch (error) {
    console.error('Error creating company booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create company booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Rooming list: fetch every booking in a cluster (group or company) ────────
export const getGroupBookings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const bookings = await Booking.find({ groupId })
      .populate('roomId')
      .sort({ isGroupMaster: -1, createdAt: 1 });
    if (!bookings.length) {
      return res.status(404).json({ success: false, message: 'No bookings found for this group' });
    }
    return res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error fetching group bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch group bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Rooming list: assign (or clear) a specific room on a booking slot ─────────
// Body: { roomId|null, guestName?, sharing?, idCardType?, idCardNumber? }
export const assignRoom = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { roomId, guestName, sharing, idCardType, idCardNumber } = req.body || {};

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ success: false, message: 'Invalid room id' });
      }
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      // No other active booking may overlap this room for the stay window.
      const clash = await Booking.findOne({
        _id: { $ne: booking._id },
        roomId: room._id,
        bookingStatus: { $in: ACTIVE_HOLD_STATUSES },
        checkIn: { $lt: booking.checkOut },
        checkOut: { $gt: booking.checkIn },
      });
      if (clash) {
        return res.status(409).json({ success: false, message: `Room ${room.roomNumber} is already booked for these dates.` });
      }
      const banquetBlocked = await getBanquetBlockedRoomIds(booking.checkIn, booking.checkOut);
      if (banquetBlocked.has(room._id.toString())) {
        return res.status(409).json({ success: false, message: `Room ${room.roomNumber} is reserved for a banquet event.` });
      }
      booking.roomId = room._id;
      booking.roomType = room.type;
    } else if (roomId === null) {
      booking.roomId = null;
    }

    if (guestName !== undefined) booking.guestName = guestName;
    if (sharing !== undefined) booking.sharing = sharing;
    if (idCardType) booking.idCardType = idCardType;       // enum has no "", so only set when provided
    if (idCardNumber !== undefined) booking.idCardNumber = idCardNumber;

    await booking.save();
    await booking.populate('roomId');
    return res.json({ success: true, data: booking, message: 'Rooming list updated' });
  } catch (error) {
    console.error('Error assigning room:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign room',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Rooming list: append one more room/guest to an existing cluster ──────────
// Body: { roomType, rate?, pax?, guestName?, baseAmount?, gstAmount?, totalAmount? }
export const addRoomToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const body = req.body || {};
    if (!body.roomType) {
      return res.status(400).json({ success: false, message: 'Room type is required' });
    }

    const cluster = await Booking.find({ groupId });
    if (!cluster.length) {
      return res.status(404).json({ success: false, message: 'No bookings found for this group' });
    }
    const master = cluster.find((b) => b.isGroupMaster) || cluster[0];

    const nights = Math.max(1, calculateNights(master.checkIn, master.checkOut) || 1);
    const base = Number(body.baseAmount) || (Number(body.rate) || 0) * nights;
    const gst = Number(body.gstAmount) || 0;
    const total = Number(body.totalAmount) || base + gst;
    const occupant = (body.guestName || '').trim() || master.guestName;

    const customerId = await generateCustomerId(master.groupName || occupant, master.checkIn, cluster.length);
    const invoiceNumber = await generateInvoiceNumber(occupant, master.checkIn);

    const booking = new Booking({
      guestName: occupant,
      email: master.email,
      phone: master.phone,
      roomId: null,
      roomType: body.roomType,
      checkIn: master.checkIn,
      checkOut: master.checkOut,
      checkInTime: master.checkInTime,
      checkOutTime: master.checkOutTime,
      adults: Number(body.pax) || 1,
      children: 0,
      baseAmount: base,
      gstAmount: gst,
      totalAmount: total,
      bookingStatus: master.bookingStatus,
      bookingType: master.bookingType,
      groupId,
      groupName: master.groupName,
      isGroupMaster: false,
      company: master.company,
      customerId,
      invoiceNumber,
    });
    await booking.save();

    // Keep the master's roll-up totals in sync.
    master.groupRoomCount = (master.groupRoomCount || 0) + 1;
    master.groupTotalAmount = (master.groupTotalAmount || 0) + total;
    master.remainingAmount = Math.max(0, (master.groupTotalAmount || 0) - (master.paidAmount || 0));
    await master.save();

    const updated = await Booking.find({ groupId })
      .populate('roomId')
      .sort({ isGroupMaster: -1, createdAt: 1 });
    return res.status(201).json({ success: true, data: updated, message: 'Guest added to group' });
  } catch (error) {
    console.error('Error adding room to group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add guest',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Advance a group/company cluster through its status workflow ───────────────
// Body: { status }. Moves every booking in the cluster to the new status,
// enforcing the allowed transitions from the master's current status.
export const updateGroupStatus = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    const bookings = await Booking.find({ groupId });
    if (!bookings.length) {
      return res.status(404).json({ success: false, message: 'No bookings found for this group' });
    }

    const current = (bookings.find((b) => b.isGroupMaster) || bookings[0]).bookingStatus;
    if (current === status) {
      return res.status(400).json({ success: false, message: `Already ${status}` });
    }
    const allowed = STATUS_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from "${current}" to "${status}".`,
      });
    }

    await Booking.updateMany({ groupId }, { $set: { bookingStatus: status } });

    // Release a company's reserved credit when its booking is cancelled.
    if (status === 'Cancelled') {
      const master = bookings.find((b) => b.isGroupMaster) || bookings[0];
      if (master.bookingType === 'company' && master.company?.ref && master.companyDetails?.creditType === 'credit') {
        const companyDoc = await Company.findById(master.company.ref);
        if (companyDoc) {
          companyDoc.creditUsed = Math.max(0, (companyDoc.creditUsed || 0) - (master.groupTotalAmount || 0));
          await companyDoc.save();
        }
      }
    }

    const updated = await Booking.find({ groupId })
      .populate('roomId')
      .sort({ isGroupMaster: -1, createdAt: 1 });
    return res.json({
      success: true,
      data: updated,
      message: `Group moved to "${status}" (${updated.length} room/s)`,
    });
  } catch (error) {
    console.error('Error updating group status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update group status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// ── Transfer a guest to a different room mid-stay ───────────────────────────
// Body: { toRoomId, reason?, priceAdjustment? }
// Keeps the same booking/folio, frees the old room, occupies the new one, and
// appends an entry to transferHistory.
export const transferRoom = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { toRoomId, reason = '', priceAdjustment = 0 } = req.body || {};

    if (!toRoomId || !mongoose.Types.ObjectId.isValid(toRoomId)) {
      return res.status(400).json({ success: false, message: 'A valid destination room is required' });
    }

    const booking = await Booking.findById(bookingId).populate('roomId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const fromRoom = booking.roomId && booking.roomId._id
      ? booking.roomId
      : await Room.findById(booking.roomId);
    if (fromRoom && fromRoom._id.toString() === toRoomId) {
      return res.status(400).json({ success: false, message: 'Guest is already in that room' });
    }

    const toRoom = await Room.findById(toRoomId);
    if (!toRoom) {
      return res.status(404).json({ success: false, message: 'Destination room not found' });
    }

    // The destination room must be free for this booking's stay window.
    const overlap = await Booking.findOne({
      _id: { $ne: booking._id },
      roomId: toRoom._id,
      bookingStatus: { $in: ['Confirmed', 'Pending'] },
      checkIn: { $lt: booking.checkOut },
      checkOut: { $gt: booking.checkIn },
    });
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Room ${toRoom.roomNumber} is occupied for an overlapping stay.`,
      });
    }

    // Block transfer into a banquet-reserved room.
    const blocked = await getBanquetBlockedRoomIds(booking.checkIn, booking.checkOut);
    if (blocked.has(toRoom._id.toString())) {
      return res.status(409).json({
        success: false,
        message: `Room ${toRoom.roomNumber} is reserved for a banquet event on these dates.`,
      });
    }

    const adjustment = Number(priceAdjustment) || 0;

    booking.transferHistory.push({
      fromRoomId: fromRoom?._id,
      fromRoomNumber: fromRoom?.roomNumber || '',
      toRoomId: toRoom._id,
      toRoomNumber: toRoom.roomNumber,
      reason,
      priceAdjustment: adjustment,
      transferredAt: new Date(),
    });
    booking.roomId = toRoom._id;
    if (adjustment) {
      booking.totalAmount = Math.max(0, (Number(booking.totalAmount) || 0) + adjustment);
    }
    await booking.save();

    // Free the old room (cleaning), occupy the new one — only if the guest is
    // actually in residence (Confirmed). Pending bookings leave rooms bookable.
    if (booking.bookingStatus === 'Confirmed') {
      if (fromRoom?._id) {
        await Room.findByIdAndUpdate(fromRoom._id, { status: 'cleaning', isAvailable: false });
      }
      await Room.findByIdAndUpdate(toRoom._id, { status: 'occupied', isAvailable: false });
    }

    const populated = await Booking.findById(booking._id).populate('roomId');
    return res.json({
      success: true,
      data: populated,
      message: `Guest moved to room ${toRoom.roomNumber}`,
    });
  } catch (error) {
    console.error('Error transferring room:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to transfer room',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};
