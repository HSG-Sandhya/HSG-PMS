import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0
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
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });

// Pre-save middleware
categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  next();
});

// Static method to get active categories ordered by displayOrder
categorySchema.statics.getActiveCategories = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

export default mongoose.model('Category', categorySchema);