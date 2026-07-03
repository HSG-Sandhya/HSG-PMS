import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Housekeeping from '../models/Housekeeping.js';
import { createWorkbook, addSheet, sendWorkbook } from '../utils/excel.js';
import { calculateNights } from '../utils/dateHelpers.js';

// ── Shared helpers ──────────────────────────────────────────────────────────

// Optional ?startDate&endDate → a Mongo range, or null for "all time".
const parseRange = (query = {}) => {
  const { startDate, endDate } = query;
  if (!startDate || !endDate) return null;
  return { $gte: new Date(startDate), $lte: new Date(endDate) };
};

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const stamp = () => new Date().toISOString().slice(0, 10);
const personName = (u) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '' : '';

const fail = (res, label, error) => {
  console.error(`Export ${label} error:`, error);
  if (res.headersSent) return; // a partial workbook stream already started
  res.status(500).json({ success: false, message: `Failed to export ${label}` });
};

// ── Bookings / occupancy ────────────────────────────────────────────────────

export const exportBookings = async (req, res) => {
  try {
    const range = parseRange(req.query);
    const bookings = await Booking.find(range ? { checkIn: range } : {})
      .populate('roomId', 'roomNumber type')
      .sort({ checkIn: -1 })
      .lean();

    const rows = bookings.map((b) => ({
      invoiceNumber: b.invoiceNumber || '',
      customerId: b.customerId || '',
      guestName: b.guestName || '',
      phone: b.phone || '',
      room: b.roomId?.roomNumber || '',
      roomType: b.roomId?.type || '',
      checkIn: fmtDate(b.checkIn),
      checkOut: fmtDate(b.checkOut),
      nights: calculateNights(b.checkIn, b.checkOut, b.checkOutTime),
      adults: b.adults ?? '',
      children: b.children ?? '',
      baseAmount: b.baseAmount ?? 0,
      gstAmount: b.gstAmount ?? 0,
      totalAmount: b.totalAmount ?? 0,
      paymentStatus: b.paymentStatus || '',
      bookingStatus: b.bookingStatus || '',
    }));

    const workbook = createWorkbook();
    addSheet(
      workbook,
      'Bookings',
      [
        { header: 'Invoice #', key: 'invoiceNumber', width: 22 },
        { header: 'Customer ID', key: 'customerId', width: 16 },
        { header: 'Guest', key: 'guestName', width: 22 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Room', key: 'room', width: 10 },
        { header: 'Type', key: 'roomType', width: 16 },
        { header: 'Check-in', key: 'checkIn', width: 13 },
        { header: 'Check-out', key: 'checkOut', width: 13 },
        { header: 'Nights', key: 'nights', width: 8 },
        { header: 'Adults', key: 'adults', width: 8 },
        { header: 'Children', key: 'children', width: 9 },
        { header: 'Base', key: 'baseAmount', width: 12 },
        { header: 'GST', key: 'gstAmount', width: 12 },
        { header: 'Total', key: 'totalAmount', width: 12 },
        { header: 'Payment', key: 'paymentStatus', width: 12 },
        { header: 'Status', key: 'bookingStatus', width: 13 },
      ],
      rows
    );

    await sendWorkbook(res, workbook, `bookings-${stamp()}.xlsx`);
  } catch (error) {
    fail(res, 'bookings', error);
  }
};

// ── Restaurant sales ────────────────────────────────────────────────────────

export const exportRestaurantSales = async (req, res) => {
  try {
    const range = parseRange(req.query);
    const filter = { status: { $ne: 'Cancelled' } };
    if (range) filter.createdAt = range;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const rows = orders.map((o) => ({
      orderNumber: o.orderNumber || '',
      type: o.orderType || '',
      date: fmtDate(o.createdAt),
      items: (o.items || []).map((i) => `${i.name} x${i.quantity}`).join(', '),
      itemCount: (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
      gst: o.gst ?? 0,
      totalAmount: o.totalAmount ?? 0,
      paymentMethod: o.paymentMethod || '',
      status: o.status || '',
      customer: o.customerName || '',
    }));

    const workbook = createWorkbook();
    const sheet = addSheet(
      workbook,
      'Restaurant Sales',
      [
        { header: 'Order #', key: 'orderNumber', width: 18 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Date', key: 'date', width: 13 },
        { header: 'Items', key: 'items', width: 40 },
        { header: 'Qty', key: 'itemCount', width: 8 },
        { header: 'GST', key: 'gst', width: 10 },
        { header: 'Total', key: 'totalAmount', width: 12 },
        { header: 'Payment', key: 'paymentMethod', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Customer', key: 'customer', width: 22 },
      ],
      rows
    );

    const grandTotal = rows.reduce((s, r) => s + (r.totalAmount || 0), 0);
    sheet.addRow({});
    const totalRow = sheet.addRow({ items: 'TOTAL', totalAmount: grandTotal });
    totalRow.font = { bold: true };

    await sendWorkbook(res, workbook, `restaurant-sales-${stamp()}.xlsx`);
  } catch (error) {
    fail(res, 'restaurant sales', error);
  }
};

// ── Accounting / transactions ───────────────────────────────────────────────

export const exportTransactions = async (req, res) => {
  try {
    const range = parseRange(req.query);
    const transactions = await Transaction.find(range ? { date: range } : {})
      .populate('accountId', 'name type')
      .sort({ date: -1 })
      .lean();

    const txnRows = transactions.map((t) => ({
      date: fmtDate(t.date),
      type: t.type || '',
      category: t.category || '',
      description: t.description || '',
      account: t.accountId?.name || '',
      paymentMethod: t.paymentMethod || '',
      income: t.type === 'income' ? t.amount : '',
      expense: t.type === 'expense' ? t.amount : '',
      reference: t.reference || '',
    }));

    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const workbook = createWorkbook();
    const sheet = addSheet(
      workbook,
      'Transactions',
      [
        { header: 'Date', key: 'date', width: 13 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Account', key: 'account', width: 18 },
        { header: 'Method', key: 'paymentMethod', width: 12 },
        { header: 'Income', key: 'income', width: 12 },
        { header: 'Expense', key: 'expense', width: 12 },
        { header: 'Reference', key: 'reference', width: 18 },
      ],
      txnRows
    );
    sheet.addRow({});
    const totalRow = sheet.addRow({
      description: 'TOTAL',
      income: totalIncome,
      expense: totalExpense,
    });
    totalRow.font = { bold: true };
    sheet.addRow({ description: 'NET', income: totalIncome - totalExpense }).font = { bold: true };

    // Second sheet: current account balances.
    const accounts = await Account.find({ isActive: true }).lean();
    addSheet(
      workbook,
      'Accounts',
      [
        { header: 'Account', key: 'name', width: 24 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Bank', key: 'bankName', width: 20 },
        { header: 'Balance', key: 'balance', width: 14 },
      ],
      accounts.map((a) => ({
        name: a.name || '',
        type: a.type || '',
        bankName: a.bankName || '',
        balance: a.balance ?? 0,
      }))
    );

    await sendWorkbook(res, workbook, `transactions-${stamp()}.xlsx`);
  } catch (error) {
    fail(res, 'transactions', error);
  }
};

// ── Housekeeping tasks ──────────────────────────────────────────────────────

export const exportHousekeeping = async (req, res) => {
  try {
    const range = parseRange(req.query);
    const tasks = await Housekeeping.find(range ? { createdAt: range } : {})
      .populate('roomId', 'roomNumber type')
      .populate('hallId', 'name')
      .populate('assignedTo', 'firstName lastName username')
      .populate('completedBy', 'firstName lastName username')
      .sort({ scheduledFor: -1 })
      .lean();

    const rows = tasks.map((t) => ({
      area: t.roomId?.roomNumber ? `Room ${t.roomId.roomNumber}` : t.hallId?.name || '',
      taskType: t.taskType || '',
      priority: t.priority || '',
      status: t.status || '',
      assignedTo: personName(t.assignedTo),
      completedBy: personName(t.completedBy),
      source: t.source || '',
      scheduledFor: fmtDate(t.scheduledFor),
      completedAt: fmtDate(t.completedAt),
      notes: t.notes || '',
    }));

    const workbook = createWorkbook();
    addSheet(
      workbook,
      'Housekeeping',
      [
        { header: 'Area', key: 'area', width: 16 },
        { header: 'Task', key: 'taskType', width: 18 },
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Status', key: 'status', width: 13 },
        { header: 'Assigned To', key: 'assignedTo', width: 20 },
        { header: 'Completed By', key: 'completedBy', width: 20 },
        { header: 'Source', key: 'source', width: 18 },
        { header: 'Scheduled', key: 'scheduledFor', width: 13 },
        { header: 'Completed', key: 'completedAt', width: 13 },
        { header: 'Notes', key: 'notes', width: 30 },
      ],
      rows
    );

    await sendWorkbook(res, workbook, `housekeeping-${stamp()}.xlsx`);
  } catch (error) {
    fail(res, 'housekeeping', error);
  }
};
