// Two guests, one room, the same second.
//
// Every reservation path in this app checked availability and then, as a
// separate database operation, inserted the booking. Nothing held the room in
// between. This proves the window is closed — and, first, that the window was
// real: the control below runs the OLD check-then-insert shape against the same
// database and shows it double-books. Without that control, a green test here
// would only prove the harness cannot produce contention.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { createBooking } from '../controllers/bookingController.js';
import { createRoomBooking } from '../controllers/websiteController.js';
import { availabilityConflict } from '../services/inventory.js';
import { resetSequenceCache } from '../services/sequence.js';

const ready = await startDb();

// How many callers pile onto the same room at once.
const RUSH = 30;

const CHECK_IN = '2027-03-10';
const CHECK_OUT = '2027-03-12';

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const call = async (handler, body) => {
  const res = fakeRes();
  await handler({ body, params: {}, query: {}, user: { _id: new mongoose.Types.ObjectId() } }, res);
  return res;
};

const deskBooking = (roomId) => ({
  guestName: 'Rush Guest',
  phone: '9000000001',
  roomId: String(roomId),
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  totalAmount: 4000,
  bookingStatus: 'Confirmed',
});

const webBooking = (extra) => ({
  guest: { firstName: 'Web', lastName: 'Guest', email: 'rush@example.com', phone: '9000000002' },
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  paymentMethod: 'pay_at_hotel',
  ...extra,
});

const seedRoom = async (overrides = {}) =>
  Room.create({
    roomNumber: '101',
    type: 'Deluxe',
    pricePerNight: 2000,
    status: 'available',
    capacity: { adults: 2, children: 1 },
    ...overrides,
  });

const countBy = (results, code) => results.filter((r) => r.statusCode === code).length;

