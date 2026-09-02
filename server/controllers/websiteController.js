import crypto from 'crypto';
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
import { getBilling, roomGst } from '../config/operationalConfig.js';
import { priceOrder, OrderPricingError } from '../services/orderPricing.js';
import { getBanquetBlockedRoomIds } from './roomController.js';
import { getInventorySnapshot, availabilityByType, canReserve } from '../services/inventory.js';

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
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      eventDuration,
      specialRequirements: notes || '',
      status: 'Pending',
      paymentStatus: 'Pending',
      source: 'website',
    });

    await booking.save();
    res.status(201).json({ success: true, data: booking, message: 'Banquet booking created successfully' });
  } catch (error) {
    console.error('Error creating banquet booking:', error);
    res.status(500).json({ message: 'Error creating banquet booking', error: error.message });
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
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    console.error('Error getting room details:', error);
    res.status(500).json({ message: 'Error getting room details' });
  }
};

const generateUniqueCustomerId = async (guestName, checkInDate) => {
  const nameParts = guestName.trim().split(' ');
  const firstInitial = nameParts[0]?.[0]?.toUpperCase() || '';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
  const initials = firstInitial + lastInitial;

  const checkIn = new Date(checkInDate);
  const yyyy = checkIn.getFullYear();
  const mm = String(checkIn.getMonth() + 1).padStart(2, '0');
  const dd = String(checkIn.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  let seq = 1001;
  for (let attempt = 0; attempt < 10; attempt++) {
    const dayStart = new Date(checkIn);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkIn);
    dayEnd.setHours(23, 59, 59, 999);

    const bookingsForDay = await Booking.find({
      checkIn: { $gte: dayStart, $lte: dayEnd },
    }).sort({ createdAt: -1 });

    if (bookingsForDay.length > 0) {
      let maxSeq = 1000;
      for (const b of bookingsForDay) {
        const m = b.customerId?.match(/(\d{4})$/);
        if (m) {
          const currentSeq = parseInt(m[1]);
          if (!isNaN(currentSeq) && currentSeq > maxSeq) maxSeq = currentSeq;
        }
      }
      seq = maxSeq + 1;
    }

    const customerId = `${initials}${dateStr}${seq}`;
    const exists = await Booking.findOne({ customerId });
    if (!exists) return customerId;
    seq++;
  }

  return `${initials}${dateStr}${seq}`;
};

const generateUniqueInvoiceNumber = async () => {
  const { invoicePrefix } = await getBilling();
  const seqRegex = new RegExp(`^${invoicePrefix}-(\\d+)$`);
  let invoiceSeq = 1001;
  for (let attempt = 0; attempt < 10; attempt++) {
    const latest = await Booking.find({ invoiceNumber: { $regex: seqRegex } })
      .sort({ invoiceNumber: -1 })
      .limit(10);

    if (latest.length > 0) {
      let maxSeq = 1000;
      for (const b of latest) {
        const m = b.invoiceNumber?.match(seqRegex);
        if (m) {
          const s = parseInt(m[1]);
          if (!isNaN(s) && s > maxSeq) maxSeq = s;
        }
      }
      invoiceSeq = maxSeq + 1;
    }

    const invoiceNumber = `${invoicePrefix}-${invoiceSeq}`;
    const exists = await Booking.findOne({ invoiceNumber });
    if (!exists) return invoiceNumber;
    invoiceSeq++;
  }
  return `${invoicePrefix}-${invoiceSeq}`;
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
    if (bookingData.roomType) {
      const capacity = await canReserve(Room, {
        roomType: bookingData.roomType,
        count: bookingData.roomCount,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
      });
      if (!capacity.ok) {
        return res.status(409).json({
          message: capacity.available === 0
            ? `No "${bookingData.roomType}" rooms are available for these dates.`
            : `Only ${capacity.available} "${bookingData.roomType}" room(s) available for these dates (you asked for ${capacity.requested}).`,
          available: capacity.available,
        });
      }
    }

    // An "online" booking is only trusted as Paid after we verify the payment
    // server-side. Without this a crafted request could mark a booking Paid (and
    // post income) without ever paying, or confirm a large booking with a tiny
    // real payment. The client already sends the three Razorpay fields.
    if (bookingData.paymentMethod === 'online') {
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
          const expectedPaise = Math.round(Number(bookingData.totalAmount || 0) * 100);
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
    const customerId = await generateUniqueCustomerId(guestName, bookingData.checkIn);
    const invoiceNumber = await generateUniqueInvoiceNumber();
    const { defaultCheckInTime, defaultCheckOutTime } = await getBilling();

    // Website bookings reserve a category only — staff assign the specific room
    // at check-in. A roomId is set only if one was explicitly chosen.
    const assignedRoom = bookingData.roomId
      ? await Room.findById(bookingData.roomId).lean()
      : null;
    const roomType = assignedRoom?.type || bookingData.roomType || '';

    // If a specific room was chosen, don't let it be one reserved for a
    // banquet/marriage event over these dates.
    if (bookingData.roomId) {
      const banquetBlocked = await getBanquetBlockedRoomIds(new Date(bookingData.checkIn), new Date(bookingData.checkOut));
      if (banquetBlocked.has(String(bookingData.roomId))) {
        return res.status(409).json({
          message: 'This room is reserved for an event on the selected dates. Please choose different dates or another room.',
        });
      }
    }

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
      totalAmount: bookingData.totalAmount || 0,
      baseAmount: bookingData.baseAmount || 0,
      gstAmount: bookingData.gstAmount || 0,
      paidAmount: bookingData.paidAmount || 0,
      remainingAmount: bookingData.remainingAmount || 0,
      paymentStatus: bookingData.paymentMethod === 'online' ? 'Paid' : 'Pending',
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

    const booking = new Booking(mapped);
    await booking.save();

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
      message: 'Booking created successfully',
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Error creating booking', error: error.message });
  }
};

