// ─────────────────────────────────────────────────────────────────────────────
// Accounting auto-sync
//
// Keeps the AccountingEntry ledger in step with operational money movements so
// the finance reports need no manual data entry:
//   • room-booking receipts   → income  (category "Room Revenue")
//   • banquet-booking receipts → income  (category "Banquet Revenue")
//   • dine-in table settlements → income (category "Restaurant Revenue")
//   • payroll payments         → expense (category "Salaries & Wages")
//   • staff payouts            → expense (category "Staff Payments")
//   • staff phone recharges    → expense (category "Staff Phone Recharge")
//
// Every posting is idempotent: it is keyed by (sourceType, sourceId, sourceRef)
// and upserted, so re-saving a booking or re-running a sync never duplicates a
// ledger line. Helpers never throw into their caller — a bookkeeping hiccup must
// not fail a check-in, a payment or a payroll run — they log and move on.
// ─────────────────────────────────────────────────────────────────────────────
import AccountingEntry from '../models/AccountingEntry.js';
import Order from '../models/Order.js';
import Room from '../models/Room.js';
import { getBilling } from '../config/operationalConfig.js';

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Resolve a booking's room number whether roomId is a populated Room doc or a
// bare id. Returns '' when the booking has no room (e.g. a category hold).
const resolveRoomNumber = async (booking) => {
  try {
    const r = booking?.roomId;
    if (r && typeof r === 'object' && r.roomNumber) return r.roomNumber;
    if (r) {
      const room = await Room.findById(r).select('roomNumber').lean();
      return room?.roomNumber || '';
    }
  } catch { /* fall through to '' */ }
  return '';
};

// Normalise the many payment-method spellings used across the app onto the
// AccountingEntry.account enum: Cash / Bank / UPI / Card / Cheque / Other.
export const mapAccount = (method) => {
  const m = String(method || '').trim().toLowerCase();
  if (!m) return 'Cash';
  if (m === 'cash') return 'Cash';
  if (m === 'upi' || m === 'gpay' || m === 'phonepe' || m === 'paytm') return 'UPI';
  if (m === 'card' || m === 'credit card' || m === 'debit card') return 'Card';
  if (m === 'cheque' || m === 'check') return 'Cheque';
  if (
    m === 'bank' || m === 'bank transfer' || m === 'bank_transfer' ||
    m === 'net banking' || m === 'netbanking' || m === 'online' || m === 'neft' ||
    m === 'rtgs' || m === 'imps'
  ) return 'Bank';
  return 'Other';
};

