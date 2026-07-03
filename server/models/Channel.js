import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['ota', 'direct', 'corporate', 'travel_agent', 'other'],
    default: 'ota'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  settings: {
    commission: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    markup: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  apiConfig: {
    endpoint: String,
    apiKey: String,
    secretKey: String,
    username: String,
    password: String,
    isActive: {
      type: Boolean,
      default: false
    }
  },
  syncSettings: {
    autoSync: {
      type: Boolean,
      default: false
    },
    syncInterval: {
      type: Number,
      default: 30,
      min: 5,
      max: 1440
    },
    lastSync: Date,
    nextSync: Date
  },
  rateSettings: {
    baseRateMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1
    },
    minRate: Number,
    maxRate: Number,
    dynamicPricing: {
      type: Boolean,
      default: false
    }
  },
  roomMappings: [{
    internalRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    externalRoomId: String,
    externalRoomName: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  bookingRules: {
    minAdvanceBooking: {
      type: Number,
      default: 0
    },
    maxAdvanceBooking: {
      type: Number,
      default: 365
    },
    allowSameDayBooking: {
      type: Boolean,
      default: true
    },
    allowOverbooking: {
      type: Boolean,
      default: false
    }
  },
  contact: {
    name: String,
    email: String,
    phone: String,
    address: String
  },
  metrics: {
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    lastBookingDate: Date
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
channelSchema.index({ name: 1 });
channelSchema.index({ type: 1 });
channelSchema.index({ status: 1 });
channelSchema.index({ 'syncSettings.lastSync': 1 });

// Virtual for commission percentage
channelSchema.virtual('commissionPercentage').get(function() {
  return this.settings.commission;
});

// Method to calculate final rate
channelSchema.methods.calculateFinalRate = function(baseRate) {
  let finalRate = baseRate;
  
  if (this.settings.markup > 0) {
    finalRate += (baseRate * this.settings.markup / 100);
  }
  
  if (this.settings.commission > 0) {
    finalRate = finalRate / (1 - this.settings.commission / 100);
  }
  
  return Math.round(finalRate);
};

// Method to check if channel is ready for sync
channelSchema.methods.isReadyForSync = function() {
  if (!this.syncSettings.autoSync) return false;
  if (!this.apiConfig.isActive) return false;
  if (this.status !== 'active') return false;
  
  const now = new Date();
  return !this.syncSettings.nextSync || this.syncSettings.nextSync <= now;
};

// Static method to get active channels
channelSchema.statics.getActiveChannels = function() {
  return this.find({ status: 'active' });
};

// Static method to get channels ready for sync
channelSchema.statics.getChannelsReadyForSync = function() {
  return this.find({
    status: 'active',
    'syncSettings.autoSync': true,
    'apiConfig.isActive': true
  });
};

export default mongoose.model('Channel', channelSchema);