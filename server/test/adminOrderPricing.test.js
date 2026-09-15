// The staff POS and the Restaurant screen build orders that land on a walk-in
// receipt or on a guest's room folio at checkout. Both used to persist the money
// the browser sent: createOrder did `new Order(req.body)`, and updateOrder
// handed the body to findByIdAndUpdate, which never runs the pre-save hook that
// recomputes a total.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import Table from '../models/Table.js';
import { createOrder, updateOrder } from '../controllers/restaurantController.js';
import { invalidateOperationalConfig } from '../config/operationalConfig.js';

const ready = await startDb();

const call = async (fn, req) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params: {}, query: {}, body: {}, user: { _id: new mongoose.Types.ObjectId() }, ...req }, res);
  return res;
};

const seedItem = async (price = 450) => {
  const category = await Category.create({ name: 'Mains' });
  return MenuItem.create({ name: 'Biryani', price, category: category._id, isAvailable: true });
};

test('admin order pricing', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { silenceOutbound(); await clearDb(); invalidateOperationalConfig(); });

  await t.test('a POS sale is priced from the menu, not from the till screen', async () => {
    const item = await seedItem(450);
    const res = await call(createOrder, { body: {
      orderType: 'pos',
      items: [{ itemId: String(item._id), name: 'Biryani', price: 1, quantity: 2 }],
      subtotal: 2, gst: 0.1, totalAmount: 2.1, gstIncluded: false,
      status: 'Completed', paymentMethod: 'cash', cashReceived: 2.1,
    } });
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Order.findOne().lean();
    assert.equal(stored.items[0].price, 450, 'the request set the price');
    assert.equal(stored.items[0].name, 'Biryani');
    assert.equal(stored.gst, 45, '5% of 900, not the submitted 0.1');
    assert.equal(stored.totalAmount, 945, 'the till screen set the total');
  });

  await t.test('a tax-inclusive claim cannot keep the tax', async () => {
    const item = await seedItem(450);
    const res = await call(createOrder, { body: {
      orderType: 'pos',
      items: [{ itemId: String(item._id), quantity: 1 }],
      gstIncluded: true, gst: 0, totalAmount: 450, status: 'Completed',
    } });
    assert.equal(res.statusCode, 201, res.body?.message);

    const stored = await Order.findOne().lean();
    assert.equal(stored.gstIncluded, false);
    assert.equal(stored.gst, 23, "5% of 450, rounded as the billing config asks");
    assert.equal(stored.totalAmount, 473);
  });

  await t.test('cash short of the total is no change, not a failed sale', async () => {
    const item = await seedItem(450);
    const res = await call(createOrder, { body: {
      orderType: 'pos', items: [{ itemId: String(item._id), quantity: 1 }],
      status: 'Completed', paymentMethod: 'cash', cashReceived: 100,
    } });
    assert.equal(res.statusCode, 201, res.body?.message);
    assert.equal((await Order.findOne().lean()).changeAmount, 0);
  });

  await t.test('editing an order re-prices it from the menu', async () => {
    const item = await seedItem(450);
    const table = await Table.create({ number: '5', capacity: 4 });
    const created = await call(createOrder, { body: {
      orderType: 'table', tableId: String(table._id),
      items: [{ itemId: String(item._id), quantity: 1 }], status: 'Pending',
    } });
    assert.equal(created.statusCode, 201, created.body?.message);
    const id = created.body._id;

    // Two now, and the browser still hopes to name the price.
    const res = await call(updateOrder, { params: { id: String(id) }, body: {
      orderType: 'table', tableId: String(table._id),
      items: [{ itemId: String(item._id), price: 1, quantity: 2 }],
      totalAmount: 2, gst: 0, status: 'Pending',
    } });
    assert.equal(res.statusCode, 200, res.body?.message);

    const stored = await Order.findById(id).lean();
    assert.equal(stored.items[0].quantity, 2);
    assert.equal(stored.items[0].price, 450);
    assert.equal(stored.totalAmount, 945, 'the edit set its own total');
  });

  await t.test('a status flip does not re-price food already served', async () => {
    const item = await seedItem(450);
    const table = await Table.create({ number: '6', capacity: 2 });
    const created = await call(createOrder, { body: {
      orderType: 'table', tableId: String(table._id),
      items: [{ itemId: String(item._id), quantity: 1 }], status: 'Pending',
    } });
    const id = created.body._id;

    // The kitchen raises the menu price while the guest is eating.
    await MenuItem.updateOne({ _id: item._id }, { price: 600 });

    // The screen PUTs the whole order back to change one field — items included,
    // with itemId populated, exactly as it was handed them.
    const res = await call(updateOrder, { params: { id: String(id) }, body: {
      ...created.body,
      items: [{ itemId: { _id: String(item._id), name: 'Biryani' }, name: 'Biryani', price: 450, quantity: 1 }],
      status: 'Completed',
    } });
    assert.equal(res.statusCode, 200, res.body?.message);

    const stored = await Order.findById(id).lean();
    assert.equal(stored.status, 'Completed');
    assert.equal(stored.totalAmount, 473, "the guest was re-billed at the new menu price");
    assert.equal(stored.items[0].price, 450);
  });

  await t.test('an item that is not on the menu is refused', async () => {
    const res = await call(createOrder, { body: {
      orderType: 'pos',
      items: [{ itemId: String(new mongoose.Types.ObjectId()), quantity: 1 }],
      status: 'Completed',
    } });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /not available/i);
    assert.equal(await Order.countDocuments(), 0);
  });
});
