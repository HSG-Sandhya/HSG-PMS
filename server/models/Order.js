import mongoose from 'mongoose';

import { registerModel } from "../db/modelRegistry.js";
import { nextSequence } from "../services/sequence.js";
const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  orderType: {
    type: String,
    enum: ['table', 'room', 'pos'],
    default: 'table',
    required: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  gst: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  // true → item prices already contain GST (POS sales); the gst field is the
  // included portion, and nothing should be added on top of totalAmount.
  gstIncluded: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  specialInstructions: {
    type: String,
    trim: true
  },
  servedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'none'],
    default: 'none'
  },
  cashReceived: {
    type: Number,
    default: 0,
    min: 0
  },
  changeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  customerName: {
    type: String,
    default: 'Walk-in Customer',
    trim: true
  },
  customerPhone: {
    type: String,
    default: 'N/A',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
// orderNumber is already indexed via unique: true in schema definition
orderSchema.index({ orderType: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware
orderSchema.pre('save', async function() {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dayKey = `${year}${month}${day}`;

    // A restaurant fires several orders at once at service time. Reading the
    // last order number and adding one gave two of them the same number, and
    // the second to save died on the unique index. One atomic $inc per day
    // instead; the counter is seeded from the day's highest existing number the
    // first time that day is used.
    const sequence = await nextSequence(`order:${dayKey}`, {
      seed: async () => {
        const lastOrder = await this.constructor
          .findOne({ orderNumber: new RegExp(`^ORD-${dayKey}-`) })
          .sort({ orderNumber: -1 })
          .lean();
        const n = parseInt(String(lastOrder?.orderNumber || '').split('-')[2], 10);
        return Number.isFinite(n) ? n : 0;
      },
    });

    this.orderNumber = `ORD-${dayKey}-${sequence.toString().padStart(3, '0')}`;
  }
  
  if (this.items && this.items.length > 0) {
    const itemsTotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // totalAmount is the PAYABLE amount: base item prices + GST on top
    // (unless gstIncluded marks the prices as already containing tax).
    this.totalAmount = itemsTotal + (this.gstIncluded ? 0 : (this.gst || 0));
  }
  
  if (this.orderType === 'pos' && this.status === 'Pending') {
    this.status = 'Completed';
  }
  
  if (this.cashReceived > 0) {
    this.changeAmount = this.cashReceived - this.totalAmount;
  }
});

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function(status) {
  return this.find({ status }).populate('tableId').populate('roomId').populate('servedBy');
};

export default registerModel('Order', orderSchema);