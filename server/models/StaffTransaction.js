import mongoose from 'mongoose';

const staffTransactionSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['advance', 'salary', 'bonus', 'deduction', 'loan', 'overtime'],
    required: true
  },
  reason: {
    type: String,
    default: '',
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for development
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'approved'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'upi'],
    default: 'cash'
  },
  referenceNumber: String,
  notes: String,
  attachments: [String]
}, {
  timestamps: true
});

// Indexes for better query performance
staffTransactionSchema.index({ staff: 1, date: -1 });
staffTransactionSchema.index({ type: 1, status: 1 });
staffTransactionSchema.index({ processedBy: 1 });

// Virtual for formatted amount
staffTransactionSchema.virtual('formattedAmount').get(function() {
  return `₹${this.amount.toLocaleString('en-IN')}`;
});

// Static method to get staff transaction summary
staffTransactionSchema.statics.getStaffSummary = async function(staffId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        staff: new mongoose.Types.ObjectId(staffId),
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Instance method to approve transaction
staffTransactionSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.processedBy = approvedBy;
  return this.save();
};

// Instance method to mark as paid
staffTransactionSchema.methods.markAsPaid = function(paymentMethod, referenceNumber) {
  this.status = 'paid';
  this.paymentMethod = paymentMethod;
  if (referenceNumber) {
    this.referenceNumber = referenceNumber;
  }
  return this.save();
};

export default mongoose.model('StaffTransaction', staffTransactionSchema);
