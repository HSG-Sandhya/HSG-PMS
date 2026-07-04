import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const attendanceSchema = new mongoose.Schema({
  // Staff reference (excluding admin and system admin — checked at controller level)
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Date of attendance
  date: {
    type: Date,
    required: true,
    default: Date.now
  },

  // Clock in/out times
  clockIn: {
    time: { type: Date },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    method: {
      type: String,
      enum: ['manual', 'biometric', 'mobile', 'web'],
      default: 'web'
    },
    ipAddress: String,
    device: String
  },

  clockOut: {
    time: { type: Date },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    method: {
      type: String,
      enum: ['manual', 'biometric', 'mobile', 'web'],
      default: 'web'
    },
    ipAddress: String,
    device: String
  },

  // Break management
  breaks: [{
    type: {
      type: String,
      enum: ['lunch', 'tea', 'personal', 'meeting'],
      required: true
    },
    startTime: { type: Date, required: true },
    endTime: Date,
    duration: { type: Number, default: 0 }, // in minutes
    notes: String
  }],

  // Attendance status
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day', 'overtime', 'holiday', 'leave'],
    required: true,
    default: 'present'
  },

  // Leave information (if applicable)
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'earned', 'maternity', 'paternity', 'emergency', 'unpaid'],
    required: function() { return this.status === 'leave'; }
  },

  leaveReason: {
    type: String,
    required: function() { return this.status === 'leave'; }
  },

  // Work hours calculation
  workHours: {
    scheduled: { type: Number, default: 8 }, // scheduled hours
    actual: { type: Number, default: 0 }, // actual worked hours
    overtime: { type: Number, default: 0 }, // overtime hours
    break: { type: Number, default: 0 } // total break time in hours
  },

  // Shift information
  shift: {
    name: { type: String, default: 'Regular' },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    type: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'rotating'],
      default: 'morning'
    }
  },

  // Performance and notes
  productivity: {
    rating: { type: Number, min: 1, max: 5 },
    tasks_completed: { type: Number, default: 0 },
    notes: String
  },

  // Administrative fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  approvedAt: Date,
  
  notes: String,
  
  // Modification tracking
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  modificationReason: String,
  
  // Payroll integration
  payrollProcessed: { type: Boolean, default: false },
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payroll"
  }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total work duration
attendanceSchema.virtual('totalWorkDuration').get(function() {
  const inTime = this.clockIn?.time;
  const outTime = this.clockOut?.time;
  if (!inTime || !outTime) return 0;
  const duration = (outTime - inTime) / (1000 * 60 * 60); // hours
  const breakTime = this.workHours?.break || 0;
  return Math.max(0, duration - breakTime);
});

// Virtual for late arrival
attendanceSchema.virtual('isLate').get(function() {
  const inTime = this.clockIn?.time;
  const startStr = this.shift?.startTime;
  if (!inTime || !startStr) return false;
  const clockInTime = new Date(inTime);
  const [hours, minutes] = startStr.split(':');
  const shiftStart = new Date(clockInTime);
  shiftStart.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return clockInTime > shiftStart;
});

// Normalize date to start-of-day so a (staff, date) unique index works cleanly.
attendanceSchema.pre('validate', function() {
  if (this.date instanceof Date && !Number.isNaN(this.date.getTime())) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    this.date = d;
  }
});

// Methods
attendanceSchema.methods.calculateWorkHours = function() {
  if (this.clockIn.time && this.clockOut.time) {
    const totalMinutes = (this.clockOut.time - this.clockIn.time) / (1000 * 60);
    const breakMinutes = this.breaks.reduce((total, break_) => {
      if (break_.endTime) {
        return total + ((break_.endTime - break_.startTime) / (1000 * 60));
      }
      return total;
    }, 0);
    
    this.workHours.actual = Math.max(0, (totalMinutes - breakMinutes) / 60);
    this.workHours.break = breakMinutes / 60;
    
    // Calculate overtime
    if (this.workHours.actual > this.workHours.scheduled) {
      this.workHours.overtime = this.workHours.actual - this.workHours.scheduled;
    }
  }
};

attendanceSchema.methods.addBreak = function(breakType, startTime, notes = '') {
  this.breaks.push({
    type: breakType,
    startTime: startTime || new Date(),
    notes
  });
};

attendanceSchema.methods.endBreak = function(breakIndex) {
  if (this.breaks[breakIndex] && !this.breaks[breakIndex].endTime) {
    this.breaks[breakIndex].endTime = new Date();
    const duration = (this.breaks[breakIndex].endTime - this.breaks[breakIndex].startTime) / (1000 * 60);
    this.breaks[breakIndex].duration = duration;
  }
};

// Static methods
attendanceSchema.statics.getStaffAttendance = function(staffId, startDate, endDate) {
  const query = { staff: staffId };
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('staff', 'firstName lastName employeeId')
    .populate('approvedBy', 'firstName lastName')
    .sort({ date: -1 });
};

attendanceSchema.statics.getDailyAttendance = function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    date: { $gte: startOfDay, $lte: endOfDay }
  })
  .populate('staff', 'firstName lastName profile.employeeId role department')
  .populate('approvedBy', 'firstName lastName');
};

attendanceSchema.statics.getAttendanceStats = function(staffId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.aggregate([
    {
      $match: {
        staff: new mongoose.Types.ObjectId(staffId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$workHours.actual' },
        overtimeHours: { $sum: '$workHours.overtime' }
      }
    }
  ]);
};

// Add pagination plugin
attendanceSchema.plugin(mongoosePaginate);

// Indexes for performance
attendanceSchema.index({ staff: 1, date: -1, status: 1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1, date: -1 });
attendanceSchema.index({ payrollProcessed: 1 });

// Hard guard against duplicate (staff, date-day) records — DB-level race protection.
attendanceSchema.index({ staff: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
