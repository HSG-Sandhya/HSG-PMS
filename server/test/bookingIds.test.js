// Two clerks, one second, one number.
//
// customerId carries a unique index, so the old read-latest-then-add-one
// generator did not produce duplicates — it produced an E11000 on save, which
// reaches the front desk as "Internal server error" and loses the booking.
// The CONTROL below reproduces that against the same database, so a green run
// here means the race is closed rather than merely unreachable in this harness.
import test from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, skipReason, silenceOutbound } from './helpers/memoryDb.js';
import Booking from '../models/Booking.js';
import BanquetBooking from '../models/BanquetBooking.js';
import Room from '../models/Room.js';
import mongoose from 'mongoose';
import { createBooking } from '../controllers/bookingController.js';
import { nextCustomerId, nextEventCustomerId, nextInvoiceNumber } from '../services/bookingIds.js';
import { createRoomBooking } from '../controllers/websiteController.js';
import { resetSequenceCache } from '../services/sequence.js';

const ready = await startDb();
const RUSH = 50;
const CHECK_IN = '2027-04-20';

test('booking id generation', { skip: ready ? false : skipReason, timeout: 120_000 }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { silenceOutbound(); await clearDb(); resetSequenceCache(); });

  await t.test('CONTROL: the old read-then-add generator really does collide', async () => {
    // Verbatim shape of what createBooking used to do.
    const legacy = async () => {
      const day = new Date(CHECK_IN);
      const start = new Date(day); start.setHours(0, 0, 0, 0);
      const end = new Date(day); end.setHours(23, 59, 59, 999);
      const forDay = await Booking.find({ checkIn: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
      let seq = 1001;
      if (forDay.length > 0) {
        const lastSeq = forDay[0].customerId ? parseInt(String(forDay[0].customerId).slice(-4), 10) : 1000;
        seq = Number.isNaN(lastSeq) ? 1001 : lastSeq + 1;
      }
      return `RG20270420${seq}`;
    };

    const ids = await Promise.all(Array.from({ length: RUSH }, legacy));
    assert.ok(
      new Set(ids).size < ids.length,
      `the race did not reproduce (${new Set(ids).size} distinct of ${ids.length}) — this harness cannot detect it`,
    );
  });

  await t.test(`${RUSH} simultaneous callers get ${RUSH} distinct ids`, async () => {
    const ids = await Promise.all(
      Array.from({ length: RUSH }, () => nextCustomerId('Rush Guest', CHECK_IN)),
    );
    assert.equal(new Set(ids).size, RUSH, 'two callers were handed the same customer id');
    assert.ok(ids.every((id) => /^RG\d{8}\d+$/.test(id)), 'the id format changed');
  });

  await t.test('the counter continues an existing series rather than colliding with it', async () => {
    // A booking already numbered 1007 for that arrival day.
    await Booking.create({
      guestName: 'Earlier Guest', phone: '9000000001',
      checkIn: new Date(CHECK_IN), checkOut: new Date('2027-04-22'),
      totalAmount: 1000, bookingStatus: 'Confirmed',
      customerId: 'EG202704201007', invoiceNumber: 'SEED-1',
    });

    const id = await nextCustomerId('New Guest', CHECK_IN);
    const seq = Number(id.match(/^[A-Z]+\d{8}(\d+)$/)[1]);
    assert.ok(seq > 1007, `expected a number above the existing 1007, got ${seq}`);
  });

  await t.test('the old generator picked the wrong row when a day was filled out of order', async () => {
    // Two bookings for the same ARRIVAL day, created in the opposite order to
    // their numbers. sort({createdAt:-1}) takes the newest CREATED — 1002 —
    // and would hand out 1003, colliding with nothing but skipping 1009.
    await Booking.create({
      guestName: 'High Number', phone: '9000000002',
      checkIn: new Date(CHECK_IN), checkOut: new Date('2027-04-21'),
      totalAmount: 1000, bookingStatus: 'Confirmed',
      customerId: 'HN202704201009', invoiceNumber: 'SEED-2',
    });
    await Booking.create({
      guestName: 'Low Number', phone: '9000000003',
      checkIn: new Date(CHECK_IN), checkOut: new Date('2027-04-21'),
      totalAmount: 1000, bookingStatus: 'Confirmed',
      customerId: 'LN202704201002', invoiceNumber: 'SEED-3',
    });

    const id = await nextCustomerId('Next Guest', CHECK_IN);
    const seq = Number(id.match(/^[A-Z]+\d{8}(\d+)$/)[1]);
    assert.ok(seq > 1009, `seeded from the wrong row: got ${seq}, expected above 1009`);
  });

  await t.test('a sequence past four digits still parses', async () => {
    // slice(-4) on "XX2027042012345" reads "2345" and walks the series backwards.
    await Booking.create({
      guestName: 'Big Number', phone: '9000000004',
      checkIn: new Date(CHECK_IN), checkOut: new Date('2027-04-21'),
      totalAmount: 1000, bookingStatus: 'Confirmed',
      customerId: 'BN2027042012345', invoiceNumber: 'SEED-4',
    });

    const id = await nextCustomerId('Next Guest', CHECK_IN);
    const seq = Number(id.match(/^[A-Z]+\d{8}(\d+)$/)[1]);
    assert.ok(seq > 12345, `five-digit sequence mis-parsed: got ${seq}`);
  });

  await t.test('different arrival days count independently', async () => {
    const a = await nextCustomerId('Guest One', '2027-04-20');
    const b = await nextCustomerId('Guest Two', '2027-04-21');
    assert.match(a, /^GO20270420/);
    assert.match(b, /^GT20270421/);
  });

  await t.test('initials survive odd names', async () => {
    assert.match(await nextCustomerId('Sunita', CHECK_IN), /^S\d{8}/);
    assert.match(await nextCustomerId('   ', CHECK_IN), /^G\d{8}/);
    assert.match(await nextCustomerId(null, CHECK_IN), /^G\d{8}/);
  });

  // ── End to end, through the controller ────────────────────────────────────
  // Different rooms, same arrival day: every booking succeeds, so this is where
  // the id race actually bit. With one room the inventory lock hides it, since
  // only one booking is ever written.
  await t.test('concurrent desk bookings for different rooms all succeed', async () => {
    const rooms = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        Room.create({
          roomNumber: `${101 + i}`, type: 'Deluxe', pricePerNight: 2000,
          status: 'available', capacity: { adults: 2, children: 1 },
        })),
    );

    const call = async (room, i) => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      await createBooking({
        body: {
          guestName: `Desk Guest ${i}`, phone: `900000${1000 + i}`,
          roomId: String(room._id), checkIn: CHECK_IN, checkOut: '2027-04-22',
          totalAmount: 4000, bookingStatus: 'Confirmed',
        },
        params: {}, query: {}, user: { _id: new mongoose.Types.ObjectId() },
      }, res);
      return res;
    };

    const results = await Promise.all(rooms.map(call));
    const created = results.filter((r) => r.statusCode === 201);
    const failed = results.filter((r) => r.statusCode >= 500);

    assert.equal(failed.length, 0,
      `${failed.length} booking(s) hit a server error: ${failed[0]?.body?.message}`);
    assert.equal(created.length, rooms.length, 'not every booking was accepted');

    const ids = (await Booking.find().select('customerId').lean()).map((b) => b.customerId);
    assert.equal(new Set(ids).size, rooms.length, 'two bookings share a customer id');
  });

  // ── Invoice numbers ───────────────────────────────────────────────────────
  // Both generators were already atomic; what differed was the FORMAT. The
  // website minted a bare "HSG-1001" while every invoice the hotel has issued
  // looks like "HSG-010826-HK-1001". No online booking had reached production,
  // so the first one would have opened a second, differently-shaped series.
  await t.test('the desk and the website mint the same invoice format', async () => {
    const desk = await nextInvoiceNumber('Hari Kumar', '2026-08-01');
    assert.match(desk, /^[A-Z]+-\d{6}-HK-\d{4}$/, `unexpected desk format: ${desk}`);

    const rooms = await Room.create({
      roomNumber: '301', type: 'Deluxe', pricePerNight: 2000,
      status: 'available', capacity: { adults: 2, children: 1 },
    });

    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    await createRoomBooking({
      body: {
        guest: { firstName: 'Web', lastName: 'Guest', email: 'inv@example.com', phone: '9100000001' },
        roomType: 'Deluxe', checkIn: CHECK_IN, checkOut: '2027-04-22',
        paymentMethod: 'pay_at_hotel',
      },
      params: {}, query: {}, user: {},
    }, res);

    assert.equal(res.statusCode, 201, `website booking failed: ${res.body?.message}`);
    const web = (await Booking.findOne({ email: 'inv@example.com' }).lean()).invoiceNumber;
    assert.match(web, /^[A-Z]+-\d{6}-WG-\d{4}$/, `website still mints its own format: ${web}`);
    assert.ok(rooms);
  });

  await t.test('50 simultaneous invoice numbers in one group are all distinct', async () => {
    const numbers = await Promise.all(
      Array.from({ length: RUSH }, () => nextInvoiceNumber('Same Guest', '2026-08-01')),
    );
    assert.equal(new Set(numbers).size, RUSH, 'two bookings were handed the same invoice number');
  });

  await t.test('the invoice counter continues the existing production series', async () => {
    // Shaped exactly like the 15 invoices the hotel has actually issued.
    await Booking.create({
      guestName: 'Hari Kumar', phone: '9000000099',
      checkIn: new Date('2026-08-01'), checkOut: new Date('2026-08-02'),
      totalAmount: 1000, bookingStatus: 'Confirmed',
      customerId: 'HK202608011001', invoiceNumber: 'HSG-010826-HK-1004',
    });

    const next = await nextInvoiceNumber('Hari Kumar', '2026-08-01');
    const seq = Number(next.split('-')[3]);
    assert.ok(seq > 1004, `restarted the series instead of continuing it: ${next}`);
  });

  // ── Events ────────────────────────────────────────────────────────────────
  await t.test('event ids are atomic too, and now actually persist', async () => {
    const ids = await Promise.all(
      Array.from({ length: 20 }, () => nextEventCustomerId('MARR', '2027-06-01')),
    );
    assert.equal(new Set(ids).size, 20, 'two events were handed the same id');

    // The field was absent from the schema, so every id was silently dropped.
    const booking = await BanquetBooking.create({
      customerId: ids[0],
      customerName: 'Test Event',
      customerPhone: '9000000005',
      eventType: 'Wedding',
      eventDate: new Date('2027-06-01'),
      startTime: '18:00',
      endTime: '23:00',
      guestCount: 100,
      totalAmount: 50000,
    });
    const stored = await BanquetBooking.findById(booking._id).lean();
    assert.equal(stored.customerId, ids[0], 'the event id was discarded on save again');
  });
});
