import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['savings', 'current', 'credit', 'cash', 'other'], default: 'savings' },
  accountNumber: { type: String },
  bankName: { type: String },
  ifsc: { type: String },
  branch: { type: String },
  upi: { type: String },
  // `balance` is the OPENING balance (what was in the account before the ledger
  // starts tracking it). The live balance = opening + net of ledger entries
  // whose payment bucket is claimed in `paymentMethods` below.
  balance: { type: Number, default: 0 },
  // Which AccountingEntry.account buckets credit/debit THIS account, so a UPI /
  // bank-transfer / card receipt lands in the right named account. Values match
  // the AccountingEntry.account enum.
  paymentMethods: {
    type: [String],
    enum: ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other'],
    default: [],
  },
  openingDate: { type: Date },
  notes: { type: String },
  currency: { type: String, default: 'INR' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
accountSchema.index({ name: 1 });
accountSchema.index({ type: 1 });
accountSchema.index({ isActive: 1 });

// Pre-save middleware
accountSchema.pre('save', function() {
  if (this.isModified('accountNumber') && this.accountNumber) {
    this.accountNumber = this.accountNumber.trim().toUpperCase();
  }
  if (this.isModified('ifsc') && this.ifsc) {
    this.ifsc = this.ifsc.trim().toUpperCase();
  }
});

// Keep normalization consistent on update queries too
accountSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate() || {};
  const applyNormalize = (target) => {
    if (!target || typeof target !== 'object') return;
    if (typeof target.accountNumber === 'string') {
      target.accountNumber = target.accountNumber.trim().toUpperCase();
    }
    if (typeof target.ifsc === 'string') {
      target.ifsc = target.ifsc.trim().toUpperCase();
    }
  };

  applyNormalize(update);
  applyNormalize(update.$set);
});

// Static method to get active accounts
accountSchema.statics.getActiveAccounts = function() {
  return this.find({ isActive: true });
};

// Method to update balance
accountSchema.methods.updateBalance = async function(amount) {
  this.balance += amount;
  return this.save();
};

export default mongoose.model('Account', accountSchema);
