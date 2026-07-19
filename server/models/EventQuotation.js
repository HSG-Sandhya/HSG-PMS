import mongoose from 'mongoose';

// A standalone sales quotation for a banquet enquiry — created BEFORE any
// booking exists. Staff quote one or more package options side by side (the
// printed sheet shows them as columns), the client picks one, and the accepted
// package is converted into a BanquetBooking, which then bills through the
// existing invoice pipeline.
//
// This is deliberately separate from the booking-derived quotation
// (banquetIndex.js docType:'quotation'), which itemises an already-costed
// booking. This one is a proposal: package options, inclusions and add-ons.

// One block of inclusions inside a package column, e.g.
//   { title: 'Welcome (3 items)', items: ['Veg Kachri', 'Paneer Pakoda', 'Tea'] }
const inclusionSectionSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '' },
  items: { type: [String], default: [] },
}, { _id: false });

// One quoted package option (a column on the printed quotation).
const packageOptionSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },      // "Full Day Conference"
  tagline: { type: String, trim: true, default: '' },      // "8 hrs · up to 120 pax"
  price: { type: Number, default: 0, min: 0 },
  // How `price` is charged — drives both the printed unit and the maths when
  // the package is converted into a booking.
  priceBasis: {
    type: String,
    enum: ['per person', 'per plate', 'per day', 'per session', 'lump sum'],
    default: 'per person',
  },
  // Quantity assumed for the estimate (pax / plates / days / sessions).
  // Defaults to the quotation's expectedGuests when left at 0.
  quantity: { type: Number, default: 0, min: 0 },
  // Multi-day / multi-session multiplier applied on top of quantity.
  days: { type: Number, default: 1, min: 1 },
  // Marks the column the hotel recommends (printed with a "Recommended" ribbon).
  recommended: { type: Boolean, default: false },
  sections: { type: [inclusionSectionSchema], default: [] },
  notes: { type: String, trim: true, default: '' },
}, { _id: false });

// A chargeable optional facility (sound system, projector, Wi-Fi …). These are
// quoted exclusive of GST — the printed sheet shows "+ x% GST" the way the
// hotel's existing quotation sheets do.
const addOnSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  price: { type: Number, default: 0, min: 0 },
  unit: { type: String, trim: true, default: 'per event' },
  quantity: { type: Number, default: 1, min: 0 },
  gstPercent: { type: Number, default: 18, min: 0, max: 28 },
  note: { type: String, trim: true, default: '' },
}, { _id: false });

const eventQuotationSchema = new mongoose.Schema({
  // Auto-generated on first save: SG-<year>-<3 digit sequence>.
  quotationNumber: { type: String, trim: true, unique: true, index: true },
  quotationDate: { type: Date, default: Date.now },
  validUpto: { type: Date, default: null },

  // ── Prospect ("Prepared for") ────────────────────────────────────────────
  clientName: { type: String, trim: true, required: true },
  clientCompany: { type: String, trim: true, default: '' },
  clientPhone: { type: String, trim: true, default: '' },
  clientEmail: { type: String, trim: true, default: '' },
  clientAddress: { type: String, trim: true, default: '' },
  clientGstin: { type: String, trim: true, default: '' },

  // ── Enquiry details ──────────────────────────────────────────────────────
  // Mirrors BanquetBooking.eventType so a converted quotation maps 1:1.
  eventType: {
    type: String,
    enum: ['Wedding', 'Engagement', 'Reception', 'Anniversary', 'Birthday', 'Meeting', 'Corporate', 'Conference', 'Party', 'Other'],
    default: 'Conference',
  },
  eventTitle: { type: String, trim: true, default: '' },
  hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'BanquetHall', default: null },
  hallName: { type: String, trim: true, default: '' },
  eventDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  startTime: { type: String, trim: true, default: '' },
  endTime: { type: String, trim: true, default: '' },
  expectedGuests: { type: Number, default: 0, min: 0 },
  seatingStyle: {
    type: String,
    enum: ['', 'Theater', 'Round Table', 'Classroom', 'U-Shape', 'Cluster', 'Banquet', 'Cocktail'],
    default: '',
  },

  // ── The offer ────────────────────────────────────────────────────────────
  packages: { type: [packageOptionSchema], default: [] },
  addOns: { type: [addOnSchema], default: [] },
  complimentary: { type: [String], default: [] },   // free inclusions (icon strip)
  terms: { type: [String], default: [] },           // printed terms & conditions
  notes: { type: String, trim: true, default: '' }, // free note above the signature

  preparedBy: { type: String, trim: true, default: '' },
  contactNumber: { type: String, trim: true, default: '' },

  // ── Lifecycle ────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'],
    default: 'Draft',
  },
  // Index of the package the client accepted (into `packages`). -1 = none yet.
  acceptedPackageIndex: { type: Number, default: -1 },
  convertedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'BanquetBooking', default: null },
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

eventQuotationSchema.index({ quotationDate: -1 });
eventQuotationSchema.index({ status: 1, eventDate: 1 });

// Pricing maths lives in services/quotationPricing.js (no Mongoose) so the
// print template and controllers can share it. Re-exported here for callers
// that already have the model in hand.
export { packageTotal, addOnTotal } from '../services/quotationPricing.js';

// Sequence the quotation number on first save: SG-2026-045. The count-based
// sequence can collide under concurrent creates, so the controller retries on
// a duplicate-key error.
eventQuotationSchema.pre('validate', async function () {
  if (this.quotationNumber) return;
  const year = (this.quotationDate ? new Date(this.quotationDate) : new Date()).getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const used = await this.constructor.countDocuments({ quotationDate: { $gte: from, $lt: to } });
  this.quotationNumber = `SG-${year}-${String(used + 1).padStart(3, '0')}`;
});

// Default validity window (15 days) when staff leave "valid upto" blank.
eventQuotationSchema.pre('save', function () {
  if (!this.validUpto) {
    const base = this.quotationDate ? new Date(this.quotationDate) : new Date();
    this.validUpto = new Date(base.getTime() + 15 * 24 * 60 * 60 * 1000);
  }
});

export default mongoose.model('EventQuotation', eventQuotationSchema);
