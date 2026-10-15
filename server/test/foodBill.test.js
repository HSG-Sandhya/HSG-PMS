import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInvoiceContext } from '../services/invoiceTemplates/normalize.js';
import { renderInvoice, getTemplateList } from '../services/invoiceTemplates/index.js';
import { renderFoodBillSection } from '../services/invoiceTemplates/foodBillSection.js';

// Restaurant charges are billed on a document of their own, never as lines on
// the stay invoice. Food is taxed at the POS rate and often sits under a
// separate GST registration, so one document cannot honestly carry both.

const hotel = {
  name: 'Hotel Sandhya Grand & Marriage Hall',
  address: 'Bari Bazaar, Munger, Bihar',
  contact: { phone: '9431419196', email: 'reservations@sandhyagrand.in' },
  gstin: '10ASQPM7914B3ZW',
  restaurant: { name: 'Sandhya Kitchen & Bar', gstin: '10ASQPM7914B1ZY', fssai: '10820004000123' },
};

const ORDERS = [
  {
    orderNumber: 'R-1001', totalAmount: 1450, gstIncluded: true, createdAt: new Date('2026-09-20'),
    items: [
      { name: 'Paneer Tikka', price: 450, quantity: 2 },
      { name: 'Butter Naan', price: 70, quantity: 5 },
      { name: 'Masala Chai', price: 100, quantity: 2 },
    ],
  },
  {
    orderNumber: 'R-1002', totalAmount: 950, gstIncluded: true, createdAt: new Date('2026-09-21'),
    items: [
      { name: 'Veg Biryani', price: 380, quantity: 2 },
      { name: 'Gulab Jamun', price: 190, quantity: 1 },
    ],
  },
];

const stay = (over = {}) => ({
  guestName: 'Mr. Rohan Verma',
  phone: '9876501234',
  roomId: { roomNumber: '204', roomType: 'Deluxe AC', pricePerNight: 4500 },
  checkIn: new Date('2026-09-19'),
  checkOut: new Date('2026-09-22'),
  adults: 2,
  totalAmount: 13500,
  paidAmount: 10000,
  ...over,
});

const billing = { roomGstRate: 5, posGstRate: 5, roundAmounts: true };
const ctxFor = (booking) => normalizeInvoiceContext({ booking, hotel, type: 'hotel', billing });

// ── The split ───────────────────────────────────────────────────────────────

test('food never appears on the stay invoice', () => {
  const ctx = ctxFor(stay({ restaurantCharges: 2400, restaurantOrders: ORDERS }));
  assert.ok(!ctx.items.some((i) => i.category === 'restaurant'),
    'a restaurant line on the stay invoice would bill the guest for food twice');
  assert.equal(ctx.totals.total, 13500, 'the stay invoice totals accommodation alone');
  assert.equal(ctx.food.total, 2400, 'and the food is on its own bill');
});

test('a stay with no food produces no food bill and no second document', () => {
  const ctx = ctxFor(stay());
  assert.equal(ctx.food, null);
  assert.equal(ctx.settlement, null);
  assert.equal(renderFoodBillSection(ctx, null), '', 'nothing to print means nothing printed');
});

test('a zero restaurant charge is not a food bill', () => {
  const ctx = ctxFor(stay({ restaurantCharges: 0, restaurantOrders: [] }));
  assert.equal(ctx.food, null);
});

// ── The bill has to add up ──────────────────────────────────────────────────

test('the printed food lines always reconcile to the food bill total', () => {
  // Three shapes the booking data actually comes in. The dish-level breakdown
  // silently skips an order that carries a total but no item detail, so the
  // lines must fall back until what is printed matches what is charged.
  const shapes = {
    'itemised orders': { orders: ORDERS, charges: 0 },
    'an order with a total but no items': {
      orders: [ORDERS[0], { orderNumber: 'R-9', totalAmount: 950, items: [], createdAt: new Date() }],
      charges: 0,
    },
    'no orders, only a stored charge': { orders: [], charges: 2400 },
  };
  for (const [label, { orders, charges }] of Object.entries(shapes)) {
    const ctx = ctxFor(stay({ restaurantCharges: charges, restaurantOrders: orders }));
    const sum = Math.round(ctx.food.items.reduce((s, i) => s + Number(i.amount || 0), 0) * 100) / 100;
    assert.ok(Math.abs(sum - ctx.food.total) <= 1,
      `${label}: lines sum to ${sum} under a total of ${ctx.food.total}`);
    assert.ok(ctx.food.items.length > 0, `${label}: a bill with a total needs at least one line`);
  }
});

test('the food bill states the POS rate, not the room rate', () => {
  const ctx = normalizeInvoiceContext({
    booking: stay({ restaurantCharges: 1120, restaurantOrders: [] }),
    hotel, type: 'hotel',
    billing: { roomGstRate: 5, posGstRate: 12, roundAmounts: true },
  });
  assert.equal(ctx.food.gstRate, 12);
  assert.equal(ctx.food.subtotal, 1000);
  assert.equal(ctx.food.cgst + ctx.food.sgst, 120);
});

// ── One payment, two documents ──────────────────────────────────────────────

