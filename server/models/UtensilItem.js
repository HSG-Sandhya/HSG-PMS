import mongoose from 'mongoose';

// A rentable utensil / cookware item the hall owns and hires out to guests who
// cook their own food (e.g. steel plates, water jars, cooking pots, gas
// cylinders). Staff define each item once with a per-unit rental cost and the
// TOTAL quantity owned; a booking then "takes" some quantity (chargeable), and
// live availability = quantityTotal − quantity reserved by other active bookings
// (Pending/Confirmed). Stock is freed automatically when an event is Completed
// or Cancelled, so availability is always derived, never a drifting counter.
const utensilItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Grouping for the picker (Cookware / Serving / Water / Gas / Other).
  category: {
    type: String,
    enum: ['Cookware', 'Serving', 'Water', 'Gas', 'Furniture', 'Other'],
    default: 'Cookware',
  },

  // How one quantity is counted (piece, set, litre…). Purely descriptive.
  unit: { type: String, trim: true, default: 'piece' },

  // Per-unit rental charge added to the booking total for each one taken.
  cost: { type: Number, default: 0, min: 0 },

  // Total number the hall owns — the ceiling on how many can be out at once.
  quantityTotal: { type: Number, default: 0, min: 0 },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('UtensilItem', utensilItemSchema);
