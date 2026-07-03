import mongoose from 'mongoose';

const staffRechargeSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: 'Please enter a valid 10-digit mobile number'
    }
  },
  amount: {
    type: Number,
    required: true,
    min: [10, 'Minimum recharge amount is ₹10']
  },
  operator: {
    type: String,
    enum: ['Airtel', 'Jio', 'Vi', 'BSNL', 'Other'],
    required: true
  },
  planType: {
    type: String,
    enum: ['prepaid', 'postpaid'],
    default: 'prepaid'
  },
  planDetails: {
    validity: String,
    data: String,
    talkTime: String,
    sms: String
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
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionId: String,
  operatorTransactionId: String,
  paymentMethod: {
    type: String,
    enum: ['wallet', 'cash', 'salary_deduction', 'advance'],
    default: 'cash'
  },
  notes: String,
  failureReason: String
}, {
  timestamps: true
});

// Indexes for better query performance
staffRechargeSchema.index({ staff: 1, date: -1 });
staffRechargeSchema.index({ phoneNumber: 1 });
staffRechargeSchema.index({ status: 1, date: -1 });
staffRechargeSchema.index({ operator: 1, planType: 1 });

// Virtual for formatted amount
staffRechargeSchema.virtual('formattedAmount').get(function() {
  return `₹${this.amount.toLocaleString('en-IN')}`;
});

// Static method to get staff recharge summary
staffRechargeSchema.statics.getStaffSummary = async function(staffId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        staff: new mongoose.Types.ObjectId(staffId),
        date: { $gte: startDate, $lte: endDate },
        status: 'success'
      }
    },
    {
      $group: {
        _id: {
          operator: '$operator',
          planType: '$planType'
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get monthly recharge stats
staffRechargeSchema.statics.getMonthlyStats = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const pipeline = [
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'success'
      }
    },
    {
      $group: {
        _id: '$operator',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ];

  return await this.aggregate(pipeline);
};

// Instance method to mark as successful
staffRechargeSchema.methods.markAsSuccess = function(transactionId, operatorTransactionId) {
  this.status = 'success';
  this.transactionId = transactionId;
  if (operatorTransactionId) {
    this.operatorTransactionId = operatorTransactionId;
  }
  return this.save();
};

// Instance method to mark as failed
staffRechargeSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

// Pre-save middleware to generate transaction ID
staffRechargeSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = `RCH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('StaffRecharge', staffRechargeSchema);
