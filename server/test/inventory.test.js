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
