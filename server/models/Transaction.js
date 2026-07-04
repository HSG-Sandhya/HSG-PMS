import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  reference: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'cheque', 'bank', 'other'],
    default: 'cash'
  },
  notes: {
    type: String,
    trim: true
  },
  isReconciled: {
    type: Boolean,
    default: false
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
transactionSchema.index({ type: 1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ accountId: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ isReconciled: 1 });

// Pre-save middleware
transactionSchema.pre('save', function() {
  if (this.isModified('amount')) {
    this.amount = parseFloat(this.amount.toFixed(2));
  }
  if (this.isModified('description')) {
    this.description = this.description.trim();
  }
});

// Static method to get transactions by date range
transactionSchema.statics.getTransactionsByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('accountId');
};

// Static method to get account balance
transactionSchema.statics.getAccountBalance = async function(accountId) {
  const result = await this.aggregate([
    {
      $match: { accountId: new mongoose.Types.ObjectId(accountId) }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  const income = result.find(r => r._id === 'income')?.total || 0;
  const expense = result.find(r => r._id === 'expense')?.total || 0;
  
  return income - expense;
};

export default mongoose.model('Transaction', transactionSchema);