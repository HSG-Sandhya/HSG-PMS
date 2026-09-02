import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRoomStatus } from '../services/roomStatus.js';

// Deleting or cancelling a booking used to write `available` unconditionally,
// which is only right when the departing booking was the reason the room was
// not available. These pin down the derivation that replaced it.

test('an in-house guest keeps the room occupied whatever else is true', () => {
  // The reported case: delete guest B's FUTURE booking while guest A is asleep
  // in the room. The room must not become available.
  assert.equal(deriveRoomStatus({ hasInHouseGuest: true, currentStatus: 'occupied' }), 'occupied');
  assert.equal(deriveRoomStatus({ hasInHouseGuest: true, currentStatus: 'available' }), 'occupied');
  assert.equal(
    deriveRoomStatus({ hasInHouseGuest: true, hasOpenCleaningTask: true, currentStatus: 'cleaning' }),
    'occupied',
  );
});

test('maintenance is a human decision and is never derived away', () => {
  assert.equal(deriveRoomStatus({ currentStatus: 'maintenance' }), 'maintenance');
  assert.equal(
    deriveRoomStatus({ hasOpenCleaningTask: true, currentStatus: 'maintenance' }),
    'maintenance',
  );
});

test('an open housekeeping task keeps the room in cleaning', () => {
  // Same rule the housekeeping board uses, so the Rooms page cannot disagree
  // with it -- the drift reconcile-room-housekeeping.js exists to repair.
  assert.equal(deriveRoomStatus({ hasOpenCleaningTask: true, currentStatus: 'cleaning' }), 'cleaning');
  assert.equal(deriveRoomStatus({ hasOpenCleaningTask: true, currentStatus: 'available' }), 'cleaning');
});

test('a genuinely empty, clean room becomes available', () => {
  assert.equal(deriveRoomStatus({ currentStatus: 'occupied' }), 'available');
  assert.equal(deriveRoomStatus({ currentStatus: 'cleaning' }), 'available');
  assert.equal(deriveRoomStatus({}), 'available');
});

test('precedence is occupied > maintenance > cleaning > available', () => {
  const all = { hasInHouseGuest: true, hasOpenCleaningTask: true, currentStatus: 'maintenance' };
  assert.equal(deriveRoomStatus(all), 'occupied');
  assert.equal(deriveRoomStatus({ ...all, hasInHouseGuest: false }), 'maintenance');
  assert.equal(deriveRoomStatus({ ...all, hasInHouseGuest: false, currentStatus: 'available' }), 'cleaning');
});
