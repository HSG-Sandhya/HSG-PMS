// ── The one place a booking reference is minted ──────────────────────────────
//
// There were FOUR customer-id algorithms in this codebase, three of them the
// same read-latest-then-add-one race that booking numbers, invoice numbers and
// staff employee ids had each already been fixed for:
//
//   createBooking          inline, front desk
//   generateCustomerId     the group and company flows
//   buildCustomerId        marriage/banquet
//   generateUniqueCustomerId   the website — the only atomic one
//
// Two clerks checking guests in together both read the same "last" id, both
// decide on the same next one, and the second `save()` hits the unique index on
// customerId. That surfaces at the desk as "Internal server error" with the
// booking lost, which is a worse failure than a duplicate would have been.
//
// A `$inc` is applied by the database, so concurrent callers are serialised by
// the server and each gets a distinct number. One implementation, because four
// copies of a numbering rule is four chances to drift.

import { nextSequence } from './sequence.js';
import { getBilling } from '../config/operationalConfig.js';
import Booking from '../models/Booking.js';
import BanquetBooking from '../models/BanquetBooking.js';

/** "Sunita Kumari" → "SK"; single names give one letter; nothing gives "G". */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'G';
  const first = parts[0][0]?.toUpperCase() || 'G';
  const last = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '';
  return first + last;
};

/** YYYYMMDD in local time — the arrival date, as the id has always encoded it. */
const ymd = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const dayBounds = (date) => {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * The next customer id for a room booking: INITIALS + YYYYMMDD + sequence,
 * e.g. "SK202607301002". The sequence runs per ARRIVAL DAY, which is the scope
 * the format encodes.
 *
 * The counter is seeded once per day-scope from ids already in the collection,
 * so it continues an existing series rather than colliding with it. The old
 * code instead took the most recently *created* booking for that day and read
 * its last four characters — which picked the wrong row whenever bookings for
 * one arrival date were created out of order, and stopped parsing at all once
 * a day passed 9999 bookings.
 */
export const nextCustomerId = async (guestName, checkInDate) => {
  const dateStr = ymd(checkInDate);
  const seq = await nextSequence(`customer:${dateStr}`, {
    start: 1000,
    seed: async () => {
      const { start, end } = dayBounds(checkInDate);
      const sameDay = await Booking.find({ checkIn: { $gte: start, $lte: end } })
        .select('customerId').lean();
      return sameDay.reduce((max, b) => {
        const n = parseInt(String(b.customerId || '').match(/^[A-Z]*\d{8}(\d+)$/)?.[1], 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 1000);
    },
  });
  return `${initialsOf(guestName)}${dateStr}${seq}`;
};

/**
 * The event equivalent: PREFIX + YYYYMMDD + sequence, e.g. "WED202603151001".
 * Scoped per event type and date, the way the original was.
 */
export const nextEventCustomerId = async (prefix, eventDate) => {
  const dateStr = eventDate ? ymd(eventDate) : ymd(new Date());
  const scope = `event-customer:${prefix}:${dateStr}`;
  const seq = await nextSequence(scope, {
    start: 1000,
    seed: async () => {
      const { start, end } = dayBounds(eventDate || new Date());
      const sameDay = await BanquetBooking.find({ eventDate: { $gte: start, $lte: end } })
        .select('customerId').lean();
      return sameDay.reduce((max, b) => {
        const n = parseInt(String(b.customerId || '').match(/^[A-Z]+\d{8}(\d+)$/)?.[1], 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 1000);
    },
  });
  return `${prefix}${dateStr}${seq}`;
};

/**
 * The next invoice number: PREFIX-DDMMYY-INITIALS-NNNN, e.g. "HSG-010826-HK-1001".
 * The prefix is configurable (Billing & Tariff → Invoice prefix); the running
 * number increments within one date + guest-initials group.
 *
 * There were two invoice generators too, and unlike the customer-id copies both
 * were already atomic -- what differed was the FORMAT. The website minted a bare
 * "HSG-1001" while every one of the hotel's 15 issued invoices looks like
 * "HSG-010826-HK-1001". No online booking had reached production yet, so the
 * divergence had never shown up; the first one would have issued a GST document
 * in a shape unlike any invoice the hotel had ever produced, in a series of its
 * own. One generator, so the numbering stays one series.
 */
export const nextInvoiceNumber = async (guestName, checkIn) => {
  const { invoicePrefix } = await getBilling();
  const initials = initialsOf(guestName);

  // DDMMYY so the date leads the number (after the prefix) -- invoices then
  // group/filter datewise. e.g. 6 Jul 2026 -> "060726".
  const d = new Date(checkIn);
  const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;

  // The regex pins prefix/date/initials so sorting by the whole string sorts by
  // the 4-digit sequence.
  const regex = new RegExp(`^${invoicePrefix}-${dateStr}-${initials}-\\d{4}$`);
  const seq = await nextSequence(`invoice:${invoicePrefix}-${dateStr}-${initials}`, {
    start: 1000,
    seed: async () => {
      const latest = await Booking.findOne(
        { invoiceNumber: { $regex: regex } },
        { invoiceNumber: 1 },
        { sort: { invoiceNumber: -1 } },
      ).lean();
      const parts = String(latest?.invoiceNumber || '').split('-');
      const lastSeq = parts.length === 4 ? parseInt(parts[3], 10) : NaN;
      return Number.isFinite(lastSeq) ? lastSeq : 1000;
    },
  });

  return `${invoicePrefix}-${dateStr}-${initials}-${String(seq).padStart(4, '0')}`;
};

export default nextCustomerId;
