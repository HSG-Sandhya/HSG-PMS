/**
 * Whether a guest may actually be checked out.
 *
 * The dedicated route did none of this. It loaded the booking and wrote:
 *
 *     booking.bookingStatus = 'Completed';
 *     booking.checkedIn = false;
 *     booking.checkedOutAt = new Date();
 *
 * then put the room into 'cleaning' and raised a housekeeping task. Nothing
 * asked whether the guest had ever arrived. So a reservation for next month
 * could be "checked out" -- completed, room dirtied, housekeeping dispatched to
 * clean a room nobody had slept in -- and a Cancelled booking could be turned
 * into a Completed one, which is a revenue record for a stay that never
 * happened.
 *
 * updateBooking reaches the same state by accepting bookingStatus: 'Completed',
 * so it runs this too. A guard on one endpoint that its neighbour ignores is
 * not a guard.
 *
 * Presence lives on `checkedIn`; a guest who is in the building has it true.
 * That is the whole precondition -- you cannot leave somewhere you never
 * arrived.
 */

/** A checkout that cannot proceed, or null. Pure: everything is passed in. */
export const checkOutBlocker = ({ booking } = {}) => {
  if (!booking) return { status: 404, message: 'Booking not found' };

  const from = booking.bookingStatus;

  if (from === 'Completed') {
    return { status: 409, message: 'This booking has already been checked out.' };
  }
  if (from === 'Cancelled' || from === 'Rejected') {
    const word = from === 'Cancelled' ? 'cancelled' : 'rejected';
    return {
      status: 409,
      message: `This booking was ${word} and cannot be checked out. Reinstate it first if the guest actually stayed.`,
    };
  }
  if (!booking.checkedIn) {
    return {
      status: 409,
      message: 'This guest has not checked in, so there is nothing to check out. '
        + 'Check them in first, or cancel the booking if they never arrived.',
    };
  }

  return null;
};

export default checkOutBlocker;
