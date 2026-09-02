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

/**
 * The reservation statuses that still consume a room.
 *
 * This was ['Confirmed', 'Pending'], while the front desk used its own
 * four-value list -- so the two disagreed about what "taken" means. Everything
 * that fell back to this default (the public availability endpoint, the public
 * booking check, the front desk's room-assignment picker) was blind to:
 *
 *   Tentative   an unconfirmed hold, which is exactly a room someone is holding
 *   Checked-In  a guest physically in the room right now
 *
 * So the website advertised, and would sell, a room with a guest asleep in it.
 * That is not a race — it happens every time. One list, exported, so a caller
 * cannot quietly pick a narrower one again.
 *
 * Draft is deliberately absent: an unsubmitted form holds nothing.
 */
export const HOLD_STATUSES = ['Confirmed', 'Pending', 'Tentative', 'Checked-In'];

const ACTIVE = HOLD_STATUSES;

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
/**
 * The booking, if any, that already holds this room over this window.
 *
 * createBooking and updateBooking each had their own copy of this query. Two
 * copies of an overlap test is one too many: the update path's copy was missing
 * entirely until recently, which is exactly how an edit could move a booking on
 * top of another one.
 *
 * Overlap is half-open -- `checkIn < theirCheckOut && checkOut > theirCheckIn`
 * -- so a guest arriving the day another leaves does NOT count as a clash.
 *
 * `excludeBookingId` is required when checking an edit: the booking being
 * changed already occupies its own slot, and counting it against itself would
 * block every edit of an already-full room.
 */
export const roomIsFree = async (
  Booking,
  { roomId, checkIn, checkOut, statuses = ACTIVE, excludeBookingId = null } = {}
) => {
  if (!roomId) return { free: true, clash: null };

  const query = {
    roomId,
    bookingStatus: { $in: statuses },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };

  const clash = await Booking.findOne(query).select('invoiceNumber customerId guestName');
  return { free: !clash, clash };
};

/** How a clash reads to the person who hit it. */
export const describeClash = (clash) =>
  clash?.invoiceNumber || clash?.customerId || clash?.guestName || 'existing booking';

export const canReserve = async (
  Room,
  { roomType, count = 1, checkIn, checkOut, statuses, excludeBookingId },
) => {
  const requested = Math.max(1, Number(count) || 1);
  // In parallel: this runs inside the booking lock, where every avoidable
  // round trip is time no other booking can use.
  const [rooms, snapshot] = await Promise.all([
    Room.find({ status: { $ne: 'maintenance' } }).lean(),
    getInventorySnapshot(checkIn, checkOut, {
      ...(statuses ? { statuses } : {}),
      ...(excludeBookingId ? { excludeBookingId } : {}),
    }),
  ]);
  const available = availabilityByType(rooms, snapshot).get(roomType || 'Room')?.available ?? 0;
  return { ok: available >= requested, available, requested };
};

/**
 * The one availability verdict, shared by every path that writes a booking.
 *
 * There were three near-copies of this: createBooking's, updateBooking's, and
 * the website's — and they had already drifted. The website checked the
 * CATEGORY but never the specific room, so posting a roomId booked straight
 * over an existing guest; the legacy per-room group flow checked neither. A
 * single function means a path cannot quietly be missing a check.
 *
 * @returns {null} when the reservation may proceed, otherwise
 *   `{ status, message, waivable, available? }` ready to send as the response
 *   body. `waivable` says whether the front desk's "allow overbooking" setting
 *   could have let this through -- a banquet hold never can, so the desk is not
 *   offered an override that would do nothing.
 */
export const availabilityConflict = async (
  Booking,
  Room,
  {
    roomId = null,
    roomType = null,
    roomCount = 1,
    checkIn,
    checkOut,
    statuses = ACTIVE,
    excludeBookingId = null,
    allowOverbooking = false,
  } = {},
) => {
  const from = new Date(checkIn);
  const to = new Date(checkOut);

  // Everything that does not depend on another answer, at once. This runs
  // inside the booking lock, and a round trip taken here is time during which
  // no other booking in the hotel can be confirmed -- it was five sequential
  // queries, which put a 19-second tail on a 50-request rush.
  const [blocked, roomDoc, roomFree] = await Promise.all([
    roomId ? getBanquetBlockedRoomIds(from, to) : new Set(),
    roomId ? Room.findById(roomId).select('type').lean() : null,
    roomId && !allowOverbooking
      ? roomIsFree(Booking, { roomId, checkIn: from, checkOut: to, statuses, excludeBookingId })
      : { free: true, clash: null },
  ]);

  // A banquet/marriage hold is never waivable by the overbooking setting: those
  // rooms are physically committed to an event, not merely spoken for.
  if (roomId && blocked.has(String(roomId))) {
    return {
      status: 409,
      waivable: false,
      message: 'This room is reserved for a banquet event on the selected dates and cannot be booked.',
    };
  }

  if (allowOverbooking) return null;

  // Does another booking already name this exact room over this window?
  if (!roomFree.free) {
    return {
      status: 409,
      waivable: true,
      message: `This room is already booked for overlapping dates (${describeClash(roomFree.clash)}).`,
      clashWith: describeClash(roomFree.clash),
    };
  }

  // Category holds name no room, so the room-level test above cannot see them.
  // A type can be fully spoken for while every individual room still looks
  // free — taking one here would leave a hold that cannot be fulfilled.
  const effectiveType = roomId ? roomDoc?.type : roomType;
  if (!effectiveType) return null;

  const requested = roomId ? 1 : Math.max(1, Number(roomCount) || 1);
  const capacity = await canReserve(Room, {
    roomType: effectiveType, count: requested, checkIn: from, checkOut: to, statuses, excludeBookingId,
  });
  if (capacity.ok) return null;

  return {
    status: 409,
    waivable: true,
    available: capacity.available,
    message: capacity.available === 0
      ? `All "${effectiveType}" rooms are already reserved for these dates, including category holds with no room assigned yet.`
      : `Only ${capacity.available} "${effectiveType}" room(s) available for these dates (this booking needs ${requested}).`,
  };
};
