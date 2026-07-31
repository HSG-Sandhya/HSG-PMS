import mongoose from "mongoose";
import { registerModel, modelFor } from "../db/modelRegistry.js";
import mongoosePaginate from "mongoose-paginate-v2";
import { getOps } from "../config/operationalConfig.js";

const payrollSchema = new mongoose.Schema({
  // Staff reference (excluding admin and system admin)
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    validate: {
      validator: async function(staffId) {
        const staff = await modelFor('User').findById(staffId).populate('role');
        if (!staff) return false;
        
        // Exclude admin and system admin from payroll
        if (staff.isSystemAdmin) return false;
        if (staff.role && (staff.role.name === 'Admin' || staff.role.name === 'System Administrator')) {
          return false;
        }
        
        return true;
      },
      message: 'Admin and System Admin users cannot have payroll records'
    }
  },

  // Payroll period
  payrollPeriod: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },

  // Basic salary information
  salary: {
    basic: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentFrequency: {
      type: String,
      enum: ['monthly', 'bi-weekly', 'weekly', 'daily'],
      default: 'monthly'
    }
  },

  // Attendance-based calculations
  attendance: {
    totalDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    
    // Hours tracking
    totalHours: { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    
    // Attendance percentage
    attendancePercentage: { type: Number, default: 0 }
  },

  // Earnings breakdown
  earnings: {
    basicPay: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    
    // Allowances
    allowances: {
      hra: { type: Number, default: 0 }, // House Rent Allowance
      da: { type: Number, default: 0 }, // Dearness Allowance
      ta: { type: Number, default: 0 }, // Travel Allowance
      medical: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      performance: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    
    // Bonuses
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    
    totalEarnings: { type: Number, default: 0 }
  },

  // Deductions breakdown
  deductions: {
    // Statutory deductions
    pf: { type: Number, default: 0 }, // Provident Fund
    esi: { type: Number, default: 0 }, // Employee State Insurance
    tds: { type: Number, default: 0 }, // Tax Deducted at Source
    
    // Other deductions
    lateDeduction: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    recharge: { type: Number, default: 0 }, // mobile recharges recovered from salary
    loan: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    
    totalDeductions: { type: Number, default: 0 }
  },

  // Final calculation
  netSalary: { type: Number, default: 0 },

  // Payroll status and workflow
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },

  // Approval workflow
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  calculatedAt: Date,

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  approvedAt: Date,

  // Payment information
  payment: {
    method: {
      type: String,
      enum: ['bank_transfer', 'cash', 'cheque', 'upi'],
      default: 'bank_transfer'
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String
    },
    transactionId: String,
    paidAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },

  // PDF generation tracking
  pdfGenerated: { type: Boolean, default: false },
  pdfGeneratedAt: Date,
  pdfPath: String,

  // Notes and comments
  notes: String,
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // Attendance records reference
  attendanceRecords: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendance"
  }]

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payroll period display
payrollSchema.virtual('payrollPeriodDisplay').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.payrollPeriod.month - 1]} ${this.payrollPeriod.year}`;
});

// Virtual for days worked percentage
payrollSchema.virtual('workingPercentage').get(function() {
  if (this.attendance.workingDays === 0) return 0;
  return ((this.attendance.presentDays + (this.attendance.halfDays * 0.5)) / this.attendance.workingDays) * 100;
});

// Methods
payrollSchema.methods.calculatePayroll = async function() {
  try {
    // Get attendance records for the payroll period
    const Attendance = modelFor('Attendance');
    const attendanceRecords = await Attendance.find({
      staff: this.staff,
      date: {
        $gte: this.payrollPeriod.startDate,
        $lte: this.payrollPeriod.endDate
      }
    });

    // Calculate attendance statistics
    this.attendance.totalDays = attendanceRecords.length;
    this.attendance.presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    this.attendance.absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    this.attendance.halfDays = attendanceRecords.filter(a => a.status === 'half_day').length;
    this.attendance.leaveDays = attendanceRecords.filter(a => a.status === 'leave').length;
    this.attendance.holidayDays = attendanceRecords.filter(a => a.status === 'holiday').length;

    // Calculate working days (excluding holidays)
    this.attendance.workingDays = this.attendance.totalDays - this.attendance.holidayDays;

    // Calculate hours
    this.attendance.totalHours = attendanceRecords.reduce((total, record) => {
      return total + (record.workHours.actual || 0);
    }, 0);

    this.attendance.regularHours = attendanceRecords.reduce((total, record) => {
      return total + Math.min(record.workHours.actual || 0, record.workHours.scheduled || 8);
    }, 0);

    this.attendance.overtimeHours = attendanceRecords.reduce((total, record) => {
      return total + (record.workHours.overtime || 0);
    }, 0);

    // Calculate attendance percentage
    if (this.attendance.workingDays > 0) {
      this.attendance.attendancePercentage = 
        ((this.attendance.presentDays + (this.attendance.halfDays * 0.5)) / this.attendance.workingDays) * 100;
    }

    // Salary is a flat daily rate — monthly basic divided by 30 — paid only for
    // the days actually attended. Half-days earn half a day's pay; absent and
    // leave days are unpaid. There are no statutory deductions (PF/ESI): pay is
    // purely attendance-based per hotel policy.
    const DAYS_IN_MONTH = 30;
    const perDayRate = this.salary.basic / DAYS_IN_MONTH;
    const payableDays = (this.attendance.presentDays || 0) + (this.attendance.halfDays || 0) * 0.5;
    this.earnings.basicPay = perDayRate * payableDays;

    // Overtime pay (only when overtime hours are logged). The multiplier is
    // configurable in Settings → Operations → Payroll (defaults to 1.5×).
    const { payroll: payrollCfg } = await getOps();
    const otMultiplier = Number(payrollCfg?.overtimeMultiplier) || 1.5;
    const hourlyRate = perDayRate / 8;
    this.earnings.overtimePay = (this.attendance.overtimeHours || 0) * hourlyRate * otMultiplier;

    // Allowances are prorated on the same daily basis (payable days / 30).
    const attendanceRatio = payableDays / DAYS_IN_MONTH;
    Object.keys(this.earnings.allowances).forEach(key => {
      if (this.earnings.allowances[key] > 0) {
        this.earnings.allowances[key] *= attendanceRatio;
      }
    });

    // No statutory or attendance-penalty deductions. Unpaid days are already
    // reflected in a lower basic pay above, so there is no separate absent or
    // late deduction, and PF/ESI/TDS are all zero. Only advances and mobile
    // recharges are recovered from salary (computed below).
    this.deductions.pf = 0;
    this.deductions.esi = 0;
    this.deductions.tds = 0;
    this.deductions.absentDeduction = 0;
    this.deductions.lateDeduction = 0;

    // Recover advance payments taken during the period from salary
    try {
      const StaffTransaction = modelFor('StaffTransaction');
      const advanceTxns = await StaffTransaction.find({
        staff: this.staff,
        type: 'advance',
        date: { $gte: this.payrollPeriod.startDate, $lte: this.payrollPeriod.endDate }
      });
      this.deductions.advance = advanceTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    } catch (e) {
      // StaffTransaction model unavailable — leave advance as-is
    }

    // Recover mobile recharges done during the period from salary
    try {
      const StaffRecharge = modelFor('StaffRecharge');
      const rechargeTxns = await StaffRecharge.find({
        staff: this.staff,
        date: { $gte: this.payrollPeriod.startDate, $lte: this.payrollPeriod.endDate }
      });
      this.deductions.recharge = rechargeTxns.reduce((sum, r) => sum + (r.amount || 0), 0);
    } catch (e) {
      // StaffRecharge model unavailable — leave recharge as-is
    }

    // Calculate total earnings and deductions (with NaN protection)
    const safeNumber = (val) => isNaN(val) || val === null || val === undefined ? 0 : Number(val);
    
    this.earnings.basicPay = safeNumber(this.earnings.basicPay);
    this.earnings.overtimePay = safeNumber(this.earnings.overtimePay);
    this.earnings.bonus = safeNumber(this.earnings.bonus);
    
    // Ensure all allowances are safe numbers
    Object.keys(this.earnings.allowances).forEach(key => {
      this.earnings.allowances[key] = safeNumber(this.earnings.allowances[key]);
    });
    
    // Ensure all deductions are safe numbers
    Object.keys(this.deductions).forEach(key => {
      if (key !== 'totalDeductions') {
        this.deductions[key] = safeNumber(this.deductions[key]);
      }
    });

    this.earnings.totalEarnings = this.earnings.basicPay + 
      Object.values(this.earnings.allowances).reduce((a, b) => safeNumber(a) + safeNumber(b), 0) + 
      this.earnings.overtimePay + this.earnings.bonus;

    this.deductions.totalDeductions = Object.entries(this.deductions)
      .filter(([key]) => key !== 'totalDeductions')
      .reduce((total, [key, value]) => total + safeNumber(value), 0);
    
    // Calculate net salary
    this.netSalary = this.earnings.totalEarnings - this.deductions.totalDeductions;

    // Update attendance records reference
    this.attendanceRecords = attendanceRecords.map(record => record._id);

    // Update status
    this.status = 'calculated';
    this.calculatedAt = new Date();

    return this;
  } catch (error) {
    throw new Error(`Payroll calculation failed: ${error.message}`);
  }
};

payrollSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this;
};

payrollSchema.methods.markAsPaid = function(paymentDetails, paidBy) {
  this.status = 'paid';
  this.payment = { ...this.payment, ...paymentDetails };
  this.payment.paidBy = paidBy;
  this.payment.paidAt = new Date();
  return this;
};

payrollSchema.methods.addComment = function(userId, comment) {
  this.comments.push({
    user: userId,
    comment: comment,
    timestamp: new Date()
  });
};

// Static methods
payrollSchema.statics.generateForStaff = async function(staffId, month, year) {
  // Check for existing payroll for the same period
  const existingPayroll = await this.findOne({
    staff: staffId,
    'payrollPeriod.month': month,
    'payrollPeriod.year': year
  });

  if (existingPayroll) {
    throw new Error(`Payroll already exists for this staff member for ${month}/${year}`);
  }

  // Get staff details
  const User = modelFor('User');
  const staff = await User.findById(staffId).populate('role');
  
  if (!staff) {
    throw new Error('Staff not found');
  }

  // Validate staff is not admin/system admin
  if (staff.isSystemAdmin || (staff.role && ['Admin', 'System Administrator'].includes(staff.role.name))) {
    throw new Error('Cannot generate payroll for Admin or System Administrator');
  }

  // Calculate period dates
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Create new payroll
  const payroll = new this({
    staff: staffId,
    payrollPeriod: {
      month,
      year,
      startDate,
      endDate
    },
    salary: {
      basic: staff.profile.salary || 0
    }
  });

  // Calculate payroll
  await payroll.calculatePayroll();
  
  return payroll;
};

// Live-compute a payroll for a staff member WITHOUT persisting it or checking
// for an existing record. Used by the payroll dashboard to show every eligible
// staff member's up-to-the-minute figures before anyone clicks "Generate".
// Pass a pre-loaded staff doc to avoid a per-row lookup when iterating.
payrollSchema.statics.previewForStaff = async function(staffId, month, year, staffDoc = null) {
  const User = modelFor('User');
  const staff = staffDoc || await User.findById(staffId).populate('role');
  if (!staff) throw new Error('Staff not found');
  if (staff.isSystemAdmin || (staff.role && ['Admin', 'System Administrator'].includes(staff.role.name))) {
    throw new Error('Cannot compute payroll for Admin or System Administrator');
  }
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const payroll = new this({
    staff: staff._id,
    payrollPeriod: { month, year, startDate, endDate },
    salary: { basic: staff.profile?.salary || 0 },
  });
  await payroll.calculatePayroll(); // attendance, advances, recharges, statutory
  return payroll;
};

payrollSchema.statics.getStaffPayrolls = function(staffId, limit = 12) {
  return this.find({ staff: staffId })
    .populate('staff', 'firstName lastName profile.employeeId')
    .populate('calculatedBy approvedBy payment.paidBy', 'firstName lastName')
    .sort({ 'payrollPeriod.year': -1, 'payrollPeriod.month': -1 })
    .limit(limit);
};

payrollSchema.statics.getPayrollSummary = function(month, year) {
  return this.aggregate([
    {
      $match: {
        'payrollPeriod.month': month,
        'payrollPeriod.year': year
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$netSalary' }
      }
    }
  ]);
};

// Add pagination plugin
payrollSchema.plugin(mongoosePaginate);

// Indexes for performance
payrollSchema.index({ staff: 1, 'payrollPeriod.month': 1, 'payrollPeriod.year': 1 }, { unique: true });
payrollSchema.index({ status: 1, 'payrollPeriod.year': -1, 'payrollPeriod.month': -1 });
payrollSchema.index({ 'payrollPeriod.year': -1, 'payrollPeriod.month': -1 });

export default registerModel("Payroll", payrollSchema);
