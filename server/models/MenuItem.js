import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  isVeg: {
    type: Boolean,
    default: true
  },
  preparationTime: {
    type: Number,
    default: 15,
    min: 1
  },
  popular: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  image: {
    type: String
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
menuItemSchema.index({ name: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ popular: 1 });

// Pre-save middleware
menuItemSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  if (this.isModified('price')) {
    this.price = parseFloat(this.price.toFixed(2));
  }
  next();
});

// Static method to get available menu items
menuItemSchema.statics.getAvailableItems = function() {
  return this.find({ isAvailable: true }).populate('category');
};

export default mongoose.model('MenuItem', menuItemSchema);