// Upsert one auto entry keyed by its source. A non-positive amount removes any
// existing entry (e.g. a payment reversed to zero) so the ledger self-heals.
const syncEntry = async ({ sourceType, sourceId, sourceRef = '', ...fields }) => {
  try {
    const key = { sourceType, sourceId: String(sourceId), sourceRef: String(sourceRef), auto: true };
    if (!(Number(fields.amount) > 0)) {
      await AccountingEntry.deleteOne(key);
      return;
    }
    // findOneAndUpdate bypasses the model's pre('validate') hook, so derive
    // gstAmount/total here exactly as the schema would (mirrors AccountingEntry).
    const amount = round(fields.amount);
    const gstRate = Number(fields.gstRate) || 0;
    const gstAmount = Math.round(amount * gstRate) / 100;
    const total = Math.round((amount + gstAmount) * 100) / 100;
    await AccountingEntry.findOneAndUpdate(
      key,
      {
        $set: {
          ...fields,
          amount,
          gstRate,
          gstAmount,
          total,
          auto: true,
          sourceType,
          sourceId: String(sourceId),
          sourceRef: String(sourceRef),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.error(`[accountingSync] syncEntry ${sourceType}/${sourceId}/${sourceRef} failed:`, err.message);
  }
};

// Remove every auto entry for a source doc (used on delete). When `keepRefs` is
// given, entries whose sourceRef is in that set are preserved — used to reconcile
// a payments ledger down to only its surviving rows.
const removeEntriesBySource = async (sourceType, sourceId, keepRefs = null) => {
  try {
    const filter = { sourceType, sourceId: String(sourceId), auto: true };
    if (keepRefs) filter.sourceRef = { $nin: Array.from(keepRefs).map(String) };
    await AccountingEntry.deleteMany(filter);
  } catch (err) {
    console.error(`[accountingSync] removeEntriesBySource ${sourceType}/${sourceId} failed:`, err.message);
  }
};

export { removeEntriesBySource };

// ── Room bookings ────────────────────────────────────────────────────────────
// One synced income entry per booking whose amount tracks the running paidAmount
// (the Booking model has no per-installment ledger). Corrections to paidAmount
// re-flow automatically; a booking with nothing paid carries no entry.
export const syncRoomBookingIncome = async (booking) => {
  if (!booking?._id) return;

  // Room-service food is billed to the guest at CHECKOUT, not when each order is
  // served — so a room order does NOT self-post as it is served (see
  // syncRestaurantOrderIncome, which skips orderType 'room'). Here we sum the
  // booking's completed room-service orders. order.totalAmount is already
  // GST-INCLUSIVE (base + POS GST) and equals the invoice's F&B total, so this sum
  // is the food TOTAL the guest pays — not a taxable base to add GST onto.
  const [foodAgg] = await Order.aggregate([
    { $match: { roomId: booking._id, orderType: 'room', status: 'Completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const foodInclusive = Number(foodAgg?.total) || 0;
  const checkedOut = !!booking.checkedOutAt || booking.bookingStatus === 'Completed';

  const { roomGstRate, posGstRate } = await getBilling();
  const roomRate = Number(roomGstRate) || 0;
  const foodRate = Number(posGstRate) || 0;
  // The food total the guest pays (already GST-inclusive) folds into paidAmount at
  // checkout; before checkout nothing food-related is recognised.
  const foodTotal = checkedOut ? foodInclusive : 0;
  // Back the taxable base out of the inclusive total so the ledger row's
  // base + GST equals the food total exactly (no extra 5% added on top).
  const foodBase = foodRate > 0 ? round(foodInclusive / (1 + foodRate / 100)) : foodInclusive;

  const guest = booking.guestName || booking.groupName || 'Guest';
  const roomNo = await resolveRoomNumber(booking);
  const guestRoom = roomNo ? `${guest} (Room ${roomNo})` : guest;

  // Recognise the revenue when the money lands: an explicit payment date, else
  // the checkout date (a checked-out stay is settled at checkout), else
  // check-in / booking date for advances on an active stay. This keeps a guest
  // who checks out today in today's books rather than their arrival day.
  const settleDate = booking.paymentDate || booking.checkedOutAt || booking.checkedInAt
    || booking.checkIn || booking.createdAt || new Date();

  // ── Room revenue (room tariff only) ──
  // paidAmount is GST-inclusive; strip out the GST-inclusive room-service food so
  // the remainder is purely the room, then split it back into taxable base + room
  // GST. The ledger row's Total then equals exactly what was paid for the ROOM.
  const paidRaw = Number(booking.paidAmount) || 0;
  const roomPaid = Math.max(0, paidRaw - foodTotal);
  const roomBase = roomRate > 0 ? roomPaid / (1 + roomRate / 100) : roomPaid;
  await syncEntry({
    sourceType: 'room_booking',
    sourceId: booking._id,
    date: settleDate,
    entryType: 'income',
    category: 'Room Revenue',
    account: mapAccount(booking.paymentMethod),
    party: guest,
    description: `Room booking payment — ${guest}`,
    amount: roomBase,
    gstRate: roomRate,
    reference: booking.invoiceNumber || '',
  });

  // ── Room-service food (settled at checkout, one consolidated line) ──
  // A non-positive amount — no food, or the guest has not checked out yet —
  // removes any prior entry, so the ledger self-heals if orders are cancelled or
  // a checkout is undone. Split by the POS GST rate like all other F&B sales.
  await syncEntry({
    sourceType: 'room_booking',
    sourceId: booking._id,
    sourceRef: 'room_service',
    date: settleDate,
    entryType: 'income',
    category: 'Restaurant Revenue',
    account: mapAccount(booking.paymentMethod),
    party: guestRoom,
    description: `Room service food — ${guestRoom}`,
    amount: checkedOut ? foodBase : 0,
    gstRate: foodRate,
    reference: booking.invoiceNumber || '',
  });
};

// ── Banquet bookings ─────────────────────────────────────────────────────────
// ONE income entry per booking whose amount tracks the total received. That
// total is booking.advanceAmount, which the model keeps in sync as the sum of
// the payments[] ledger OR the advance typed directly on the booking form — so
// this captures BOTH ways money is taken (the per-payment approach missed
// advances entered on the form). Banquet income carries no GST split (matches
// the banquet invoices/quotations, which are issued GST-free).
export const syncBanquetPayments = async (booking) => {
  if (!booking?._id) return;
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const received = Number(booking.advanceAmount) || 0;
  const client = booking.customerName || booking.clientName || 'Client';
  // Use the most recent payment for date/method; fall back to the booking's
  // advance mode / creation date when the advance was entered on the form.
  const last = payments.length
    ? payments.reduce((a, p) => (p?.date && (!a?.date || new Date(p.date) > new Date(a.date)) ? p : a), payments[0])
    : null;

  await syncEntry({
    sourceType: 'banquet_booking',
    sourceId: booking._id, // single entry per booking (no sourceRef)
    date: (last && last.date) || booking.createdAt || booking.eventDate || new Date(),
    entryType: 'income',
    category: 'Banquet Revenue',
    account: mapAccount(last ? last.method : (booking.advancePaymentMode || 'Cash')),
    party: client,
    description: `Banquet booking payment — ${client}`,
    amount: received,
    reference: booking.bookingReference || '',
  });

  // Remove any legacy per-payment rows for this booking, keeping only the
  // single consolidated entry (sourceRef '').
  await removeEntriesBySource('banquet_booking', booking._id, new Set(['']));
};

// ── Restaurant orders (table / POS) ──────────────────────────────────────────
// One income entry per COMPLETED order — that is the moment the sale is paid and
// realised (POS orders auto-complete on save; table orders complete when their
// status is set to Completed). A pending / in-progress / cancelled order carries
// no entry, and reverting a completed order removes it, so the ledger self-heals.
// ROOM-SERVICE orders are the exception: they are paid with the room bill at
// checkout, so they never post here — syncRoomBookingIncome recognises them as
// one consolidated Restaurant Revenue line naming the room. The order's
// totalAmount is the GST-inclusive payable; it is split back into a taxable base
// + the configured POS GST rate exactly as room revenue is split, so the ledger
// shows Taxable / GST / Total and the total still equals what the guest paid.
export const syncRestaurantOrderIncome = async (order) => {
  if (!order?._id) return;
  if (order.status !== 'Completed') {
    await removeEntriesBySource('restaurant_order', order._id);
    return;
  }
  // Room-service food is NOT recognised when it is served. It is settled with the
  // room bill at CHECKOUT and posted as one consolidated Restaurant Revenue line
  // naming the room (see syncRoomBookingIncome). Never leave a per-order entry for
  // it, so the food only ever appears once — on checkout.
  if (order.orderType === 'room') {
    await removeEntriesBySource('restaurant_order', order._id);
    return;
  }
  const paid = Number(order.totalAmount) || 0;
  const { posGstRate } = await getBilling();
  const rate = Number(posGstRate) || 0;
  const base = rate > 0 ? paid / (1 + rate / 100) : paid;
  const typeLabel = order.orderType === 'pos' ? 'POS' : 'Table';
  const customer = order.customerName || 'Walk-in Customer';

  await syncEntry({
    sourceType: 'restaurant_order',
    sourceId: order._id,
    date: order.updatedAt || order.createdAt || new Date(),
    entryType: 'income',
    category: 'Restaurant Revenue',
    // 'none' (no method captured) settles as cash at the counter.
    account: mapAccount(order.paymentMethod === 'none' ? '' : order.paymentMethod),
    party: customer,
    description: `Restaurant ${typeLabel} order${order.orderNumber ? ` ${order.orderNumber}` : ''} — ${customer}`,
    amount: base,
    gstRate: rate,
    reference: order.orderNumber || '',
  });
};

// ── Dine-in table settlements ────────────────────────────────────────────────
// When an occupied table is settled, its itemised orders each post via
// syncRestaurantOrderIncome. This records the REMAINDER of the collected bill —
// the time-based table minimum charged above the food value, plus any packing
// charge — so the ledger equals exactly what was collected at the table. Without
// this, a dine-in guest who is billed the table minimum (or ordered nothing
// itemised) leaves no trace in accounting. One entry per settlement (the caller
// passes a unique settlementRef), split by the POS GST rate like other F&B.
export const syncTableSettlement = async ({ tableId, settlementRef, amount, tableNumber, paymentMethod, date }) => {
  if (!tableId || !(Number(amount) > 0)) return;
  const label = tableNumber ? `Table ${tableNumber}` : 'Dine-in';
  // The dine-in table charge (time-based minimum + packing) is NOT a taxable F&B
  // sale — carry NO GST; the full collected amount is the base. (À la carte food
  // orders still carry their POS GST via syncRestaurantOrderIncome above.)
  await syncEntry({
    sourceType: 'table_settlement',
    sourceId: tableId,
    sourceRef: settlementRef, // unique per settle → each visit is its own line
    date: date || new Date(),
    entryType: 'income',
    category: 'Restaurant Revenue',
    account: mapAccount(paymentMethod),
    party: label,
    description: `Dine-in table charge — ${label}`,
    amount: round(amount),
    gstRate: 0,
    reference: settlementRef,
  });
};

// ── Payroll (salary payments) ────────────────────────────────────────────────
// Posts an expense when a payroll is marked paid; removed if it leaves paid.
export const syncPayrollExpense = async (payroll) => {
  if (!payroll?._id) return;
  if (payroll.status !== 'paid') {
    await removeEntriesBySource('payroll', payroll._id);
    return;
  }
  const s = payroll.staff && typeof payroll.staff === 'object' ? payroll.staff : null;
  const name = s ? [s.firstName, s.lastName].filter(Boolean).join(' ').trim() : '';
  const period = payroll.payrollPeriod
    ? `${payroll.payrollPeriod.month}/${payroll.payrollPeriod.year}`
    : '';
  await syncEntry({
    sourceType: 'payroll',
    sourceId: payroll._id,
    date: payroll.payment?.paidAt || new Date(),
    entryType: 'expense',
    category: 'Salaries & Wages',
    account: mapAccount(payroll.payment?.method),
    party: name || 'Staff',
    description: `Salary${period ? ` for ${period}` : ''}${name ? ` — ${name}` : ''}`,
    amount: Number(payroll.netSalary) || 0,
    reference: payroll.payment?.transactionId || '',
  });
};

// ── Staff transactions (advances, bonuses, ad-hoc payouts) ───────────────────
// Money-out transaction types become expenses once approved/paid. Deductions are
// recovered from staff, so they are not an expense (skipped).
const STAFF_EXPENSE_TYPES = new Set(['salary', 'advance', 'bonus', 'loan', 'overtime']);

export const syncStaffTransactionExpense = async (txn) => {
  if (!txn?._id) return;
  const isExpense = STAFF_EXPENSE_TYPES.has(txn.type) && ['approved', 'paid'].includes(txn.status);
  if (!isExpense) {
    await removeEntriesBySource('staff_transaction', txn._id);
    return;
  }
  const s = txn.staff && typeof txn.staff === 'object' ? txn.staff : null;
  const name = s ? [s.firstName, s.lastName].filter(Boolean).join(' ').trim() : '';
  const label = txn.type.charAt(0).toUpperCase() + txn.type.slice(1);
  await syncEntry({
    sourceType: 'staff_transaction',
    sourceId: txn._id,
    date: txn.date || new Date(),
    entryType: 'expense',
    category: 'Staff Payments',
    account: mapAccount(txn.paymentMethod),
    party: name || 'Staff',
    description: `${label}${name ? ` — ${name}` : ''}${txn.reason ? ` (${txn.reason})` : ''}`,
    amount: Number(txn.amount) || 0,
    reference: txn.referenceNumber || '',
  });
};

// ── Staff phone recharges ────────────────────────────────────────────────────
// The hotel recharges a staff member's phone — a real cash outflow to the
// telecom operator — so post it as an expense against that staff member once the
// recharge SUCCEEDS. A pending / processing / failed / cancelled recharge carries
// no entry (and a success later reversed removes it), so the ledger self-heals.
// No GST split (a mobile recharge is not an input-credit purchase here).
export const syncStaffRechargeExpense = async (recharge) => {
  if (!recharge?._id) return;
  if (recharge.status !== 'success') {
    await removeEntriesBySource('staff_recharge', recharge._id);
    return;
  }
  const s = recharge.staff && typeof recharge.staff === 'object' ? recharge.staff : null;
  const name = s ? [s.firstName, s.lastName].filter(Boolean).join(' ').trim() : '';
  const parts = [recharge.operator, recharge.phoneNumber].filter(Boolean).join(', ');
  await syncEntry({
    sourceType: 'staff_recharge',
    sourceId: recharge._id,
    date: recharge.date || new Date(),
    entryType: 'expense',
    category: 'Staff Phone Recharge',
    // paymentMethod is how it was funded: cash → Cash, everything else
    // (wallet / salary_deduction / advance) has no direct cash-book bucket → Other.
    account: mapAccount(recharge.paymentMethod),
    party: name || 'Staff',
    description: `Phone recharge${name ? ` — ${name}` : ''}${parts ? ` (${parts})` : ''}`,
    amount: Number(recharge.amount) || 0,
    reference: recharge.transactionId || '',
  });
};
