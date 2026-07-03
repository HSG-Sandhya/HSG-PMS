// Shared room-availability helpers used by the group/company/transfer
// booking dialogs. A room is "free" for a stay window when none of its
// active bookings overlap [checkIn, checkOut).

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);

const ACTIVE = new Set(['Confirmed', 'Pending']);

/**
 * Is `room` free for [checkIn, checkOut)? `room.bookings` is the list the
 * Bookings page attaches (active bookings for that room). `excludeBookingId`
 * lets the transfer dialog ignore the booking being moved.
 */
export const isRoomFree = (room, checkIn, checkOut, excludeBookingId = null) => {
  if (!room) return false;
  if (!checkIn || !checkOut) return room.isAvailable !== false;
  const list = Array.isArray(room.bookings) ? room.bookings : [];
  return !list.some((b) => {
    if (excludeBookingId && b._id === excludeBookingId) return false;
    if (!ACTIVE.has(b.bookingStatus)) return false;
    return overlaps(checkIn, checkOut, b.checkIn, b.checkOut);
  });
};

/** All rooms free for the given window, sorted by room number. */
export const freeRooms = (rooms, checkIn, checkOut, excludeBookingId = null) =>
  (Array.isArray(rooms) ? rooms : [])
    .filter((r) => isRoomFree(r, checkIn, checkOut, excludeBookingId))
    .sort((a, b) => {
      const na = parseInt(String(a.roomNumber).match(/\d+/)?.[0] ?? '0', 10);
      const nb = parseInt(String(b.roomNumber).match(/\d+/)?.[0] ?? '0', 10);
      return na - nb;
    });

/** Whole nights between two dates (min 1). */
export const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 1;
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.round(ms / 86400000));
};
