import mongoose from 'mongoose';

// A reusable catering package — a named per-plate menu bundle (e.g. "Silver Veg
// Thali", "Royal Non-Veg Buffet"). Staff define it once with a price-per-plate
// and the list of dishes it includes, then pick it on a booking so the catering
// cost is simply pricePerPlate × number of plates.
const cateringPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Veg / Non-Veg / Mixed — purely descriptive, helps staff filter.
  category: { type: String, enum: ['Veg', 'Non-Veg', 'Mixed'], default: 'Veg' },

  // The only price that matters: charge per guest plate.
  pricePerPlate: { type: Number, default: 0, min: 0 },

  // Dishes included in this package (shown to staff/guest on the form & print).
  items: [{ type: String, trim: true }],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('CateringPackage', cateringPackageSchema);