test('booking concurrency', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { silenceOutbound(); await clearDb(); resetSequenceCache(); });

  // ── The control ───────────────────────────────────────────────────────────
  // The old shape, run against this same database. If this does NOT produce a
  // double booking, the tests below prove nothing and this file needs fixing.
  await t.test('CONTROL: an unguarded check-then-insert really does double-book', async () => {
    const room = await seedRoom();

    const unguarded = async () => {
      const conflict = await availabilityConflict(Booking, Room, {
        roomId: room._id, checkIn: CHECK_IN, checkOut: CHECK_OUT,
      });
      if (conflict) return 'refused';
      // The gap: every caller has already decided the room is free.
      await Booking.create({
        guestName: 'Rush Guest', phone: '9000000001', roomId: room._id,
        checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
        totalAmount: 4000, bookingStatus: 'Confirmed',
        customerId: `CTRL${Math.random()}`, invoiceNumber: `CTRL-${Math.random()}`,
      });
      return 'booked';
    };

    const results = await Promise.all(Array.from({ length: RUSH }, unguarded));
    const booked = results.filter((r) => r === 'booked').length;

    assert.ok(booked > 1, `the race did not reproduce (${booked} booked) — this harness cannot detect it`);
    assert.equal(await Booking.countDocuments(), booked);
  });

  // ── The front desk ────────────────────────────────────────────────────────
  await t.test(`${RUSH} simultaneous desk bookings for one room: exactly one wins`, async () => {
    const room = await seedRoom();

    const results = await Promise.all(
      Array.from({ length: RUSH }, () => call(createBooking, deskBooking(room._id))),
    );

    const created = countBy(results, 201);
    const refused = countBy(results, 409);

    assert.equal(created, 1, `${created} bookings were accepted for the same room`);
    assert.equal(refused, RUSH - 1, `expected ${RUSH - 1} refusals, got ${refused}`);
    assert.equal(await Booking.countDocuments(), 1, 'more than one booking reached the database');

    // And the refusal has to say something useful, not just fail.
    const rejected = results.find((r) => r.statusCode === 409);
    assert.match(rejected.body.message, /already booked|already reserved/i);
  });

  // ── The public website ────────────────────────────────────────────────────
  await t.test(`${RUSH} simultaneous website bookings cannot oversell a category`, async () => {
    await seedRoom({ roomNumber: '201' });
    await seedRoom({ roomNumber: '202' });

    const results = await Promise.all(
      Array.from({ length: RUSH }, () => call(createRoomBooking, webBooking({ roomType: 'Deluxe' }))),
    );

    // Two physical Deluxe rooms => at most two category holds.
    assert.equal(countBy(results, 201), 2, 'the site sold more rooms than the hotel has');
    assert.equal(await Booking.countDocuments(), 2);
  });

  await t.test('the website can no longer book a room another guest already has', async () => {
    const room = await seedRoom();

    // An existing stay on this exact room.
    await Booking.create({
      guestName: 'Already Here', phone: '9000000009', roomId: room._id,
      checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
      totalAmount: 4000, bookingStatus: 'Confirmed',
      customerId: 'EXIST1', invoiceNumber: 'EXIST-1',
    });

    // Not a race at all: naming a roomId skipped every check the site had.
    const res = await call(createRoomBooking, webBooking({ roomId: String(room._id) }));

    assert.equal(res.statusCode, 409, 'the site booked straight over an existing guest');
    assert.equal(await Booking.countDocuments(), 1);
  });

  // ── The two doors at once ─────────────────────────────────────────────────
  await t.test('the front desk and the website cannot take the same room together', async () => {
    const room = await seedRoom();

    const results = await Promise.all([
      ...Array.from({ length: RUSH / 2 }, () => call(createBooking, deskBooking(room._id))),
      ...Array.from({ length: RUSH / 2 }, () => call(createRoomBooking, webBooking({ roomId: String(room._id) }))),
    ]);

    assert.equal(countBy(results, 201), 1, 'the two booking paths do not exclude each other');
    assert.equal(await Booking.countDocuments(), 1);
  });

  // ── What counts as "taken" ────────────────────────────────────────────────
  // The public site used a narrower status list than the front desk, so these
  // two rooms were advertised as free. Neither is a race: it happened every time.
  await t.test('a room with a guest checked into it is not on sale', async () => {
    const room = await seedRoom();
    await Booking.create({
      guestName: 'In House', phone: '9000000010', roomId: room._id,
      checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
      totalAmount: 4000, bookingStatus: 'Checked-In', checkedIn: true,
      customerId: 'INHOUSE1', invoiceNumber: 'INHOUSE-1',
    });

    const res = await call(createRoomBooking, webBooking({ roomType: 'Deluxe' }));
    assert.equal(res.statusCode, 409, 'the site sold a room with a guest in it');
    assert.equal(await Booking.countDocuments(), 1);
  });

  await t.test('an unconfirmed hold still holds the room', async () => {
    const room = await seedRoom();
    await Booking.create({
      guestName: 'Holding', phone: '9000000011', roomId: room._id,
      checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
      totalAmount: 4000, bookingStatus: 'Tentative',
      customerId: 'TENT1', invoiceNumber: 'TENT-1',
    });

    const res = await call(createRoomBooking, webBooking({ roomType: 'Deluxe' }));
    assert.equal(res.statusCode, 409, 'a tentative hold did not hold anything');
  });

  await t.test('a cancelled booking releases the room', async () => {
    const room = await seedRoom();
    await Booking.create({
      guestName: 'Gone Away', phone: '9000000012', roomId: room._id,
      checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
      totalAmount: 4000, bookingStatus: 'Cancelled',
      customerId: 'CANC1', invoiceNumber: 'CANC-1',
    });

    const res = await call(createRoomBooking, webBooking({ roomType: 'Deluxe' }));
    assert.equal(res.statusCode, 201, 'a cancelled booking must not keep holding the room');
  });

  // ── Editing is a reservation too ──────────────────────────────────────────
  await t.test('overbooking, when the hotel switches it on, is still honoured', async () => {
    const room = await seedRoom();
    await Booking.create({
      guestName: 'Already Here', phone: '9000000009', roomId: room._id,
      checkIn: new Date(CHECK_IN), checkOut: new Date(CHECK_OUT),
      totalAmount: 4000, bookingStatus: 'Confirmed',
      customerId: 'EXIST2', invoiceNumber: 'EXIST-2',
    });

    const conflict = await availabilityConflict(Booking, Room, {
      roomId: room._id, checkIn: CHECK_IN, checkOut: CHECK_OUT, allowOverbooking: true,
    });
    assert.equal(conflict, null, 'the lock must not override the hotel\'s own setting');
  });
});
