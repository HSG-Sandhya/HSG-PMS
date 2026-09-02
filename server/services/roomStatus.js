import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Housekeeping from '../models/Housekeeping.js';

/**
 * A room's physical state, derived rather than assigned.
 *
 * Several places used to write `{ status: 'available', isAvailable: true }`
 * whenever a booking went away -- on delete, on cancel, on hold expiry. That is
 * only correct if the departing booking was the reason the room was not
 * available, and often it was not:
 *
 *   Room 101, guest A checked in today, guest B booked for next week.
 *   Delete B's future booking -> room 101 is marked available while A is asleep
 *   in it. The room then shows as free, gets offered to the next arrival, and
 *   the in-house guest vanishes from the occupancy count.
 *
 * It also flattened deliberate states: a room under maintenance, or one with an
 * open cleaning task, was silently reported as ready to sell.
 *
 * So nothing assigns the state any more. It is derived from the facts:
 *
 *   someone actually checked in   -> occupied   (reality beats intent)
 *   room marked under maintenance -> maintenance (a manual decision; keep it)
 *   an open housekeeping task     -> cleaning   (what the board already shows)
 *   otherwise                     -> available
 *
 * The board derives its tiles from the newest OPEN task, so using the same rule
 * here stops the Rooms page and the housekeeping board disagreeing -- the drift
 * scripts/reconcile-room-housekeeping.js exists to clean up.
 */

const OPEN_TASK_STATUSES = ['Pending', 'In Progress'];
const DEAD_BOOKING_STATUSES = ['Completed', 'Cancelled', 'Rejected'];

/** The pure rule. Everything it needs is passed in, so it is fully testable. */
export const deriveRoomStatus = ({
  hasInHouseGuest = false,
  hasOpenCleaningTask = false,
  currentStatus = 'available',
} = {}) => {
  if (hasInHouseGuest) return 'occupied';
  // Maintenance is set by a person who decided the room cannot be let. Nothing
  // derived from bookings should quietly overrule that.
  if (currentStatus === 'maintenance') return 'maintenance';
  if (hasOpenCleaningTask) return 'cleaning';
  return 'available';
};

/**
 * Recompute one room's status from the current facts and save it if it changed.
 *
 * `excludeBookingId` skips a booking that is about to stop counting -- the one
 * being deleted, or cancelled in the same request -- so the room is reconciled
 * against what will actually remain.
 *
 * Returns { status, changed } (or null when there is no such room).
 */
export const reconcileRoomStatus = async (roomId, { excludeBookingId = null } = {}) => {
  if (!roomId) return null;

  const room = await Room.findById(roomId).select('status isAvailable');
  if (!room) return null;

  const occupancyQuery = {
    roomId,
    checkedIn: true,
    bookingStatus: { $nin: DEAD_BOOKING_STATUSES },
  };
  if (excludeBookingId) occupancyQuery._id = { $ne: excludeBookingId };

  const [inHouse, openTask] = await Promise.all([
    Booking.exists(occupancyQuery),
    Housekeeping.exists({ roomId, status: { $in: OPEN_TASK_STATUSES } }),
  ]);

  const status = deriveRoomStatus({
    hasInHouseGuest: Boolean(inHouse),
    hasOpenCleaningTask: Boolean(openTask),
    currentStatus: room.status,
  });
  const isAvailable = status === 'available';

  const changed = room.status !== status || room.isAvailable !== isAvailable;
  if (changed) {
    await Room.findByIdAndUpdate(roomId, { status, isAvailable });
  }
  return { status, changed };
};

export default reconcileRoomStatus;
