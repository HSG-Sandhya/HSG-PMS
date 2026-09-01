import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Housekeeping from '../models/Housekeeping.js';
import Image from '../models/Image.js';
import { optimizeImage } from '../utils/imageOptimizer.js';
import { getBilling } from '../config/operationalConfig.js';
import { pctToFraction } from '../config/operationalDefaults.js';
import {
  getInventorySnapshot,
  freeRoomsForRange,
  getBanquetBlockedRoomIds,
} from '../services/inventory.js';


const VALID_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning'];

// A room with a guest physically in it is occupied — full stop. Occupancy is
// PRESENCE (`checkedIn`), never the reservation status: a booking stays
// 'Confirmed' for the whole stay, so testing bookingStatus === 'Checked-In'
// silently matches nothing.
//
// This is enforced server-side because the Rooms page infers "no current
// booking → free the room" from its own fetched bookings list, and an empty
// list is indistinguishable there from a failed fetch. One timed-out request
// (this VPS talks to a throttled Atlas tier) was enough to mark every occupied
// room 'available' in the database, which is exactly how R-201 lost its
// occupancy on 2026-08-11 while Harendra Kumar was still in it.
const inHouseBookingFor = async (roomId) => Booking.findOne({
  roomId,
  checkedIn: true,
  bookingStatus: { $nin: ['Completed', 'Cancelled', 'Rejected'] },
}).select('guestName').lean();

// Coerce an 'available' write back to 'occupied' when the room still holds a
// checked-in guest. Returns a warning string for the caller to surface, or
// undefined when the write is fine as-is. Mutates `target` (the update payload).
const guardOccupancy = async (roomId, target) => {
  if (target.status !== 'available') return undefined;
  const inHouse = await inHouseBookingFor(roomId);
  if (!inHouse) return undefined;
  target.status = 'occupied';
  target.isAvailable = false;
  return `${inHouse.guestName || 'A guest'} is still checked into this room, so it stays "occupied". `
    + 'Check the guest out to free the room.';
};

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

/**
 * Keep the housekeeping board in step with a room's status.
 *
 * The board doesn't read `room.status` for cleanliness — it derives a tile's
 * state from the room's newest OPEN task (see deriveRoomStatus in the client's
 * hkConstants.js), and a Pending task always wins. So a room whose status is
 * changed here without its tasks being reconciled keeps showing the old state
 * on the board indefinitely: the room reads "Available" on the Rooms page while
 * the board still calls it "Dirty".
 *
 * Every branch below therefore writes BOTH sides.
 */
