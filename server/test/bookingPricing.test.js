import test from 'node:test';
import assert from 'node:assert/strict';
import { nightsBetween, BookingPricingError } from '../services/bookingPricing.js';

// The public booking endpoint used to persist baseAmount, gstAmount and
// totalAmount straight from the request body. quoteStay() is what replaced
// them; nightsBetween is its date arithmetic, unit-testable without a database.
test('nights are counted between the dates, minimum one', () => {
  assert.equal(nightsBetween('2026-09-10', '2026-09-11'), 1);
  assert.equal(nightsBetween('2026-09-10', '2026-09-17'), 7);
  assert.equal(nightsBetween('2026-12-30', '2027-01-02'), 3);
});

test('a same-day or reversed range is refused, not silently priced', () => {
  // A zero- or negative-night stay previously multiplied out to a total of 0.
  assert.throws(() => nightsBetween('2026-09-10', '2026-09-10'), BookingPricingError);
  assert.throws(() => nightsBetween('2026-09-17', '2026-09-10'), BookingPricingError);
});

test('unparseable dates are refused rather than yielding NaN', () => {
  for (const [a, b] of [['', '2026-09-11'], ['not-a-date', '2026-09-11'], ['2026-09-10', null]]) {
    assert.throws(() => nightsBetween(a, b), BookingPricingError);
  }
});

test('a partial day still bills the whole night', () => {
  assert.equal(nightsBetween('2026-09-10T14:00:00Z', '2026-09-11T10:00:00Z'), 1);
  assert.equal(nightsBetween('2026-09-10T14:00:00Z', '2026-09-12T10:00:00Z'), 2);
});
