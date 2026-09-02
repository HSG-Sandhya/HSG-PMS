import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOutBlocker } from '../services/checkOut.js';

// The checkout route performed no state validation, so it would complete a
// booking, dirty the room and dispatch housekeeping for a stay that had never
// happened.
const booking = (over = {}) => ({
  _id: 'b1', bookingStatus: 'Confirmed', checkedIn: true, ...over,
});

test('a guest who is actually in the building can check out', () => {
  assert.equal(checkOutBlocker({ booking: booking() }), null);
});

test('a future reservation cannot be checked out', () => {
  // The reported case: Confirmed but never arrived. Completing it would raise a
  // housekeeping task to clean a room nobody slept in.
  const b = checkOutBlocker({ booking: booking({ checkedIn: false }) });
  assert.equal(b.status, 409);
  assert.match(b.message, /has not checked in/);
});

test('a cancelled or rejected booking cannot be turned into a completed one', () => {
  // Completing these would manufacture a revenue record for a stay that never
  // happened.
  for (const [bookingStatus, word] of [['Cancelled', /was cancelled/], ['Rejected', /was rejected/]]) {
    const b = checkOutBlocker({ booking: booking({ bookingStatus, checkedIn: false }) });
    assert.equal(b.status, 409);
    assert.match(b.message, word);
  }
});

test('a cancelled booking is refused even if checkedIn somehow survived', () => {
  // Ordering matters: the terminal status is the more accurate complaint, and
  // this stops a stale flag being enough to complete a cancelled stay.
  const b = checkOutBlocker({ booking: booking({ bookingStatus: 'Cancelled', checkedIn: true }) });
  assert.match(b.message, /was cancelled/);
});

test('checking out twice is refused', () => {
  const b = checkOutBlocker({ booking: booking({ bookingStatus: 'Completed', checkedIn: false }) });
  assert.match(b.message, /already been checked out/);
});

test('a booking that never reached arrival is refused whatever its status', () => {
  for (const bookingStatus of ['Draft', 'Tentative', 'Pending', 'Confirmed']) {
    const b = checkOutBlocker({ booking: booking({ bookingStatus, checkedIn: false }) });
    assert.equal(b.status, 409, `${bookingStatus} must be refused`);
  }
});

test('a missing booking is a 404, not a 409', () => {
  assert.equal(checkOutBlocker({ booking: null }).status, 404);
  assert.equal(checkOutBlocker({}).status, 404);
});
