import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  budget: {
    type: Number,
    default: 0,
    min: 0
  },
  staffCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#6B7280'
  },
  permissions: [{
    type: String,
    trim: true
  }],
  settings: {
    maxStaff: {
      type: Number,
      default: null
    },
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    breakDuration: {
      type: Number,
      default: 30
    }
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
// Note: name field already has a unique index from unique: true
departmentSchema.index({ isActive: 1 });

// Pre-save middleware
departmentSchema.pre('save', function() {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
});

// Method to get department without sensitive data
departmentSchema.methods.toPublic = function() {
  const dept = this.toObject();
  return {
    id: dept._id,
    name: dept.name,
    description: dept.description,
    headOfDepartment: dept.headOfDepartment,
    staffCount: dept.staffCount,
    isActive: dept.isActive,
    color: dept.color,
    createdAt: dept.createdAt
  };
};

// Static method to get department color map
departmentSchema.statics.getColorMap = function() {
  return {
    'Front Office': '#6366F1',
    'Front Desk': '#6366F1', 
    'Housekeeping': '#10B981',
    'Restaurant': '#F59E0B',
    'F&B': '#F59E0B',
    'Kitchen': '#F59E0B',
    'Maintenance': '#EF4444',
    'Security': '#8B5CF6',
    'Management': '#EC4899',
    'Accounts': '#06B6D4',
    'Finance': '#06B6D4',
    'Transport': '#84CC16',
    'Banquet': '#EC4899',
    'Sales & Marketing': '#F97316',
    'HR': '#8B5CF6'
  };
};

export default mongoose.model('Department', departmentSchema);