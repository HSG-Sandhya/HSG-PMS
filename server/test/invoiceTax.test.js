import test from 'node:test';
import assert from 'node:assert/strict';
import RestaurantCalculationUtils from '../services/templates/RestaurantCalculationUtils.js';

// A GST invoice states a taxable value and the tax on it. Backing that value out
// of a tax-inclusive total requires the rate we ACTUALLY charged; this module
// used to hardcode 5%, so any other configured rate printed a wrong taxable
// value on a compliant-looking invoice.
const at = (posGstRate) => ({ posGstRate, roundAmounts: true });

test('a GST-inclusive order is split at the configured rate, not at 5%', () => {
  const orders = [{ totalAmount: 504, gstIncluded: true, items: [] }];

  // 504 inclusive of 12% → base 450, tax 54.
  const twelve = RestaurantCalculationUtils.calculateRestaurantTotals(orders, 0, at(12));
  assert.equal(twelve.subtotal, 450);
  assert.equal(twelve.gstAmount, 54);
  assert.equal(twelve.total, 504);

  // The old hardcoded 5% would have claimed a base of 480 on the same money.
  const five = RestaurantCalculationUtils.calculateRestaurantTotals(orders, 0, at(5));
  assert.equal(five.subtotal, 480);
  assert.notEqual(five.subtotal, twelve.subtotal);
});

test('the taxable value and the tax always re-add to the total charged', () => {
  for (const rate of [0, 5, 12, 18, 28]) {
    const orders = [{ totalAmount: 1234, gstIncluded: true, items: [] }];
    const calc = RestaurantCalculationUtils.calculateRestaurantTotals(orders, 0, at(rate));
    assert.equal(
      Math.round((calc.subtotal + calc.gstAmount) * 100) / 100,
      calc.total,
      `subtotal + gst must equal total at ${rate}%`
    );
  }
});

test('with no billing passed, the canonical default rate applies', () => {
  const orders = [{ totalAmount: 105, gstIncluded: true, items: [] }];
  const calc = RestaurantCalculationUtils.calculateRestaurantTotals(orders, 0);
  // BILLING_DEFAULTS.posGstRate is 5, so 105 inclusive → base 100.
  assert.equal(calc.subtotal, 100);
  assert.equal(calc.gstAmount, 5);
});

// ── The hotel invoice's CGST/SGST split ─────────────────────────────────────
import { normalizeInvoiceContext } from '../services/invoiceTemplates/normalize.js';

test('the invoice taxes accommodation and food at their own configured rates', () => {
  const booking = {
    totalAmount: 1050,        // room, GST-inclusive at 5%  → taxable 1000
    restaurantCharges: 504,   // food, GST-inclusive at 12% → taxable 450
    paidAmount: 0,
    checkIn: new Date('2026-09-01'),
    checkOut: new Date('2026-09-02'),
  };
  const ctx = normalizeInvoiceContext({
    booking, hotel: {}, type: 'hotel',
    billing: { roomGstRate: 5, posGstRate: 12, roundAmounts: true },
  });

  assert.equal(ctx.totals.total, 1554);
  assert.equal(ctx.totals.subtotal, 1450);
  assert.equal(ctx.totals.cgst, 52);
  assert.equal(ctx.totals.sgst, 52);
  // Taxing the mixed total at a single 5% -- what the hardcode did -- would
  // have claimed a taxable value of 1480, overstating it by 30.
  assert.notEqual(ctx.totals.subtotal, Math.round((1554 / 1.05) * 100) / 100);
});

test('a tax invoice always reconciles: taxable + CGST + SGST = total', () => {
  for (const [roomGstRate, posGstRate] of [[5, 5], [5, 12], [12, 18], [18, 5], [0, 0]]) {
    const ctx = normalizeInvoiceContext({
      booking: { totalAmount: 7777, restaurantCharges: 3333, paidAmount: 0 },
      hotel: {}, type: 'hotel',
      billing: { roomGstRate, posGstRate, roundAmounts: true },
    });
    const sum = Math.round((ctx.totals.subtotal + ctx.totals.cgst + ctx.totals.sgst) * 100) / 100;
    assert.ok(
      Math.abs(sum - ctx.totals.total) <= 0.02,
      `at room ${roomGstRate}% / food ${posGstRate}%: ${sum} vs ${ctx.totals.total}`
    );
  }
});

// ── Per-line CGST/SGST on the compliance grid ───────────────────────────────
import { splitItemTax } from '../services/invoiceTemplates/formatters.js';

test('a line is split at its own rate, not at a flat 5%', () => {
  // A food line taxed at 12%: 1120 gross → 1000 taxable, 60 + 60.
  const food = splitItemTax({ amount: 1120, gstRate: 0.12 });
  assert.equal(food.taxable, 1000);
  assert.equal(food.cgst, 60);
  assert.equal(food.sgst, 60);

  // A banquet line at 18%: 1180 gross → 1000 taxable, 90 + 90.
  const banquet = splitItemTax({ amount: 1180, gstRate: 0.18 });
  assert.equal(banquet.taxable, 1000);
  assert.equal(banquet.cgst, 90);
  assert.equal(banquet.sgst, 90);
});

test('every split reconciles back to the gross amount', () => {
  for (const gstRate of [0, 0.05, 0.12, 0.18, 0.28]) {
    const t = splitItemTax({ amount: 4321, gstRate });
    const sum = Math.round((t.taxable + t.cgst + t.sgst) * 100) / 100;
    assert.ok(Math.abs(sum - t.gross) <= 0.02, `at ${gstRate}: ${sum} vs ${t.gross}`);
  }
});

test('banquet lines use the configured banquet rate', () => {
  const booking = {
    eventType: 'Corporate',
    // A GST-inclusive hall line: at 18% a 1180 gross is 1000 taxable.
    totalAmount: 1180,
    paidAmount: 0,
  };
  const at18 = normalizeInvoiceContext({
    booking, hotel: {}, type: 'banquet',
    billing: { roomGstRate: 5, posGstRate: 5, banquetGstRate: 18, roundAmounts: true },
  });
  const at28 = normalizeInvoiceContext({
    booking, hotel: {}, type: 'banquet',
    billing: { roomGstRate: 5, posGstRate: 5, banquetGstRate: 28, roundAmounts: true },
  });
  assert.equal(at18.totals.subtotal, 1000);
  // Changing the setting must change the split -- the proof it is no longer a
  // literal 18 in three separate files.
  assert.notEqual(at28.totals.subtotal, at18.totals.subtotal);
});
