// What the guest is charged for their room-service food, what the invoice
// prints, and what the books record all have to be the same set of orders.
// They were three different sets.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Order from '../models/Order.js';
import Table from '../models/Table.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import AccountingEntry from '../models/AccountingEntry.js';
import { updateOrder } from '../controllers/restaurantController.js';
import { syncRoomBookingIncome } from '../services/accountingSync.js';
import { invalidateOperationalConfig } from '../config/operationalConfig.js';

const ready = await startDb();

const call = async (fn, req) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params: {}, query: {}, body: {}, user: { _id: new mongoose.Types.ObjectId() }, ...req }, res);
  return res;
};

test('the room folio', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { silenceOutbound(); await clearDb(); invalidateOperationalConfig(); });

  await t.test('an order moved off room service stops pointing at the booking', async () => {
    // The stale link is what let the printed invoice bill food the checkout
    // screen had already dropped: the desk filters by orderType, the invoice
    // query did not.
    const bookingId = new mongoose.Types.ObjectId();
    const table = await Table.create({ number: '5', capacity: 4 });
    const order = await Order.create({
      orderNumber: 'ORD-1', orderType: 'room', roomId: bookingId,
      items: [], totalAmount: 500, gst: 25, status: 'Pending',
    });

    const res = await call(updateOrder, {
      params: { id: String(order._id) },
      body: { orderType: 'table', tableId: String(table._id), totalAmount: 500, gst: 25, status: 'Pending' },
    });
    assert.equal(res.statusCode, 200);

    const after = await Order.findById(order._id).lean();
    assert.equal(after.orderType, 'table');
    assert.equal(after.roomId, undefined, 'the order still bills to a booking it left');
  });

  await t.test('food billed at checkout is booked as food, whatever the kitchen ticket says', async () => {
    const room = await Room.create({
      roomNumber: '101', type: 'Deluxe', pricePerNight: 2000, status: 'available', capacity: { adults: 2 },
    });
    const booking = await Booking.create({
      guestName: 'Folio Guest', phone: '9000000002', roomId: room._id,
      checkIn: new Date('2027-07-01'), checkOut: new Date('2027-07-02'),
      customerId: 'FG202707011000', invoiceNumber: 'HSG-010727-FG-1000',
      baseAmount: 2000, gstAmount: 100, totalAmount: 2100,
      // Checked out having paid the room AND a ₹525 room-service tray.
      paidAmount: 2625, bookingStatus: 'Completed', checkedOutAt: new Date(),
      paymentMethod: 'Cash',
    });
    // The tray was served and billed, but nobody closed the ticket — the
    // ordinary state of a room order at checkout.
    await Order.create({
      orderNumber: 'ORD-2', orderType: 'room', roomId: booking._id,
      items: [], totalAmount: 525, gst: 25, status: 'Pending',
    });

    await syncRoomBookingIncome(booking);

    const food = await AccountingEntry.findOne({ sourceRef: 'room_service' }).lean();
    assert.ok(food, 'the food was not posted at all');
    assert.ok(food.total > 0, 'the guest paid for food that the books did not recognise as food');
    assert.equal(food.total, 525, 'the food line does not match what was billed');
    assert.equal(food.category, 'Restaurant Revenue');

    // ...and the room line is the room only, not the room plus somebody's dinner.
    const roomLine = await AccountingEntry.findOne({ sourceRef: '', category: 'Room Revenue' }).lean();
    assert.equal(roomLine.total, 2100, 'food money was misfiled as room revenue');
  });
});
