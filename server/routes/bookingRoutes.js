import express from 'express';
import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Housekeeping from '../models/Housekeeping.js';
import { emitHousekeepingTask } from '../config/socket.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES modules don't have __dirname — derive it. Without this, multer's
// diskStorage destination threw "__dirname is not defined" on every file
// upload, 500-ing any booking that attached an ID image.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ID_CARD_DIR = path.join(__dirname, '../uploads/id-cards');
fs.mkdirSync(ID_CARD_DIR, { recursive: true }); // ensure the folder exists
import { createBooking, getBookings, getBookingById, updateBooking, deleteBooking, checkInGuest, getCheckedOutBookings, generateMissingInvoiceNumbers, createGroupBooking, createCompanyBooking, getGroupBookings, assignRoom, updateGroupStatus, addRoomToGroup, transferRoom } from '../controllers/bookingController.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { getBanquetBlockedRoomIds } from '../controllers/roomController.js';
const isAuthenticated = authenticateToken;

// Malformed :id -> 400 instead of a Mongoose CastError 500 (all /:id routes use Booking.findById).
router.param('id', objectIdParam('booking ID'));

// Configure storage for ID card images
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, ID_CARD_DIR);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'id-card-' + uniqueSuffix + ext);
  }
});

// Create upload middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    // If no file is provided, allow the request to proceed
    if (!file) {
      return cb(null, true);
    }
    
    // Accept images only when file is provided
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Accept an ID document as front + back images (Aadhaar has the address on the
// reverse). Both fields are optional.
const uploadFields = upload.fields([
  { name: 'idCardImage', maxCount: 1 },
  { name: 'idCardImageBack', maxCount: 1 },
]);

// Check room availability (no auth for extended tests)
router.get('/availability', async (req, res) => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required'
      });
    }
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Find rooms that are not booked during the requested period
    const bookedRooms = await Booking.find({
      $and: [
        {
          $or: [
            { checkIn: { $lte: checkOutDate }, checkOut: { $gte: checkInDate } }
          ]
        },
        { bookingStatus: { $in: ['Confirmed', 'Pending'] } }
      ]
    }).distinct('roomId');
    
    const availableRooms = await Room.find({
      _id: { $nin: bookedRooms },
      isAvailable: true,
      ...(guests && { "capacity.adults": { $gte: parseInt(guests, 10) } })
    });
    
    res.json({
      success: true,
      data: {
        availableRooms,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalAvailable: availableRooms.length
      },
      message: 'Room availability checked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking room availability',
      error: error.message
    });
  }
});

// Rooms held by a banquet/marriage event over a stay window. The booking form
// uses this to grey out event-reserved rooms so staff can't pick one that the
// server would then reject with a 409. Defined before /:id so it isn't read as an id.
router.get('/banquet-blocked', isAuthenticated, async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'checkIn and checkOut are required' });
    }
    const blocked = await getBanquetBlockedRoomIds(new Date(checkIn), new Date(checkOut));
    res.json({ success: true, blockedRoomIds: [...blocked] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List all bookings
 *     responses:
 *       200:
 *         description: Array of bookings (room populated with number & type).
 *       401:
 *         description: Missing or invalid token.
 */
// Get all bookings
router.get('/', isAuthenticated, getBookings);

// Get checked-out bookings
router.get('/checked-out', isAuthenticated, getCheckedOutBookings);

// Generate missing invoice numbers for existing bookings
router.post('/generate-invoice-numbers', isAuthenticated, requireManage('manage_bookings'), generateMissingInvoiceNumbers);

// Get bookings by date range
router.get('/range', isAuthenticated, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    const bookings = await Booking.find({
      $or: [
        // Check-in date falls within range
        { checkIn: { $gte: startDate, $lte: endDate } },
        // Check-out date falls within range
        { checkOut: { $gte: startDate, $lte: endDate } },
        // Booking spans the entire range
        { $and: [{ checkIn: { $lte: startDate } }, { checkOut: { $gte: endDate } }] }
      ]
    }).sort({ checkIn: 1 });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings by date range:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new booking
router.post('/', isAuthenticated, requireManage('manage_bookings'), uploadFields, createBooking);

// Create a group booking (one coordinator, several rooms, one master folio)
router.post('/group', isAuthenticated, requireManage('manage_bookings'), createGroupBooking);

// Create a company / corporate booking (employee bookings under one company)
router.post('/company', isAuthenticated, requireManage('manage_bookings'), createCompanyBooking);

// Rooming list — fetch a group/company cluster, assign a room to a slot
router.get('/group/:groupId', isAuthenticated, getGroupBookings);
router.patch('/group/:groupId/status', isAuthenticated, requireManage('manage_bookings'), updateGroupStatus);
router.post('/group/:groupId/room', isAuthenticated, requireManage('manage_bookings'), addRoomToGroup);
router.patch('/:id/assign-room', isAuthenticated, requireManage('manage_bookings'), assignRoom);

// Transfer a guest to a different room mid-stay
router.post('/:id/transfer', isAuthenticated, requireManage('manage_bookings'), transferRoom);

// Check-in booking
router.put('/:id/checkin', isAuthenticated, requireManage('manage_bookings'), checkInGuest);

/**
 * @openapi
 * /api/bookings/{id}/checkout:
 *   put:
 *     tags: [Bookings]
 *     summary: Check a guest out and free the room
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Guest checked out.
 *       404:
 *         description: Booking not found.
 */
// Check-out booking
router.put('/:id/checkout', isAuthenticated, requireManage('manage_bookings'), async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking not found' 
      });
    }
    
    // Mark checked out — clears physical presence.
    booking.bookingStatus = 'Completed';
    booking.checkedIn = false;
    booking.checkedOutAt = new Date();
    await booking.save();

    // Checkout → room needs cleaning before it can be re-let. Move it into the
    // cleaning state, create a de-duplicated housekeeping task, and notify
    // housekeeping in real time. Mirrors the updateBooking checkout path.
    const room = await Room.findByIdAndUpdate(
      booking.roomId,
      { status: 'cleaning', isAvailable: false },
      { returnDocument: 'after' }
    );
    try {
      const task = await Housekeeping.ensureCleaningTask({
        roomId: booking.roomId,
        source: 'checkout_booking',
        notes: 'Room requires cleaning after guest checkout.',
      });
      emitHousekeepingTask(task, room);
    } catch (taskError) {
      console.error('Error creating housekeeping task on checkout:', taskError);
    }

    res.json({
      success: true,
      message: 'Guest checked out successfully',
      data: booking
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to check out guest', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update a booking
router.put('/:id', isAuthenticated, requireManage('manage_bookings'), uploadFields, updateBooking);

// Get booking by ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete booking
router.delete('/:id', isAuthenticated, requireManage('manage_bookings'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Get the room associated with this booking
    const room = await Room.findById(booking.roomId);
    if (room) {
      // Update room status to available
      room.status = 'available';
      room.isAvailable = true;
      await room.save();
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json({ 
      message: 'Booking deleted successfully',
      roomUpdated: !!room
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