const handleStatusSideEffects = async (room, status, { reconcileOnAvailable = true } = {}) => {
  if (status === 'maintenance') {
    // Don't stack duplicates — the same de-dupe the cleaning branch does.
    const openMaintenance = await Housekeeping.findOne({
      roomId: room._id,
      taskType: 'Maintenance',
      status: { $in: ['Pending', 'In Progress'] },
    });
    if (!openMaintenance) {
      await Housekeeping.create({
        roomId: room._id,
        taskType: 'Maintenance',
        description: 'Room requires maintenance.',
        priority: 'High',
        status: 'Pending',
        source: 'room_notification',
        scheduledFor: new Date(),
      });
    }
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
        // Must be a value from the `source` enum in models/Housekeeping.js.
        // This previously read 'room_status_change', which isn't in the enum —
        // Mongoose rejected every one of these writes and the caller swallowed
        // the error, so marking a room "cleaning" from the Rooms page silently
        // created no task at all.
        source: 'room_status_update',
        scheduledFor: new Date(),
      });
    }
    return;
  }

  if (status === 'available') {
    // Closing tasks here means "a human has declared this room ready", which is
    // what the Rooms page toggle expresses. It is the mirror of completing a
    // task, which already sets the room back to available.
    //
    // It must NOT run for automated corrections. The Rooms page also rewrites a
    // stale `occupied` to `available` whenever a room has no current booking —
    // that inference is about BOOKINGS, not cleanliness, and letting it cancel
    // tasks would silently wipe the housekeeping queue in bulk. Those callers
    // send `reconcileHousekeeping: false` and leave the tasks standing.
    //
    // "Available + Dirty" is then a legitimate state, not a bug: nobody is in
    // the room, and it still needs cleaning.
    if (!reconcileOnAvailable) return;

    // Cancelled rather than Completed: nobody did the work, and counting it as
    // done would inflate the "Completed Today" figure. The board treats both
    // as closed, so either clears the tile.
    await Housekeeping.updateMany(
      { roomId: room._id, status: { $in: ['Pending', 'In Progress'] } },
      {
        $set: {
          status: 'Cancelled',
          notes: 'Closed automatically — the room was marked available.',
        },
      },
    );
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

    // Was the status part of this edit? The Rooms page changes a room's status
    // through THIS endpoint (PUT /rooms/:id), not /rooms/:id/status — so the
    // housekeeping reconciliation has to run here too. It previously only ran
    // on the status endpoint, which the UI never calls, so every status change
    // made from the Rooms page left the housekeeping board untouched: mark a
    // room available and its Pending task lived on, keeping the board on
    // "Dirty" while the Rooms page said "Available".
    const prevRoom = req.body.status !== undefined
      ? await Room.findById(req.params.id).select('status')
      : null;

    // Control flag, not a document field — take it off before the write.
    const reconcileOnAvailable = req.body.reconcileHousekeeping !== false;
    delete req.body.reconcileHousekeeping;

    // Applied before the write, so the wrong value never reaches the database.
    const occupancyWarning = await guardOccupancy(req.params.id, req.body);

    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!updatedRoom) return res.status(404).json({ message: 'Room not found' });

    let housekeepingWarning;
    if (req.body.status !== undefined && req.body.status !== prevRoom?.status) {
      try {
        await handleStatusSideEffects(updatedRoom, req.body.status, { reconcileOnAvailable });
      } catch (taskError) {
        console.error('Housekeeping sync failed after room update:', taskError);
        housekeepingWarning = `Room set to "${req.body.status}", but its housekeeping tasks could not be updated `
          + '— the housekeeping board may disagree with this room until it is retried. '
          + `(${taskError.message})`;
      }
    }

    res.json(housekeepingWarning || occupancyWarning
      ? { ...updatedRoom.toObject(), ...(housekeepingWarning && { housekeepingWarning }), ...(occupancyWarning && { occupancyWarning }) }
      : updatedRoom);
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

    // Applied before the write, so the wrong value never reaches the database.
    const write = { status };
    const occupancyWarning = await guardOccupancy(req.params.id, write);

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      write,
      { returnDocument: 'after', runValidators: true }
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // The room row is already written, so a failure here can't be undone by
    // refusing the request — but it MUST be visible, because it means the room
    // and the housekeeping board have just gone out of step. It used to be
    // logged and nothing else, which is how the enum bug above survived: the
    // caller got a clean 200 every time while no task was ever created.
    let housekeepingWarning;
    try {
      await handleStatusSideEffects(room, write.status, {
        reconcileOnAvailable: req.body.reconcileHousekeeping !== false,
      });
    } catch (taskError) {
      console.error('Housekeeping sync failed after room status update:', taskError);
      housekeepingWarning = `Room set to "${write.status}", but its housekeeping tasks could not be updated `
        + '— the housekeeping board may disagree with this room until it is retried. '
        + `(${taskError.message})`;
    }

    res.json(housekeepingWarning || occupancyWarning
      ? { ...room.toObject(), ...(housekeepingWarning && { housekeepingWarning }), ...(occupancyWarning && { occupancyWarning }) }
      : room);
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

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', '),
      });
    }

    const result = await Room.updateMany(
      { _id: { $in: roomIds } },
      { status },
      { runValidators: true }
    );

    // Reconcile housekeeping for each room, same as the single-room paths —
    // a bulk change is still a status change, and skipping this here would
    // reintroduce the desync in batches.
    const rooms = await Room.find({ _id: { $in: roomIds } }).select('_id status');
    const failures = [];
    for (const room of rooms) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await handleStatusSideEffects(room, status);
      } catch (taskError) {
        console.error(`Housekeeping sync failed for room ${room._id}:`, taskError);
        failures.push(String(room._id));
      }
    }

    res.json({
      message: `Updated ${result.modifiedCount} rooms`,
      modifiedCount: result.modifiedCount,
      ...(failures.length
        ? {
          housekeepingWarning: `${failures.length} room(s) updated, but their housekeeping tasks could not be `
            + 'reconciled — the housekeeping board may disagree with them until retried.',
          housekeepingFailedRoomIds: failures,
        }
        : {}),
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
        { roomId: { $ne: null } },
      ],
    });

    // This endpoint lists CONCRETE rooms for assignment, so category holds are
    // deliberately not subtracted — a hold names no room, and is usually the
    // very booking being assigned. Use the inventory service for "how many can
    // I sell", which is a different question. See services/inventory.js.
    const snapshot = await getInventorySnapshot(checkInDate, checkOutDate);
    const availableRooms = freeRoomsForRange(rooms, snapshot);

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

// Re-exported for the controllers and routes that already import it from here.
export { getBanquetBlockedRoomIds };
