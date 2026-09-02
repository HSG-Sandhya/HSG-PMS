import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInBlocker, CHECK_IN_SOURCE_STATUSES, EARLY_ARRIVAL_GRACE_MS } from '../services/checkIn.js';

// checkInGuest performed no state validation at all. These pin down the
// decision table it now runs, in the order the front desk would ask.
const NOW = new Date('2026-09-10T12:00:00Z');
const room = (over = {}) => ({ _id: 'r1', roomNumber: '101', status: 'available', ...over });
const booking = (over = {}) => ({
  _id: 'b1',
  bookingStatus: 'Confirmed',
  checkedIn: false,
  roomId: 'r1',
  checkIn: new Date('2026-09-10T00:00:00Z'),
  checkOut: new Date('2026-09-13T00:00:00Z'),
  ...over,
});
const blockerFor = (over = {}, extra = {}) =>
  checkInBlocker({ booking: booking(over), room: room(), now: NOW, ...extra });

test('a live reservation with an available room checks in', () => {
  assert.equal(blockerFor(), null);
  for (const bookingStatus of CHECK_IN_SOURCE_STATUSES) {
    assert.equal(blockerFor({ bookingStatus }), null, `${bookingStatus} should be allowed`);
  }
});

test('a dead booking cannot be revived by checking it in', () => {
  // The reported attack: PUT /bookings/:id/checkin on a Cancelled booking made
  // it Confirmed and checkedIn again.
  for (const bookingStatus of ['Cancelled', 'Rejected', 'Completed', 'Draft']) {
    const b = blockerFor({ bookingStatus });
    assert.equal(b?.status, 409, `${bookingStatus} must be refused`);
    assert.match(b.message, /cannot be checked in/);
  }
});

test('checking in twice is refused', () => {
  assert.match(blockerFor({ checkedIn: true }).message, /already checked in/);
});

test('a booking with no room assigned cannot mark null occupied', () => {
  const b = checkInBlocker({ booking: booking({ roomId: null }), room: null, now: NOW });
  assert.equal(b.status, 409);
  assert.match(b.message, /No room is assigned/);
});

test('a booking whose room has been deleted is refused, not crashed on', () => {
  assert.match(checkInBlocker({ booking: booking(), room: null, now: NOW }).message, /no longer exists/);
});

test('a room under maintenance or still being cleaned is refused', () => {
  for (const [status, phrase] of [['maintenance', /under maintenance/], ['cleaning', /being cleaned/]]) {
    const b = checkInBlocker({ booking: booking(), room: room({ status }), now: NOW });
    assert.equal(b.status, 409);
    assert.match(b.message, phrase);
  }
});

test('a stale "occupied" flag does NOT block the desk on its own', () => {
  // room.status is derived state and goes stale after a missed checkout. If it
  // blocked check-in by itself the desk would be stuck with no way forward; the
  // authoritative test is whether a guest is actually in the room.
  assert.equal(checkInBlocker({ booking: booking(), room: room({ status: 'occupied' }), now: NOW }), null);
});

test('another guest actually in the room does block it', () => {
  const b = blockerFor({}, { inHouseClash: { guestName: 'Existing Guest' } });
  assert.equal(b.status, 409);
  assert.match(b.message, /Existing Guest is still checked into room 101/);
});

test('a room held for a banquet is refused', () => {
  assert.match(blockerFor({}, { banquetBlocked: true }).message, /banquet event/);
});

test('a stay that has already ended cannot be checked into', () => {
  const b = checkInBlocker({ booking: booking(), room: room(), now: new Date('2026-09-14T00:00:00Z') });
  assert.match(b.message, /already ended/);
});

test('arrival is allowed within the early grace window but not before it', () => {
  const checkIn = new Date('2026-09-10T00:00:00Z');
  const justInside = new Date(checkIn.getTime() - EARLY_ARRIVAL_GRACE_MS + 60_000);
  const wellBefore = new Date(checkIn.getTime() - EARLY_ARRIVAL_GRACE_MS - 60_000);
  assert.equal(checkInBlocker({ booking: booking(), room: room(), now: justInside }), null);
  assert.match(checkInBlocker({ booking: booking(), room: room(), now: wellBefore }).message, /starts on 2026-09-10/);
});

test('checking in on the last night is still allowed', () => {
  const lastNight = new Date('2026-09-12T20:00:00Z'); // checkOut is the 13th
  assert.equal(checkInBlocker({ booking: booking(), room: room(), now: lastNight }), null);
});

test('a missing booking is a 404, not a 409', () => {
  assert.equal(checkInBlocker({ booking: null }).status, 404);
});

test('the cleaning block can be waived, but maintenance never can', () => {
  // Checkout puts a room into 'cleaning', so on a same-day turnover the desk is
  // legitimately ahead of the housekeeping board. A hotel picks which risk it
  // prefers; an uninhabitable room is not a matter of preference.
  const cleaning = room({ status: 'cleaning' });
  assert.match(
    checkInBlocker({ booking: booking(), room: cleaning, now: NOW }).message,
    /being cleaned/
  );
  assert.equal(
    checkInBlocker({ booking: booking(), room: cleaning, allowWhileCleaning: true, now: NOW }),
    null
  );
  assert.match(
    checkInBlocker({ booking: booking(), room: room({ status: 'maintenance' }), allowWhileCleaning: true, now: NOW }).message,
    /under maintenance/
  );
});
