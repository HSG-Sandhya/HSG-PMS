import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Housekeeping from '../models/Housekeeping.js';
import Image from '../models/Image.js';
import BanquetBooking from '../models/BanquetBooking.js';
import { optimizeImage } from '../utils/imageOptimizer.js';
import { getBilling } from '../config/operationalConfig.js';
import { pctToFraction } from '../config/operationalDefaults.js';

// Room ids reserved by banquet/marriage events overlapping the given date range.
export const getBanquetBlockedRoomIds = async (checkInDate, checkOutDate) => {
  const banquetBookings = await BanquetBooking.find({
    status: { $ne: 'Cancelled' },
    rooms: { $exists: true, $ne: [] },
  }).select('rooms eventDate endDate');

  const blocked = new Set();
  for (const b of banquetBookings) {
    const start = new Date(b.eventDate);
    const end = b.endDate ? new Date(b.endDate) : new Date(b.eventDate);
    // Treat the event as occupying the whole of its last day
    end.setHours(23, 59, 59, 999);
    // Overlap test against the requested stay [checkIn, checkOut)
    if (start < checkOutDate && end > checkInDate) {
      (b.rooms || []).forEach((r) => blocked.add(r.toString()));
    }
  }
  return blocked;
};

const VALID_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning'];

// Seed GST/total on a room from the configured room GST rate (Billing & Tariff).
const applyGstDefaults = async (body) => {
  if (!body.pricePerNight) return;
  const { roomGstRate } = await getBilling();
  const gstFraction = pctToFraction(roomGstRate);
  if (!body.gstAmount) {
    body.gstAmount = body.pricePerNight * gstFraction;
  }
  if (!body.totalPrice) {
    body.totalPrice = body.pricePerNight * (1 + gstFraction);
  }
};

const handleStatusSideEffects = async (room, status) => {
  if (status === 'maintenance') {
    await Housekeeping.create({
      roomId: room._id,
      taskType: 'Maintenance',
      description: 'Room requires maintenance.',
      priority: 'High',
      status: 'Pending',
      source: 'room_notification',
      scheduledFor: new Date(),
    });
    return;
  }

  if (status === 'cleaning') {
    const existingTask = await Housekeeping.findOne({
      roomId: room._id,
      taskType: 'Regular Cleaning',
      status: { $in: ['Pending', 'In Progress'] },
    });

    if (!existingTask) {
      await Housekeeping.create({
        roomId: room._id,
        taskType: 'Regular Cleaning',
        notes: 'Room requires cleaning.',
        priority: 'High',
        status: 'Pending',
        source: 'room_status_change',
        scheduledFor: new Date(),
      });
    }
  }
};

export const getAllRooms = async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createRoom = async (req, res) => {
  try {
    await applyGstDefaults(req.body);
    const newRoom = new Room(req.body);
    const savedRoom = await newRoom.save();
    res.status(201).json(savedRoom);
  } catch (error) {
    console.error('Error creating room:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Room number already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateRoom = async (req, res) => {
  try {
    await applyGstDefaults(req.body);

    // Room type & amenities follow the dynamic room categories defined in
    // Settings, so no fixed-list validation here.

    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!updatedRoom) return res.status(404).json({ message: 'Room not found' });
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value,
      }));
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors,
        details: error.message,
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateRoomStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', '),
        receivedStatus: status,
        receivedType: typeof status,
      });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after', runValidators: true }
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });

    try {
      await handleStatusSideEffects(room, status);
    } catch (taskError) {
      console.error('Error creating housekeeping task from status update:', taskError);
    }

    res.json(room);
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const deletedRoom = await Room.findByIdAndDelete(req.params.id);
    if (!deletedRoom) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRoomStats = async (_req, res) => {
  try {
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({ status: 'available' });
    const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
    const maintenanceRooms = await Room.countDocuments({ status: 'maintenance' });
    const cleaningRooms = await Room.countDocuments({ status: 'cleaning' });

    res.json({
      total: totalRooms,
      available: availableRooms,
      occupied: occupiedRooms,
      maintenance: maintenanceRooms,
      cleaning: cleaningRooms,
      occupancyRate:
        totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    console.error('Error fetching room statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRoomsByStatus = async (req, res) => {
  try {
    const rooms = await Room.find({ status: req.params.status }).sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms by status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRoomsByType = async (req, res) => {
  try {
    const rooms = await Room.find({ type: req.params.type }).sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms by type:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkUpdateRoomStatus = async (req, res) => {
  try {
    const { roomIds, status } = req.body;
    if (!roomIds || !Array.isArray(roomIds) || !status) {
      return res.status(400).json({ message: 'Room IDs array and status are required' });
    }

    const result = await Room.updateMany(
      { _id: { $in: roomIds } },
      { status },
      { runValidators: true }
    );

    res.json({
      message: `Updated ${result.modifiedCount} rooms`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk updating room status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadRoomImages = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const urls = [];
    for (const file of files) {
      const optimized = await optimizeImage(file.buffer, { contentType: file.mimetype });
      const image = new Image({
        data: optimized.buffer,
        contentType: optimized.contentType,
        filename: file.originalname,
        size: optimized.size,
        category: 'room',
        uploadedBy: req.user?.id || null,
      });
      await image.save();
      urls.push(`/api/images/${image._id}`);
    }

    room.images = [...(room.images || []), ...urls];
    await room.save();
    res.status(201).json({ images: room.images, uploaded: urls });
  } catch (error) {
    console.error('Room image upload error:', error.message);
    res.status(500).json({ message: 'Failed to upload room images' });
  }
};

const ROOM_IMAGE_URL_PATTERN = /\/api\/images\/([0-9a-fA-F]{24})/;

export const deleteRoomImage = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const targetId = req.params.imageId;
    const remaining = (room.images || []).filter((url) => {
      const match = url.match(ROOM_IMAGE_URL_PATTERN);
      return !match || match[1] !== targetId;
    });

    if (remaining.length === (room.images || []).length) {
      return res.status(404).json({ message: 'Image not associated with this room' });
    }

    room.images = remaining;
    await room.save();
    Image.findByIdAndDelete(targetId).catch(() => {});
    res.json({ images: room.images });
  } catch (error) {
    console.error('Room image delete error:', error.message);
    res.status(500).json({ message: 'Failed to delete room image' });
  }
};

export const getAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required',
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const rooms = await Room.find({ status: { $ne: 'maintenance' } });

    const bookings = await Booking.find({
      $and: [
        { checkIn: { $lt: checkOutDate } },
        { checkOut: { $gt: checkInDate } },
        { bookingStatus: { $in: ['Confirmed', 'Pending'] } },
        // Ignore category holds with no room assigned yet (assigned at check-in).
        { roomId: { $ne: null } },
      ],
    });

    const bookedRoomIds = bookings.map((b) => b.roomId.toString());
    const banquetBlockedIds = await getBanquetBlockedRoomIds(checkInDate, checkOutDate);
    const availableRooms = rooms.filter(
      (r) => !bookedRoomIds.includes(r._id.toString()) && !banquetBlockedIds.has(r._id.toString())
    );

    res.json({
      success: true,
      data: availableRooms,
      message: 'Available rooms fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available rooms',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};
