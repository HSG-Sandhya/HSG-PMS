import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInvoiceContext } from '../services/invoiceTemplates/normalize.js';
import { getTemplateList, getTemplate } from '../services/invoiceTemplates/index.js';
import { resolveTheme } from '../services/invoiceTemplates/theme.js';
import { formatStayMoment } from '../services/invoiceTemplates/formatters.js';

// Arrival and departure print with the time beside the date. They are the facts
// a late-checkout charge is argued about, and the invoice is the only record the
// guest keeps.

const hotel = { name: 'Hotel Sandhya Grand', contact: {}, gstin: '10ASQPM7914B3ZW' };
const billing = { roomGstRate: 5, posGstRate: 5, roundAmounts: true,
  defaultCheckInTime: '12:00', defaultCheckOutTime: '11:00' };

const stayOf = (over = {}) => normalizeInvoiceContext({
  booking: {
    guestName: 'Mr. Rohan Verma',
    roomId: { roomNumber: '204', roomType: 'Deluxe AC' },
    checkIn: new Date('2026-09-21T00:00:00'),
    checkOut: new Date('2026-09-24T00:00:00'),
    adults: 2,
    totalAmount: 13500,
    ...over,
  },
  hotel, type: 'hotel', billing,
}).stay;

test('the times the booking recorded are what print', () => {
  const stay = stayOf({ checkInTime: '14:30', checkOutTime: '10:15' });
  assert.equal(stay.checkInTime, '14:30');
  assert.equal(stay.checkOutTime, '10:15');
  assert.equal(formatStayMoment(stay.checkIn, stay.checkInTime), '21 Sept 2026 · 2:30 PM');
  assert.equal(formatStayMoment(stay.checkOut, stay.checkOutTime), '24 Sept 2026 · 10:15 AM');
});

test('a booking with no times falls back to the hotel’s standard hours', () => {
  const stay = stayOf();
  assert.equal(stay.checkInTime, '12:00');
  assert.equal(stay.checkOutTime, '11:00');
});

test('what actually happened beats what was scheduled', () => {
  const stay = stayOf({
    checkInTime: '14:30',
    checkOutTime: '10:15',
    checkedInAt: new Date('2026-09-21T15:42:00'),
    checkedOutAt: new Date('2026-09-24T09:05:00'),
  });
  assert.equal(stay.checkInTime, '15:42');
  assert.equal(stay.checkOutTime, '09:05');
});

test('a departure after midnight does not contradict the date it sits beside', () => {
  // The guest left at 00:30 on the 25th but is billed to the 24th. Printing
  // "24 Sept · 12:30 AM" would be a date and a time that never happened
  // together, so the scheduled time stands instead.
  const stay = stayOf({
    checkOutTime: '10:15',
    checkedOutAt: new Date('2026-09-25T00:30:00'),
  });
  assert.equal(stay.checkOutTime, '10:15');
  assert.ok(!formatStayMoment(stay.checkOut, stay.checkOutTime).includes('12:30'));
});

test('with no time at all the bare date prints, not an invented hour', () => {
  assert.equal(formatStayMoment(new Date('2026-09-21T00:00:00'), ''), '21 Sept 2026');
  assert.equal(formatStayMoment(new Date('2026-09-21T00:00:00'), null), '21 Sept 2026');
});

test('every design prints both the arrival and the departure time', async () => {
  const booking = {
    guestName: 'Mr. Rohan Verma',
    roomId: { roomNumber: '204', roomType: 'Deluxe AC' },
    checkIn: new Date('2026-09-21T00:00:00'),
    checkOut: new Date('2026-09-24T00:00:00'),
    adults: 2,
    checkInTime: '14:30',
    checkOutTime: '10:15',
    totalAmount: 13500,
    paidAmount: 10000,
  };
  for (const meta of getTemplateList()) {
    const template = getTemplate(meta.id);
    const ctx = normalizeInvoiceContext({ booking, hotel, type: 'hotel', billing });
    if (template.customizable) ctx.theme = resolveTheme(template.theme, {});
    const html = await template.render(ctx, { booking, hotel, type: 'hotel' });
    assert.ok(html.includes('2:30 PM'), `${meta.id} does not print the arrival time`);
    assert.ok(html.includes('10:15 AM'), `${meta.id} does not print the departure time`);
  }
});

test('banquet timings are untouched by the stay-time change', () => {
  // An event already carries its own start and end times; it has no arrival or
  // departure to annotate.
  const ctx = normalizeInvoiceContext({
    booking: {
      customerName: 'Aarav & Diya Sharma',
      hallId: { name: 'Grand Banquet Hall' },
      eventDate: new Date('2026-10-02'),
      startTime: '18:00',
      endTime: '23:00',
      totalAmount: 132500,
    },
    hotel, type: 'banquet', billing,
  });
  assert.equal(ctx.stay, null);
  assert.equal(ctx.event.startTime, '18:00');
  assert.equal(ctx.event.endTime, '23:00');
});
