import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    default: 4
  },
  // Actual guests currently seated — drives the per-person dining charge.
  guests: {
    type: Number,
    min: 1,
    default: 2
  },
  floor: {
    type: String,
    default: 'Ground Floor',
    trim: true
  },
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Reserved', 'Maintenance'],
    default: 'Available'
  },
  section: {
    type: String,
    enum: ['Main', 'Outdoor', 'Private', 'Bar'],
    default: 'Main'
  },
  notes: {
    type: String,
    trim: true
  },
  occupiedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
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
tableSchema.index({ status: 1 });
tableSchema.index({ section: 1 });
tableSchema.index({ isActive: 1 });

// Pre-save middleware
tableSchema.pre('save', function() {
  if (this.isModified('number')) {
    this.number = this.number.trim().toUpperCase();
  }
});

// Static method to get available tables
tableSchema.statics.getAvailableTables = function() {
  return this.find({ status: 'Available', isActive: true });
};

// Method to check if table can be occupied
tableSchema.methods.canBeOccupied = function() {
  return this.status === 'Available' && this.isActive;
};

export default mongoose.model('Table', tableSchema);