export const getBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ status: booking.status, booking });
  } catch (error) {
    console.error('Error getting booking status:', error);
    res.status(500).json({ message: 'Error getting booking status' });
  }
};

// ── Marketing / informational endpoints ───────────────────────────────────────

export const submitContact = async (req, res) => {
  try {
    console.log('Contact form submission:', req.body);
    res.json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ message: 'Error submitting contact form' });
  }
};

export const getSpecialOffers = async (_req, res) => {
  try {
    const offers = [
      {
        id: 1,
        title: 'Weekend Special',
        description: 'Get 20% off on weekend stays',
        discount: 20,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: 2,
        title: 'Extended Stay Discount',
        description: 'Stay for 7+ days and get 15% off',
        discount: 15,
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    ];
    res.json(offers);
  } catch (error) {
    console.error('Error getting special offers:', error);
    res.status(500).json({ message: 'Error getting special offers' });
  }
};

export const getHotelInfo = async (_req, res) => {
  try {
    const settings = await Settings.findOne();
    const hotelInfo = {
      name: 'Hotel Sandhya Grand',
      description: 'A luxurious hotel offering world-class amenities and exceptional service.',
      address: settings?.address || '123 Main Street, City, State 12345',
      phone: settings?.phone || '+1 (555) 123-4567',
      email: settings?.email || 'reservations@sandhyagrand.in',
      website: settings?.website || 'www.sandhyagrand.in',
      checkIn: '3:00 PM',
      checkOut: '11:00 AM',
      policies: [
        'Free WiFi throughout the hotel',
        'Complimentary breakfast',
        '24/7 front desk service',
        'Free parking available',
        'Pet-friendly rooms available',
      ],
    };
    res.json(hotelInfo);
  } catch (error) {
    console.error('Error getting hotel info:', error);
    res.status(500).json({ message: 'Error getting hotel info' });
  }
};

export const getGallery = async (_req, res) => {
  try {
    const gallery = [
      { id: 1, title: 'Luxury Suite', image: '/images/Room101.jpg', category: 'rooms' },
      { id: 2, title: 'Hotel Lobby', image: '/images/lobby.jpg', category: 'common-areas' },
      { id: 3, title: 'Restaurant', image: '/images/restaurant.jpg', category: 'dining' },
    ];
    res.json(gallery);
  } catch (error) {
    console.error('Error getting gallery:', error);
    res.status(500).json({ message: 'Error getting gallery' });
  }
};

export const getAmenities = async (_req, res) => {
  try {
    const amenities = [
      { id: 1, name: 'Free WiFi', description: 'High-speed internet access throughout the hotel', icon: 'wifi' },
      { id: 2, name: 'Swimming Pool', description: 'Outdoor swimming pool with sun loungers', icon: 'pool' },
      { id: 3, name: 'Fitness Center', description: '24/7 fitness center with modern equipment', icon: 'fitness' },
      { id: 4, name: 'Restaurant', description: 'Fine dining restaurant serving local and international cuisine', icon: 'restaurant' },
      { id: 5, name: 'Spa', description: 'Relaxing spa services and treatments', icon: 'spa' },
      { id: 6, name: 'Conference Room', description: 'Business meeting and conference facilities', icon: 'meeting' },
    ];
    res.json(amenities);
  } catch (error) {
    console.error('Error getting amenities:', error);
    res.status(500).json({ message: 'Error getting amenities' });
  }
};

export const getServices = async (_req, res) => {
  try {
    const services = [
      { id: 1, name: 'Room Service', description: '24/7 room service with a wide variety of options', available: true },
      { id: 2, name: 'Laundry Service', description: 'Professional laundry and dry cleaning services', available: true },
      { id: 3, name: 'Airport Shuttle', description: 'Complimentary airport shuttle service', available: true },
      { id: 4, name: 'Tour Guide', description: 'Local tour guide services for sightseeing', available: true },
      { id: 5, name: 'Car Rental', description: 'Car rental service with delivery to hotel', available: true },
    ];
    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
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
    const rooms = await Room.find({}).select(
      'roomNumber type capacity pricePerNight totalPrice amenities description floor status'
    );
    const billing = await getBilling();
    const formatted = rooms.map((room) => {
      // Expose the *base* nightly price to the website; the storefront adds
      // GST on top so it can show the breakdown to the guest.
      const basePrice = room.pricePerNight || 0;
      const isAvailable = room.status === 'available';
      return {
        _id: room._id,
        roomNumber: room.roomNumber,
        type: room.type.charAt(0).toUpperCase() + room.type.slice(1),
        capacity: room.capacity.adults + room.capacity.children,
        price: basePrice,
        pricePerNight: basePrice,
        totalPrice: room.totalPrice || basePrice + roomGst(basePrice, billing),
        amenities: room.amenities,
        description: room.description,
        floor: room.floor,
        // Pass the real status through (capitalised) plus an explicit flag so
        // the website can gate booking without re-deriving it from the string.
        status: room.status
          ? room.status.charAt(0).toUpperCase() + room.status.slice(1)
          : 'Available',
        isAvailable,
      };
    });
    res.json(formatted);
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
      const result = await findActiveBookingByRoomNumber(roomNumber);
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

const findActiveBookingByRoomNumber = async (rawNumber) => {
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
  const now = new Date();
  const booking = await Booking.findOne({
    roomId: room._id,
    bookingStatus: { $in: ['Confirmed', 'Pending'] },
    checkIn:  { $lte: now },
    checkOut: { $gte: now },
  }).sort({ checkIn: -1 });

  if (!booking) {
    return {
      error: {
        status: 404,
        message: `No active booking for room ${room.roomNumber} today. If you've just arrived, please ask the front desk to confirm your booking first.`,
      },
    };
  }
  return { room, booking };
};

export const getRoomServiceContext = async (req, res) => {
  try {
    const result = await findActiveBookingByRoomNumber(req.params.roomNumber);
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

    const result = await findActiveBookingByRoomNumber(req.params.roomNumber);
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
    const room = await Room.findOne({ roomNumber: req.params.roomNumber });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const booking = await Booking.findOne({
      roomId: room._id,
      checkIn: { $lte: new Date() },
      checkOut: { $gte: new Date() },
      bookingStatus: 'Confirmed',
    });
    if (!booking) return res.status(404).json({ message: 'No active booking found for this room' });

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
    const { amount, currency = 'INR', receipt } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount provided' });
    }
    const order = await paymentService.createOrder(amount, currency, receipt);
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      message: error.message || 'Failed to create payment order',
      error: error.message,
    });
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

export const processPayment = async (req, res) => {
  try {
    const {
      bookingData,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    const isValid = await paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const booking = new Booking({
      ...bookingData,
      paymentStatus: 'Paid',
      paymentMethod: 'online',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      paidAmount: bookingData.totalAmount,
    });
    await booking.save();

    // Online payment settled → record it in accounting as income.
    await syncRoomBookingIncome(booking);

    res.json({
      success: true,
      message: 'Payment processed and booking created successfully',
      bookingId: booking._id,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
};

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
