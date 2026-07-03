import mongoose from 'mongoose';

// A single accounting ledger entry. Every income or expense the hotel records
// lives here; all six accounting reports (Income & Expense, Cash Book, Ledger,
// GST, Profit & Loss, Balance Sheet) are derived from this one collection.
const accountingEntrySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, required: true },

  // income = money in (credit), expense = money out (debit).
  entryType: { type: String, enum: ['income', 'expense'], required: true },

  // Free-text ledger head, e.g. "Room Revenue", "Salaries", "Electricity".
  category: { type: String, required: true, trim: true },

  // The money account the cash actually moved through.
  account: { type: String, enum: ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other'], default: 'Cash' },

  // Customer (for income) or vendor (for expense).
  party: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },

  // amount = taxable/base value (exclusive of GST). gstAmount/total are derived.
  amount: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 0, min: 0 },
  gstAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },

  reference: { type: String, trim: true, default: '' }, // invoice / voucher no.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ── Auto-posting provenance ─────────────────────────────────────────────────
  // Entries the system posts automatically (room/banquet receipts, salary
  // payments) carry auto:true plus a stable source key so they can be upserted
  // in place (never duplicated) and removed when the origin doc goes away.
  // sourceRef holds a sub-document id, e.g. a single banquet payment.
  auto: { type: Boolean, default: false },
  sourceType: {
    type: String,
    enum: ['room_booking', 'banquet_booking', 'restaurant_order', 'table_settlement', 'payroll', 'staff_transaction', 'staff_recharge', ''],
    default: '',
  },
  sourceId: { type: String, trim: true, default: '' },
  sourceRef: { type: String, trim: true, default: '' },
}, { timestamps: true });

// Keep gstAmount and total consistent with amount × rate on every save.
accountingEntrySchema.pre('validate', function deriveTotals(next) {
  const base = Number(this.amount) || 0;
  const rate = Number(this.gstRate) || 0;
  this.gstAmount = Math.round(base * rate) / 100;     // base * (rate/100), 2dp
  this.total = Math.round((base + this.gstAmount) * 100) / 100;
  next();
});

accountingEntrySchema.index({ date: -1 });
accountingEntrySchema.index({ entryType: 1, category: 1 });
// One auto entry per (sourceType, sourceId, sourceRef): guarantees the
// income/expense sync upserts rather than duplicating on repeated saves.
accountingEntrySchema.index(
  { sourceType: 1, sourceId: 1, sourceRef: 1 },
  { unique: true, partialFilterExpression: { auto: true } },
);

export default mongoose.model('AccountingEntry', accountingEntrySchema);
