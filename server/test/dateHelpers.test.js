import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStayDates, calculateNights } from '../utils/dateHelpers.js';

// createBooking only checked that the dates were PRESENT. calculateNights then
// clamped to one night, which is billing safety, not validation -- so a stay
// ending before it began was accepted, priced, and stored.
test('a normal stay passes', () => {
  assert.equal(validateStayDates('2026-09-10', '2026-09-13'), null);
  assert.equal(validateStayDates(new Date('2026-09-10'), new Date('2026-09-11')), null);
});

test('a missing date is refused', () => {
  assert.match(validateStayDates(null, '2026-09-13').message, /required/);
  assert.match(validateStayDates('2026-09-10', '').message, /required/);
  assert.match(validateStayDates(undefined, undefined).message, /required/);
});

test('an unparseable date is refused, and says which one', () => {
  assert.match(validateStayDates('not-a-date', '2026-09-13').message, /check-in date is not a valid date/);
  assert.match(validateStayDates('2026-09-10', 'tomorrow').message, /check-out date is not a valid date/);
});

test('check-out equal to or before check-in is refused', () => {
  assert.match(validateStayDates('2026-09-10', '2026-09-10').message, /after check-in/);
  assert.match(validateStayDates('2026-09-13', '2026-09-10').message, /after check-in/);
});

test('calculateNights still clamps, because billing must never be zero', () => {
  // Deliberately unchanged: it is the last line of defence on an invoice, not
  // the first line of validation on a request.
  assert.equal(calculateNights('2026-09-10', '2026-09-10'), 1);
  assert.equal(calculateNights('2026-09-13', '2026-09-10'), 1);
  assert.equal(calculateNights('2026-09-10', '2026-09-13'), 3);
});

test('a late arrival and a morning departure still count calendar nights', () => {
  // Local times, as the booking form sends them: the count is calendar days,
  // so 6:44 PM on the 1st to 9 AM on the 7th is 6 nights even though the raw
  // elapsed time is 5 days and change. (Written without a Z on purpose --
  // "18:44Z" is the 2nd in IST and would legitimately count 5.)
  assert.equal(calculateNights('2026-09-01T18:44:00', '2026-09-07T09:00:00'), 6);
});
