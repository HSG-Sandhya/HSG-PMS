import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequestedQuantities, OrderPricingError } from '../services/orderPricing.js';

// The public ordering endpoints are unauthenticated, so the cart in the request
// body is attacker-controlled. readRequestedQuantities is the boundary: whatever
// it does not carry forward cannot reach the Order document.
const ID_A = '507f1f77bcf86cd799439011';
const ID_B = '507f1f77bcf86cd799439012';

test('the submitted price and name are discarded, not carried forward', () => {
  const hostile = [{ itemId: ID_A, name: 'Biryani', price: 1, quantity: 10 }];
  const wanted = readRequestedQuantities(hostile);
  // The result is a plain id→quantity map. There is nowhere for a price to live,
  // which is what makes the manipulation structurally impossible rather than
  // merely checked-for.
  assert.deepEqual([...wanted.entries()], [[ID_A, 10]]);
});

test('an empty or missing cart is rejected', () => {
  for (const bad of [undefined, null, [], {}, 'items']) {
    assert.throws(() => readRequestedQuantities(bad), OrderPricingError);
  }
});

test('an item id that is not an ObjectId is rejected before any lookup', () => {
  for (const bad of ['', 'not-an-id', '123', { $ne: null }, null]) {
    assert.throws(
      () => readRequestedQuantities([{ itemId: bad, quantity: 1 }]),
      OrderPricingError,
      `expected ${JSON.stringify(bad)} to be rejected`
    );
  }
});

test('quantities must be whole numbers of at least one', () => {
  for (const bad of [0, -1, -100, 1.5, NaN, Infinity, 'two', undefined]) {
    assert.throws(
      () => readRequestedQuantities([{ itemId: ID_A, quantity: bad }]),
      OrderPricingError,
      `expected quantity ${String(bad)} to be rejected`
    );
  }
});

test('duplicate cart lines for the same dish sum instead of overwriting', () => {
  const wanted = readRequestedQuantities([
    { itemId: ID_A, quantity: 2 },
    { itemId: ID_B, quantity: 1 },
    { itemId: ID_A, quantity: 3 },
  ]);
  assert.equal(wanted.get(ID_A), 5);
  assert.equal(wanted.get(ID_B), 1);
});

test('per-item and per-order caps hold, including via split lines', () => {
  assert.throws(() => readRequestedQuantities([{ itemId: ID_A, quantity: 101 }]), OrderPricingError);
  // Splitting the quantity across lines must not slip past the same cap.
  assert.throws(
    () => readRequestedQuantities([
      { itemId: ID_A, quantity: 60 },
      { itemId: ID_A, quantity: 60 },
    ]),
    OrderPricingError
  );
  const tooManyLines = Array.from({ length: 51 }, () => ({ itemId: ID_A, quantity: 1 }));
  assert.throws(() => readRequestedQuantities(tooManyLines), OrderPricingError);
});

test('a legitimate cart passes', () => {
  const wanted = readRequestedQuantities([
    { itemId: ID_A, quantity: 2 },
    { itemId: ID_B, quantity: 100 },
  ]);
  assert.equal(wanted.size, 2);
  assert.equal(wanted.get(ID_B), 100);
});
