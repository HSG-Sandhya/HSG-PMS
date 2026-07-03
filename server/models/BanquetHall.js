import mongoose from 'mongoose';

const banquetHallSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  area: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerHour: {
    type: Number,
    required: true,
    min: 0
  },
  // Per-day hire charge for a function (what the venue actually quotes). When
  // present, the website shows this as "₹X per day" instead of the hourly rate.
  pricePerDay: {
    type: Number,
    min: 0
  },
  amenities: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  images: [{
    type: String
  }],
  location: {
    type: String,
    trim: true
  },
  setupOptions: [{
    type: String,
    enum: ['Theater', 'Classroom', 'Banquet', 'Conference', 'U-Shape', 'Cocktail']
  }]
}, {
  timestamps: true
});

export default mongoose.model('BanquetHall', banquetHallSchema);
