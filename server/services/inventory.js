import Booking from '../models/Booking.js';
import BanquetBooking from '../models/BanquetBooking.js';

/**
 * The single source of truth for "what can we sell for these dates".
 *
 * Two kinds of reservation consume inventory, and only one of them names a room:
 *
 *   • ASSIGNED bookings carry a roomId. They remove that specific room.
 *   • CATEGORY HOLDS carry roomId: null plus roomType and roomCount. The website
 *     creates one for every booking ("staff assign the specific room at
 *     check-in") and group room-blocks create one per blocked room. They remove
 *     `roomCount` slots from their type without naming a room.
 *
 * Every availability calculation used to filter `roomId: { $ne: null }` and so
 * counted only the first kind. A category hold was therefore invisible: the site
 * would keep selling a room type that was already fully reserved, and two group
 * blocks could claim the same rooms. Nothing had gone wrong in production yet
 * only because no category hold existed there.
 *
 * The distinction that matters to callers:
 *   - "how many can I SELL?"      -> availabilityByType(), which subtracts holds
 *   - "which rooms can I ASSIGN?" -> freeRoomsForRange(), which cannot subtract
 *     a hold because a hold names no room — it is the very booking being
 *     assigned.
 */

/**
 * Rooms held by a banquet/marriage event over a range. Lived in
 * roomController, which made services/inventory import a controller and
 * created an import cycle once that controller needed the service back.
 */
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

const ACTIVE = ['Confirmed', 'Pending'];

/**
 * Everything blocking inventory across a date range, fetched once.
 * @returns {{ blockedRoomIds: Set<string>, holdsByType: Map<string, number> }}
 */
export const getInventorySnapshot = async (
  checkIn,
  checkOut,
  { statuses = ACTIVE, excludeBookingId = null } = {},
) => {
  const from = new Date(checkIn);
  const to = new Date(checkOut);

  // Half-open overlap: a stay ending on the 5th does not clash with one starting
  // on the 5th.
  const overlap = { checkIn: { $lt: to }, checkOut: { $gt: from }, bookingStatus: { $in: statuses } };

  // When EDITING a booking, that booking already consumes inventory. Counting it
  // against itself would make any edit of a full category look like an overbook,
  // so it is excluded from its own check.
  if (excludeBookingId) overlap._id = { $ne: excludeBookingId };

  const [assigned, holds, banquetBlocked] = await Promise.all([
    Booking.find({ ...overlap, roomId: { $ne: null } }).select('roomId').lean(),
    Booking.find({ ...overlap, $or: [{ roomId: null }, { roomId: { $exists: false } }] })
      .select('roomType roomCount').lean(),
    getBanquetBlockedRoomIds(from, to),
  ]);

  const blockedRoomIds = new Set(assigned.map((b) => String(b.roomId)));
  for (const id of banquetBlocked) blockedRoomIds.add(String(id));

  const holdsByType = new Map();
  for (const h of holds) {
    const type = h.roomType || 'Room';
    const n = Math.max(1, Number(h.roomCount) || 1);
    holdsByType.set(type, (holdsByType.get(type) || 0) + n);
  }

  return { blockedRoomIds, holdsByType };
};

/**
 * Sellable inventory per room type.
 *
 * physical rooms of the type
 *   − rooms of that type already assigned or banquet-blocked
 *   − category holds against that type (roomCount each)
 *   = available
 */
export const availabilityByType = (rooms, snapshot, { minGuests = 0 } = {}) => {
  const { blockedRoomIds, holdsByType } = snapshot;
  const byType = new Map();

  for (const room of rooms) {
    const type = room.type || 'Room';
    let cat = byType.get(type);
    if (!cat) {
      cat = {
        type,
        capacity: room.capacity,
        price: room.pricePerNight,
        amenities: room.amenities,
        total: 0,
        available: 0,
        freeRooms: [],
      };
      byType.set(type, cat);
    }
    cat.total += 1;
    if (room.pricePerNight < cat.price) cat.price = room.pricePerNight;

    const usable =
      room.status === 'available' &&
      !blockedRoomIds.has(String(room._id)) &&
      (!minGuests || (room.capacity?.adults || 0) >= minGuests);

    if (usable) {
      cat.available += 1;
      cat.freeRooms.push(room);
    }
  }

  // Now take the category holds off the top. A hold names no room, so it can
  // only reduce the COUNT — never a particular room in freeRooms.
  for (const [type, held] of holdsByType) {
    const cat = byType.get(type);
    if (cat) cat.available = Math.max(0, cat.available - held);
  }

  return byType;
};

/** Concrete rooms free for assignment (holds excluded — see the note above). */
export const freeRoomsForRange = (rooms, snapshot) =>
  rooms.filter((r) => !snapshot.blockedRoomIds.has(String(r._id)));

/** Free count per type, honouring holds. Convenience for block-availability checks. */
export const freeCountByType = (rooms, snapshot) => {
  const out = {};
  for (const [type, cat] of availabilityByType(rooms, snapshot)) out[type] = cat.available;
  return out;
};

/**
 * Can `count` rooms of `type` still be sold for this range?
 *
 * The availability ENDPOINTS were fixed to subtract category holds, but the
 * booking endpoints did not consult them — so a sold-out category still
 * accepted new reservations from a stale page, a retry, a race between two
 * simultaneous guests, or a direct API call. Displaying the right number is not
 * the same as enforcing it.
 *
 * @returns {{ ok: boolean, available: number, requested: number }}
 */
export const canReserve = async (
  Room,
  { roomType, count = 1, checkIn, checkOut, statuses, excludeBookingId },
) => {
  const requested = Math.max(1, Number(count) || 1);
  const rooms = await Room.find({ status: { $ne: 'maintenance' } }).lean();
  const snapshot = await getInventorySnapshot(checkIn, checkOut, {
    ...(statuses ? { statuses } : {}),
    ...(excludeBookingId ? { excludeBookingId } : {}),
  });
  const available = availabilityByType(rooms, snapshot).get(roomType || 'Room')?.available ?? 0;
  return { ok: available >= requested, available, requested };
};
