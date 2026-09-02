import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRoomView, storefrontRoomView, PUBLIC_ROOM_FIELDS } from '../services/publicRoom.js';
import { BILLING_DEFAULTS } from '../config/operationalDefaults.js';

// The public endpoints returned the Mongoose document as-is, so an anonymous
// guest also received the operational record: housekeeping state, the internal
// room number, and maintenanceHistory — a free-text fault description, the
// repair cost, and the name of whoever resolved it.

const roomDoc = () => ({
  _id: 'r1',
  roomNumber: '304',
  type: 'deluxe',
  categoryId: 'CAT-1',
  capacity: { adults: 2, children: 1 },
  pricePerNight: 2000,
  gstAmount: 100,
  totalPrice: 2100,
  amenities: ['AC', 'TV'],
  features: ['Sea View'],
  description: 'A room',
  images: ['/api/images/abc'],
  floor: 3,
  status: 'maintenance',
  isAvailable: false,
  lastCleaned: new Date('2026-08-30'),
  maintenanceHistory: [
    { date: new Date('2026-08-01'), description: 'Air conditioner compressor failed', cost: 18500, resolvedBy: 'Ramesh' },
  ],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-08-30'),
  __v: 3,
});

const billing = BILLING_DEFAULTS;

// Everything a guest must never receive, and the value that would prove it did.
const INTERNAL = {
  lastCleaned: (v) => v.lastCleaned,
  maintenanceHistory: (v) => v.maintenanceHistory,
  categoryId: (v) => v.categoryId,
  gstAmount: (v) => v.gstAmount,
  createdAt: (v) => v.createdAt,
  updatedAt: (v) => v.updatedAt,
  __v: (v) => v.__v,
};

test('no operational field survives the public view', () => {
  const view = publicRoomView(roomDoc(), billing);
  for (const [field, read] of Object.entries(INTERNAL)) {
    assert.equal(read(view), undefined, `${field} reached an anonymous guest`);
  }
  // The room number identifies a physical room; the marketing view has no use for it.
  assert.equal(view.roomNumber, undefined);
  assert.equal(view.status, undefined, 'housekeeping state is not marketing copy');
});

test('a repair cost and the person who fixed it cannot appear anywhere in the payload', () => {
  // A field-by-field check misses a nested leak, so search the serialized text.
  const serialized = JSON.stringify(publicRoomView(roomDoc(), billing));
  for (const secret of ['18500', 'Ramesh', 'compressor', '2026-08-30']) {
    assert.equal(serialized.includes(secret), false, `"${secret}" leaked`);
  }
});

test('the guest still gets everything needed to choose a room', () => {
  const view = publicRoomView(roomDoc(), billing);
  assert.equal(view.id, 'r1');
  assert.equal(view.type, 'Deluxe', 'the stored enum is lowercase; the site shows title case');
  assert.equal(view.capacity, 3);
  assert.equal(view.maxAdults, 2);
  assert.equal(view.maxChildren, 1);
  assert.equal(view.price, 2000);
  assert.equal(view.totalPrice, 2100);
  assert.deepEqual(view.amenities, ['AC', 'TV']);
  assert.deepEqual(view.features, ['Sea View']);
  assert.deepEqual(view.images, ['/api/images/abc']);
  assert.equal(view.description, 'A room');
});

test('the storefront list adds only the room number and the booking flag', () => {
  const marketing = publicRoomView(roomDoc(), billing);
  const storefront = storefrontRoomView(roomDoc(), billing);

  const extra = Object.keys(storefront).filter((k) => !(k in marketing));
  assert.deepEqual(extra.sort(), ['isAvailable', 'roomNumber', 'status'],
    'any further disclosure must be a deliberate change here');

  assert.equal(storefront.status, 'Maintenance');
  assert.equal(storefront.isAvailable, false);
  // Still no maintenance detail, even on the endpoint that reports the state.
  assert.equal(JSON.stringify(storefront).includes('Ramesh'), false);
});

test('the database query does not even fetch the internal fields', () => {
  // Defence in depth: a leak needs both a projection miss and a serializer miss.
  for (const field of ['maintenanceHistory', 'lastCleaned', 'categoryId', 'gstAmount']) {
    assert.equal(PUBLIC_ROOM_FIELDS.includes(field), false,
      `${field} is selected from the database for a public endpoint`);
  }
  for (const field of ['type', 'capacity', 'pricePerNight', 'amenities', 'description', 'images']) {
    assert.equal(PUBLIC_ROOM_FIELDS.includes(field), true, `${field} is needed by the public view`);
  }
});

test('a missing room and missing sub-objects do not throw', () => {
  assert.equal(publicRoomView(null, billing), null);
  const sparse = publicRoomView({ _id: 'r2', type: 'standard', pricePerNight: 0 }, billing);
  assert.equal(sparse.capacity, 0);
  assert.deepEqual(sparse.amenities, []);
  assert.deepEqual(sparse.features, []);
  assert.deepEqual(sparse.images, []);
  assert.equal(sparse.description, '');
});

test('the GST-inclusive total is computed when the stored one is absent', () => {
  const room = { ...roomDoc(), totalPrice: undefined, pricePerNight: 1000 };
  const view = publicRoomView(room, { ...billing, roomGstRate: 5, roundAmounts: true });
  assert.equal(view.price, 1000);
  assert.equal(view.totalPrice, 1050);
});
