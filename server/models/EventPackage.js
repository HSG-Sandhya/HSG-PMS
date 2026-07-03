import mongoose from 'mongoose';

// A reusable event package — a named bundle of hall + decoration + per-plate
// catering + inclusions at a set price, so staff define it once and apply it
// to a booking to prefill the financials.
const eventPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Which event types this package suits (empty = all).
  eventTypes: [{ type: String, trim: true }],

  // Optional default hall the package is associated with.
  hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'BanquetHall', default: null },

  // Financials the package contributes to a booking.
  basePrice: { type: Number, default: 0, min: 0 },        // flat hall/venue charge
  pricePerPlate: { type: Number, default: 0, min: 0 },     // catering per guest
  decorationType: { type: String, enum: ['Standard', 'Premium', 'Custom'], default: 'Standard' },
  decorationCost: { type: Number, default: 0, min: 0 },

  // Bullet list of what's included (shown to staff/guest).
  inclusions: [{ type: String, trim: true }],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('EventPackage', eventPackageSchema);
