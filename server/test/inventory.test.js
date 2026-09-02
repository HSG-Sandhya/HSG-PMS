import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityByType, freeRoomsForRange } from '../services/inventory.js';

const rooms = (type, n, from = 1) =>
  Array.from({ length: n }, (_, i) => ({
    _id: `${type}-${from + i}`, type, status: 'available',
    pricePerNight: 1000, capacity: { adults: 2 }, amenities: [],
  }));

const snapshot = (blocked = [], holds = {}) => ({
  blockedRoomIds: new Set(blocked),
  holdsByType: new Map(Object.entries(holds)),
});

// The bug: a website booking reserves a CATEGORY (roomId: null, roomCount: n).
// Availability counted only bookings with a roomId, so the hold was invisible
// and the same rooms could be sold again, and again.
test('a category hold removes inventory even though it names no room', () => {
  const deluxe = rooms('Deluxe', 5);
  assert.equal(availabilityByType(deluxe, snapshot()).get('Deluxe').available, 5);

  // One website booking for all 5.
  const held = availabilityByType(deluxe, snapshot([], { Deluxe: 5 })).get('Deluxe');
  assert.equal(held.available, 0, 'a hold for the whole category must sell out');
  assert.equal(held.total, 5, 'physical inventory is unchanged');
});

test('holds and assigned bookings both count, and stack', () => {
  const deluxe = rooms('Deluxe', 5);
  // 2 rooms assigned + a category hold for 2 => 1 left.
  const cat = availabilityByType(deluxe, snapshot(['Deluxe-1', 'Deluxe-2'], { Deluxe: 2 })).get('Deluxe');
  assert.equal(cat.available, 1);
});

test('availability never goes negative when overbooked', () => {
  const deluxe = rooms('Deluxe', 2);
  const cat = availabilityByType(deluxe, snapshot([], { Deluxe: 9 })).get('Deluxe');
  assert.equal(cat.available, 0);
});

test('a hold on one type does not consume another', () => {
  const all = [...rooms('Deluxe', 3), ...rooms('Suite', 2)];
  const byType = availabilityByType(all, snapshot([], { Deluxe: 3 }));
  assert.equal(byType.get('Deluxe').available, 0);
  assert.equal(byType.get('Suite').available, 2, 'Suite must be untouched');
});

test('the sellable count never exceeds the concrete rooms offered', () => {
  const deluxe = rooms('Deluxe', 5);
  const cat = availabilityByType(deluxe, snapshot([], { Deluxe: 3 })).get('Deluxe');
  assert.equal(cat.available, 2);
  assert.ok(cat.freeRooms.length >= cat.available,
    'freeRooms may be longer than available — a hold names no room, so callers must slice to `available`');
});

test('minGuests filters on capacity', () => {
  const mixed = [
    { _id: 'a', type: 'Std', status: 'available', pricePerNight: 900, capacity: { adults: 1 }, amenities: [] },
    { _id: 'b', type: 'Std', status: 'available', pricePerNight: 900, capacity: { adults: 4 }, amenities: [] },
  ];
  assert.equal(availabilityByType(mixed, snapshot(), { minGuests: 3 }).get('Std').available, 1);
});

// Assignment is a different question from selling: a hold names no room, and is
// usually the very booking being assigned.
test('freeRoomsForRange ignores holds but honours blocked rooms', () => {
  const deluxe = rooms('Deluxe', 3);
  const free = freeRoomsForRange(deluxe, snapshot(['Deluxe-2'], { Deluxe: 3 }));
  assert.deepEqual(free.map((r) => r._id), ['Deluxe-1', 'Deluxe-3']);
});