test('payment is attributed food first, accommodation second', () => {
  // The same split accountingSync.js uses (roomPaid = paid − foodTotal), so the
  // printed invoice and the books never disagree about what the room earned.
  const ctx = ctxFor(stay({ restaurantCharges: 2400, restaurantOrders: ORDERS, paidAmount: 10000 }));
  assert.equal(ctx.totals.paid, 7600, 'the room is credited what is left after food');
  assert.equal(ctx.totals.balance, 5900);
  assert.equal(ctx.settlement.paid, 10000, 'the settlement still shows the whole payment');
  assert.equal(ctx.settlement.balance, 5900);
});

test('a payment smaller than the food bill never credits the room a negative', () => {
  const ctx = ctxFor(stay({ restaurantCharges: 2400, restaurantOrders: ORDERS, paidAmount: 500 }));
  assert.equal(ctx.totals.paid, 0);
  assert.equal(ctx.totals.status, 'unpaid');
});

test('the settlement is the one place the two documents are added together', () => {
  const ctx = ctxFor(stay({ restaurantCharges: 2400, restaurantOrders: ORDERS }));
  const s = ctx.settlement;
  assert.equal(s.accommodationTotal, ctx.totals.total);
  assert.equal(s.foodTotal, ctx.food.total);
  assert.equal(s.combinedTotal, ctx.totals.total + ctx.food.total);
  assert.equal(s.roomInvoiceNumber, ctx.invoice.number);
  assert.equal(s.foodBillNumber, ctx.food.number);
  assert.notEqual(s.foodBillNumber, s.roomInvoiceNumber, 'the two documents need distinct numbers');
});

// ── Identity ────────────────────────────────────────────────────────────────

test('the food bill prints under the restaurant’s own GST identity', () => {
  const ctx = ctxFor(stay({ restaurantCharges: 2400, restaurantOrders: ORDERS }));
  const html = renderFoodBillSection(ctx, null);
  assert.ok(html.includes('Sandhya Kitchen &amp; Bar'), 'the restaurant name should head the bill');
  assert.ok(html.includes('10ASQPM7914B1ZY'), 'and its own GSTIN, not the hotel’s');
  assert.ok(html.includes('10820004000123'), 'FSSAI belongs on a food bill');
});

test('with no separate restaurant registration it falls back to the hotel’s', () => {
  const plain = { name: 'Hotel Sandhya Grand', gstin: '10ASQPM7914B3ZW', contact: {} };
  const ctx = normalizeInvoiceContext({
    booking: stay({ restaurantCharges: 2400, restaurantOrders: ORDERS }),
    hotel: plain, type: 'hotel', billing,
  });
  assert.equal(ctx.hotel.restaurant.name, 'Hotel Sandhya Grand');
  assert.equal(ctx.hotel.restaurant.gstin, '10ASQPM7914B3ZW');
});

// ── Every design gets it ────────────────────────────────────────────────────

test('EVERY room design renders the food bill as a separate document', async () => {
  // This is the point of putting the bill in the shared layer rather than
  // writing it into each design: none of them can be left behind.
  const booking = stay({ restaurantCharges: 2400, restaurantOrders: ORDERS });
  for (const meta of getTemplateList()) {
    const html = await renderInvoice({
      booking, hotel, type: 'hotel', templateId: meta.id, customization: { animation: 'off' },
    });
    assert.ok(html.includes('fb-doc'), `${meta.id} is missing the food bill`);
    assert.ok(html.includes('Food Bill'), `${meta.id} does not label the food bill`);
    assert.ok(html.includes('Combined total'), `${meta.id} does not reconcile the two documents`);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), `${meta.id} leaked a placeholder`);
  }
});

test('a room-only stay stays a single document on every design', async () => {
  const booking = stay();
  for (const meta of getTemplateList()) {
    const html = await renderInvoice({
      booking, hotel, type: 'hotel', templateId: meta.id, customization: { animation: 'off' },
    });
    assert.ok(!html.includes('fb-doc'), `${meta.id} printed an empty food bill`);
  }
});

test('the food bill is kept out of the single-page fit', async () => {
  // The fit shrinks the stay invoice onto one sheet. Sweeping a second document
  // into it would squeeze both onto that sheet instead of giving the food bill
  // its own, so the wrapper has to skip anything marked data-fit-exempt.
  const html = await renderInvoice({
    booking: stay({ restaurantCharges: 2400, restaurantOrders: ORDERS }),
    hotel, type: 'hotel', templateId: 'aurora-luxe', customization: { animation: 'off' },
  });
  assert.ok(html.includes('data-fit-exempt'), 'the food bill must be marked exempt');
  assert.ok(html.includes("hasAttribute('data-fit-exempt')"),
    'and the fit script must actually honour the marker');
  assert.ok(html.includes('page-break-before: always'), 'it starts a new sheet');
});

// ── Banquet is unaffected ───────────────────────────────────────────────────

test('banquet catering stays on the event bill and grows no food bill', () => {
  // Catering is part of what the event was quoted, already itemised there.
  const ctx = normalizeInvoiceContext({
    booking: {
      customerName: 'Aarav & Diya Sharma',
      hallId: { name: 'Grand Banquet Hall' },
      eventDate: new Date('2026-10-02'),
      guestCount: 150,
      hallCharges: 25000,
      totalAmount: 132500,
      paidAmount: 50000,
    },
    hotel, type: 'banquet', billing,
  });
  assert.equal(ctx.food, null);
  assert.equal(ctx.settlement, null);
});
