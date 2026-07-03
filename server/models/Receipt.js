import mongoose from 'mongoose';

// Payment receipt — a dedicated, immutable audit record issued exactly once
// per completed order. Everything is SNAPSHOTTED (items, totals, customer,
// table label) so the receipt stays a faithful record of what was charged
// even if the order document is later edited or deleted.
const receiptItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      unique: true,
    },
    // One receipt per order — the unique index enforces it at the DB level.
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    orderNumber: { type: String, required: true },
    orderType: {
      type: String,
      enum: ['table', 'room', 'pos'],
      required: true,
    },
    tableLabel: { type: String, default: '' }, // e.g. "Table T4" — snapshot, not a ref
    customerName: { type: String, default: 'Walk-in Customer' },
    customerPhone: { type: String, default: 'N/A' },
    items: {
      type: [receiptItemSchema],
      validate: [(v) => v.length > 0, 'A receipt needs at least one item'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    gst: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: 'cash' },
    cashReceived: { type: Number, default: 0, min: 0 },
    changeAmount: { type: Number, default: 0, min: 0 },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

receiptSchema.index({ createdAt: -1 });

// RCPT-YYMMDD-### — same day-scoped numbering scheme as orders.
receiptSchema.pre('save', async function (next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const last = await this.constructor
      .findOne({ receiptNumber: new RegExp(`^RCPT-${year}${month}${day}-`) })
      .sort({ receiptNumber: -1 });

    let sequence = 1;
    if (last && last.receiptNumber) {
      const lastSequence = parseInt(last.receiptNumber.split('-')[2], 10);
      if (!isNaN(lastSequence)) sequence = lastSequence + 1;
    }

    this.receiptNumber = `RCPT-${year}${month}${day}-${sequence.toString().padStart(3, '0')}`;
  }
  next();
});

export default mongoose.model('Receipt', receiptSchema);