// ── Editing a booking ────────────────────────────────────────────────────────
// updateBooking had no availability check at all, so the guard on createBooking
// could be walked past by editing an existing booking instead of making a new
// one. The subtlety: the booking being edited already consumes inventory, so it
// must be excluded from its own check or every edit of a full category fails.
test('a booking excluded from its own check does not block its own edit', () => {
  const deluxe = rooms('Deluxe', 2);

  // Category is full because of THIS booking's own hold for 2.
  const includingSelf = availabilityByType(deluxe, snapshot([], { Deluxe: 2 })).get('Deluxe');
  assert.equal(includingSelf.available, 0, 'counting itself, the edit looks impossible');

  // Excluding it (what getInventorySnapshot({ excludeBookingId }) produces),
  // the same edit is fine.
  const excludingSelf = availabilityByType(deluxe, snapshot([], {})).get('Deluxe');
  assert.equal(excludingSelf.available, 2);
});

test('an edit still sees OTHER bookings', () => {
  const deluxe = rooms('Deluxe', 3);
  // Someone else holds 3; excluding our own booking changes nothing here.
  const cat = availabilityByType(deluxe, snapshot([], { Deluxe: 3 })).get('Deluxe');
  assert.equal(cat.available, 0, 'another party holding the category must still block');
});

// ── roomIsFree: the overlap test both the create and edit paths now share ────
import { roomIsFree, describeClash } from '../services/inventory.js';

// A stand-in for the Booking model: records the query it was handed and answers
// with whatever the test wants found.
const fakeBooking = (found) => {
  const calls = [];
  return {
    calls,
    findOne(query) {
      calls.push(query);
      return { select: () => Promise.resolve(found) };
    },
  };
};

test('an overlapping booking on the same room is reported as a clash', async () => {
  const Booking = fakeBooking({ invoiceNumber: 'HSG-A' });
  const { free, clash } = await roomIsFree(Booking, {
    roomId: 'r1', checkIn: '2026-09-06', checkOut: '2026-09-09',
  });
  assert.equal(free, false);
  assert.equal(describeClash(clash), 'HSG-A');
});

test('the overlap window is half-open, so back-to-back stays do not clash', async () => {
  const Booking = fakeBooking(null);
  await roomIsFree(Booking, { roomId: 'r1', checkIn: '2026-09-08', checkOut: '2026-09-10' });
  const q = Booking.calls[0];
  // checkIn < theirCheckOut AND checkOut > theirCheckIn -- a guest arriving the
  // day another leaves must not be refused.
  assert.deepEqual(q.checkIn, { $lt: new Date('2026-09-10') });
  assert.deepEqual(q.checkOut, { $gt: new Date('2026-09-08') });
});

test('an edit excludes the booking being edited from its own check', async () => {
  const Booking = fakeBooking(null);
  await roomIsFree(Booking, {
    roomId: 'r1', checkIn: '2026-09-06', checkOut: '2026-09-09', excludeBookingId: 'b7',
  });
  assert.deepEqual(Booking.calls[0]._id, { $ne: 'b7' });
});

test('a create passes no exclusion, so nothing is skipped', async () => {
  const Booking = fakeBooking(null);
  await roomIsFree(Booking, { roomId: 'r1', checkIn: '2026-09-06', checkOut: '2026-09-09' });
  assert.equal('_id' in Booking.calls[0], false);
});

test('a booking with no room assigned is not room-clashable', async () => {
  // A category hold names no room; capacity is canReserve's job, not this one.
  const Booking = fakeBooking({ invoiceNumber: 'SHOULD-NOT-BE-QUERIED' });
  const { free } = await roomIsFree(Booking, { roomId: null, checkIn: 'x', checkOut: 'y' });
  assert.equal(free, true);
  assert.equal(Booking.calls.length, 0, 'must not query at all');
});

test('describeClash falls back through the identifiers a guest would recognise', () => {
  assert.equal(describeClash({ invoiceNumber: 'HSG-1', customerId: 'C', guestName: 'G' }), 'HSG-1');
  assert.equal(describeClash({ customerId: 'C', guestName: 'G' }), 'C');
  assert.equal(describeClash({ guestName: 'G' }), 'G');
  assert.equal(describeClash(null), 'existing booking');
});
