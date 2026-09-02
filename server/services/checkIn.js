import Booking from '../models/Booking.js';
import { getBanquetBlockedRoomIds } from './inventory.js';
import { getOps } from '../config/operationalConfig.js';

/**
 * Whether a guest may actually be checked in.
 *
 * checkInGuest() used to do none of this. It loaded the booking, set
 * bookingStatus to 'Confirmed', checkedIn to true, and marked the room
 * occupied -- with no test of where the booking had come from. A Cancelled,
 * Rejected or Completed booking could be revived by calling the endpoint
 * again; a booking with no room assigned marked `null` occupied; and two
 * guests could be checked into one room.
 *
 * The same hole existed on the other side: updateBooking accepts
 * `checkedIn: true` directly, which is a second door into exactly this state.
 * Both now come through here.
 *
 * Note on presence: bookingStatus tracks the RESERVATION lifecycle and stays
 * 'Confirmed'; `checkedIn` tracks whether the guest has physically arrived.
 * Occupancy is derived from checkedIn everywhere in this app, so check-in must
 * not write bookingStatus: 'Checked-In'.
 */

// A guest can arrive from a live reservation only. Draft is excluded: it is an
// unfinished booking, and the lifecycle table has no Draft -> arrival edge.
export const CHECK_IN_SOURCE_STATUSES = ['Pending', 'Confirmed', 'Tentative'];

// How early a guest may be checked in relative to their booked arrival. A day's
// grace covers a red-eye arrival and a booking dated by the night rather than
// the moment; beyond that it is likely the wrong booking on screen.
export const EARLY_ARRIVAL_GRACE_MS = 24 * 60 * 60 * 1000;

// Room states a guest cannot be walked into. 'occupied' is deliberately NOT
// here: it is derived state that goes stale (a missed checkout leaves it set
// forever), so a stale flag would block the desk permanently. The authoritative
// test is whether another guest is actually checked in -- see inHouseClash.
const NON_OPERATIONAL_ROOM_STATUS = {
  maintenance: 'is under maintenance',
  cleaning: 'is still being cleaned',
};

/**
 * The reason this check-in must be refused, or null if it may proceed.
 *
 * Pure: every input is passed in, so the whole decision table is testable
 * without a database. Ordered as the front desk would ask the questions.
 */
export const checkInBlocker = ({
  booking,
  room = null,
  banquetBlocked = false,
  inHouseClash = null,
  allowWhileCleaning = false,
  now = new Date(),
} = {}) => {
  if (!booking) return { status: 404, message: 'Booking not found' };

  // 1. Is this a live reservation?
  if (booking.checkedIn) {
    return { status: 409, message: 'This guest is already checked in.' };
  }
  const from = booking.bookingStatus;
  if (!CHECK_IN_SOURCE_STATUSES.includes(from)) {
    const why = {
      Cancelled: 'was cancelled',
      Rejected: 'was rejected',
      Completed: 'has already been completed',
      'Checked-In': 'is already checked in',
      Draft: 'is still a draft',
    }[from] || `is "${from}"`;
    return {
      status: 409,
      message: `This booking ${why} and cannot be checked in. Reinstate it first if the guest has arrived.`,
    };
  }

  // 2. Is a room assigned?
  if (!booking.roomId) {
    return {
      status: 409,
      message: 'No room is assigned to this booking. Assign a room before checking the guest in.',
    };
  }
  if (!room) {
    return { status: 409, message: 'The room on this booking no longer exists. Assign another room.' };
  }

  // 3. Is the room usable?
  // Checkout puts a room into 'cleaning', so on a same-day turnover the desk
  // can legitimately be ahead of the housekeeping board. Blocking that outright
  // strands the front desk; the setting lets a hotel choose which risk it
  // prefers. Maintenance is never waivable -- that room is not habitable.
  const cleaningWaived = room.status === 'cleaning' && allowWhileCleaning;
  const roomProblem = cleaningWaived ? null : NON_OPERATIONAL_ROOM_STATUS[room.status];
  if (roomProblem) {
    return {
      status: 409,
      message: `Room ${room.roomNumber} ${roomProblem}. Mark it available, or assign a different room.`,
    };
  }
  if (banquetBlocked) {
    return {
      status: 409,
      message: `Room ${room.roomNumber} is reserved for a banquet event over these dates.`,
    };
  }

  // 4. Is anyone else actually in it?
  if (inHouseClash) {
    const who = inHouseClash.guestName || inHouseClash.invoiceNumber || 'another guest';
    return {
      status: 409,
      message: `${who} is still checked into room ${room.roomNumber}. Check them out first.`,
    };
  }

  // 5. Is this the right day?
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  if (Number.isFinite(checkOut.getTime()) && now >= checkOut) {
    return {
      status: 409,
      message: 'This stay has already ended. Update the dates before checking the guest in.',
    };
  }
  if (Number.isFinite(checkIn.getTime()) && now < new Date(checkIn.getTime() - EARLY_ARRIVAL_GRACE_MS)) {
    return {
      status: 409,
      message: `This booking starts on ${checkIn.toISOString().slice(0, 10)}. Move the arrival date forward to check in early.`,
    };
  }

  return null;
};

/**
 * Gather what checkInBlocker needs, then apply it.
 * Returns null when the check-in may proceed.
 */
export const validateCheckIn = async (booking, room, now = new Date()) => {
  if (!booking?.roomId || !room) {
    return checkInBlocker({ booking, room, now });
  }

  const { frontDesk } = await getOps();

  const roomId = room._id || booking.roomId;
  const [blockedIds, inHouseClash] = await Promise.all([
    getBanquetBlockedRoomIds(new Date(booking.checkIn), new Date(booking.checkOut)),
    Booking.findOne({
      _id: { $ne: booking._id },
      roomId,
      checkedIn: true,
    }).select('guestName invoiceNumber'),
  ]);

  return checkInBlocker({
    booking,
    room,
    banquetBlocked: blockedIds.has(String(roomId)),
    inHouseClash,
    allowWhileCleaning: frontDesk.allowCheckInWhileCleaning,
    now,
  });
};

export default checkInBlocker;
