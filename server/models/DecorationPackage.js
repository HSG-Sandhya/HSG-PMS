import mongoose from 'mongoose';

// A reusable decoration package — a named décor bundle (e.g. "Royal Stage &
// Mandap", "Floral Entrance", "Birthday Balloon Theme"). Staff define it once
// with a flat price and the list of what it includes, then pick it (one or
// several) on a booking. The booking's decoration cost is simply the sum of the
// chosen packages' prices.
const decorationPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Loose grouping to help staff filter — purely descriptive.
  category: {
    type: String,
    enum: ['Standard', 'Premium', 'Theme', 'Floral', 'Stage', 'Custom'],
    default: 'Standard',
  },

  // Flat price for the whole decoration bundle.
  price: { type: Number, default: 0, min: 0 },

  // What the package includes (shown to staff/guest on the form & print).
  items: [{ type: String, trim: true }],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('DecorationPackage', decorationPackageSchema);
