// Moving a guest between rooms is a reservation, a room state and a bill all at
// once, and it used to answer each of them on its own terms: its own narrower
// idea of "taken", its own idea of when a room is occupied, and whatever price
// adjustment the browser sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Housekeeping from '../models/Housekeeping.js';
import { createBooking, transferRoom } from '../controllers/bookingController.js';
import { resetSequenceCache } from '../services/sequence.js';
import { invalidateOperationalConfig } from '../config/operationalConfig.js';

const ready = await startDb();

const CHECK_IN = '2027-06-01';
const CHECK_OUT = '2027-06-04';   // 3 nights
const NIGHTS = 3;

const call = async (fn, req) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params: {}, query: {}, body: {}, user: { _id: new mongoose.Types.ObjectId() }, ...req }, res);
  return res;
};

const seedRooms = async () => ({
  a: await Room.create({ roomNumber: '101', type: 'Deluxe', pricePerNight: 2000, status: 'available', capacity: { adults: 2 } }),
  b: await Room.create({ roomNumber: '102', type: 'Suite', pricePerNight: 3000, status: 'available', capacity: { adults: 2 } }),
});

const book = async (roomId, extra = {}) => {
  const res = await call(createBooking, { body: {
    guestName: 'Desk Guest', phone: '9000000001', roomId: String(roomId),
    checkIn: CHECK_IN, checkOut: CHECK_OUT, bookingStatus: 'Confirmed', ...extra,
  } });
  assert.equal(res.statusCode, 201, res.body?.message);
  return res.body.data;
};

const move = (bookingId, toRoomId, body = {}) =>
  call(transferRoom, { params: { id: String(bookingId) }, body: { toRoomId: String(toRoomId), ...body } });

test('room transfer', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => {
    silenceOutbound(); await clearDb(); resetSequenceCache(); invalidateOperationalConfig();
  });

  await t.test('a room with a checked-in guest is not somewhere to move a second guest', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });
    await book(b._id);
    // The group workflow's own status for a guest in residence. The old query
    // looked for ['Confirmed', 'Pending'] only, so this was invisible to it.
    await Booking.updateOne({ roomId: b._id }, { bookingStatus: 'Checked-In', checkedIn: true });

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 409, 'a guest was moved on top of one already in the room');
    assert.equal(String((await Booking.findById(guest._id)).roomId), String(a._id), 'the booking moved anyway');
  });

  await t.test('a tentative hold on the destination blocks the move too', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });
    await book(b._id);
    await Booking.updateOne({ roomId: b._id }, { bookingStatus: 'Tentative' });

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 409);
  });

  await t.test('a free room accepts the guest, and the rooms follow who is in them', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });

    const res = await move(guest._id, b._id, { reason: 'AC not working' });
    assert.equal(res.statusCode, 200, res.body?.message);

    const [from, to] = [await Room.findById(a._id).lean(), await Room.findById(b._id).lean()];
    assert.equal(to.status, 'occupied', 'the guest is in 102 now');
    assert.equal(from.status, 'cleaning', 'the vacated room needs cleaning');
    const task = await Housekeeping.findOne({ roomId: a._id }).lean();
    assert.ok(task, 'the vacated room was left dirty with no housekeeping task');
    assert.equal(task.source, 'room_transfer');

    const stored = await Booking.findById(guest._id).lean();
    assert.equal(stored.transferHistory.length, 1);
    assert.equal(stored.transferHistory[0].reason, 'AC not working');
  });

  await t.test('re-rooming a reservation nobody has arrived for occupies nothing', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id);   // confirmed, not checked in

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 200, res.body?.message);

    const [from, to] = [await Room.findById(a._id).lean(), await Room.findById(b._id).lean()];
    assert.equal(to.status, 'available', 'a room was marked occupied for a guest who has not arrived');
    assert.equal(from.status, 'available', 'a room was sent for cleaning that nobody slept in');
    assert.equal(await Housekeeping.countDocuments({ roomId: a._id }), 0, 'housekeeping was sent to clean an unused room');
  });

  await t.test('the browser cannot name its own price for the move', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });
    const before = await Booking.findById(guest._id).lean();
    assert.equal(before.totalAmount, 2000 * NIGHTS * 1.05);

    // The old code added this straight to totalAmount: a ₹6,300 stay became ₹400.
    const res = await move(guest._id, b._id, { priceAdjustment: -5900 });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findById(guest._id).lean();
    assert.equal(after.roomRate, 3000, 'the guest now pays the suite rate');
    assert.equal(after.baseAmount, 3000 * NIGHTS);
    assert.equal(after.gstAmount, 3000 * NIGHTS * 0.05);
    assert.equal(after.totalAmount, 3000 * NIGHTS * 1.05, 'the request set the price');
    // base + GST and the total tell the same story, so the invoice and the folio agree.
    assert.equal(after.totalAmount, after.baseAmount + after.gstAmount);
    assert.equal(after.transferHistory[0].priceAdjustment, 3150, 'the recorded adjustment is the derived one');
  });

  await t.test('a bargained tariff keeps its bargain, and moves by the difference', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true, roomRate: 1500 });   // ₹500 off the list 2000

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findById(guest._id).lean();
    assert.equal(after.roomRate, 2500, 'the ₹500 discount followed the guest into the suite');
    assert.equal(after.baseAmount, 2500 * NIGHTS, 'roomRate x nights still reconstructs the base');
  });

  await t.test('the desk can move a guest at no charge', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });
    const before = await Booking.findById(guest._id).lean();

    const res = await move(guest._id, b._id, { priceAdjustment: 0 });
    assert.equal(res.statusCode, 200, res.body?.message);

    const after = await Booking.findById(guest._id).lean();
    assert.equal(after.totalAmount, before.totalAmount, 'a waived upgrade still charged');
    assert.equal(String(after.roomId), String(b._id), 'the guest moved');
    assert.equal(after.transferHistory[0].priceAdjustment, 0);
  });

  await t.test('a finished stay has no guest to move', async () => {
    const { a, b } = await seedRooms();
    const guest = await book(a._id, { checkedIn: true });
    await Booking.updateOne({ _id: guest._id }, { bookingStatus: 'Completed', checkedIn: false, checkedOutAt: new Date() });

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 409, 'a settled folio was rewritten by a transfer');
  });

  await t.test('a room under maintenance is not a destination', async () => {
    const { a, b } = await seedRooms();
    await Room.updateOne({ _id: b._id }, { status: 'maintenance' });
    const guest = await book(a._id, { checkedIn: true });

    const res = await move(guest._id, b._id);
    assert.equal(res.statusCode, 409);
  });
});
