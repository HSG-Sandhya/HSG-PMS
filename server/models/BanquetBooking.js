import mongoose from 'mongoose';

const banquetBookingSchema = new mongoose.Schema({
  // Hall reference (optional for non-hall events)
  hallId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BanquetHall',
    required: false
  },

  // Guest rooms reserved for this event — blocked from regular booking on these dates
  rooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],

  // Customer Information
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true
  },

  // Extended customer / KYC details (optional)
  address: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  idProofType: {
    type: String,
    enum: ['', 'Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other'],
    default: ''
  },
  idProofNumber: { type: String, trim: true, default: '' },
  gstNumber: { type: String, trim: true, default: '' },

  // Event Details
  eventName: {
    type: String,
    trim: true
  },
  // Free-text event title, e.g. "Rahul & Priya Wedding"
  eventTitle: { type: String, trim: true, default: '' },
  groomName: { type: String, trim: true, default: '' },
  brideName: { type: String, trim: true, default: '' },

  // ── Type-specific event details ──────────────────────────────────────────
  // Only certain event categories use these (corporate/conference/birthday/
  // social); grouped here so the schema stays tidy. The booking form shows only
  // the fields relevant to the chosen eventType and leaves the rest at default.
  eventDetails: {
    // Corporate / Conference
    organizationName: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    agenda: { type: String, trim: true, default: '' },
    delegates: { type: Number, default: 0, min: 0 },
    sessionsDays: { type: Number, default: 0, min: 0 },
    avRequired: { type: Boolean, default: false },
    // Birthday
    birthdayPersonName: { type: String, trim: true, default: '' },
    birthdayAge: { type: Number, default: 0, min: 0 },
    theme: { type: String, trim: true, default: '' },
    cakeRequired: { type: Boolean, default: false },
    cakeMessage: { type: String, trim: true, default: '' },
    // Social (engagement / anniversary / party / get-together)
    celebrantNames: { type: String, trim: true, default: '' },
    occasionNote: { type: String, trim: true, default: '' },
  },
  eventType: {
    type: String,
    enum: ["Wedding", "Engagement", "Reception", "Anniversary", "Birthday", "Meeting", "Corporate", "Conference", "Party", "Other"],
    default: "Other"
  },
  eventDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  eventDuration: {
    type: Number,
    default: 1
  },

  // Guest and Capacity
  guestCount: {
    type: Number,
    required: true,
    min: 1
  },

  // Venue configuration (optional)
  venueCapacity: { type: Number, default: 0, min: 0 },
  seatingStyle: {
    type: String,
    enum: ['', 'Theater', 'Round Table', 'Classroom', 'U-Shape', 'Cluster', 'Banquet', 'Cocktail'],
    default: ''
  },

  // Guest breakdown — guestCount stays the headline number; these refine it.
  expectedGuests: { type: Number, default: 0, min: 0 },
  guaranteedGuests: { type: Number, default: 0, min: 0 },
  vipGuests: { type: Number, default: 0, min: 0 },
  kidsCount: { type: Number, default: 0, min: 0 },

  // ── Room booking for baraat / out-of-town guests ─────────────────────────
  // The `rooms` array (above) holds the specific rooms blocked for the event.
  // These fields capture the booking intent / extras around them.
  roomCheckIn: { type: Date, default: null },
  roomCheckOut: { type: Date, default: null },
  roomTypes: { type: [String], default: [] }, // e.g. ['Deluxe', 'Suite']
  complimentaryRooms: { type: Number, default: 0, min: 0 },
  extraBedRequired: { type: Boolean, default: false },

  // ── Decoration extras (informational, alongside decorationType pricing) ───
  // e.g. ['Stage Decoration', 'Floral Decoration', 'Mandap Setup', 'LED Wall']
  decorationOptions: { type: [String], default: [] },
  decorVendor: { type: String, trim: true, default: '' },

  // ── Photography & Videography ────────────────────────────────────────────
  photographyRequired: { type: Boolean, default: false },
  videographyRequired: { type: Boolean, default: false },
  droneCoverage: { type: Boolean, default: false },
  preWeddingShoot: { type: Boolean, default: false },
  photographyVendor: { type: String, trim: true, default: '' },
  photographyAmount: { type: Number, default: 0, min: 0 },

  // ── Entertainment ────────────────────────────────────────────────────────
  // e.g. ['DJ Setup', 'Live Band', 'Orchestra', 'Anchor/Host', 'Dhol', 'Fireworks']
  entertainmentOptions: { type: [String], default: [] },
  entertainmentVendor: { type: String, trim: true, default: '' },
  entertainmentCost: { type: Number, default: 0, min: 0 },

  // Financial Details
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // ── Advance collection ledger ────────────────────────────────────────────
  // Each entry is one payment received towards the event. advanceAmount stays
  // in sync as the sum of these (see pre-save), so the front desk can record
  // several advances over time with a full receipt trail.
  payments: [{
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['Cash', 'Card', 'UPI', 'Net Banking', 'Cheque', 'Other'], default: 'Cash' },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    receivedBy: { type: String, trim: true, default: '' },
    date: { type: Date, default: Date.now }
  }],

  // Optional link to the event package applied to this booking.
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventPackage', default: null },
  packageName: { type: String, trim: true, default: '' },

  // Optional catering package + plate count — catering cost is simply
  // cateringPerPlate × numberOfPlates × daysWithMeals (see the form).
  // These hold a flattened summary of cateringItems (first item / sum) so the
  // legacy invoice/print code keeps working; cateringItems is the source of truth.
  cateringPackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'CateringPackage', default: null },
  cateringPackageName: { type: String, trim: true, default: '' },
  cateringPerPlate: { type: Number, default: 0, min: 0 },
  numberOfPlates: { type: Number, default: 0, min: 0 },

  // ── Repeatable catering line items ───────────────────────────────────────
  // Staff can add several catering selections to one booking, each priced
  // separately (perPlate × plates × days). menuCost is the sum of amounts.
  cateringItems: [{
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'CateringPackage', default: null },
    name: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    // Which sitting this line caters (Breakfast / Lunch / Hi-Tea / Dinner /
    // All-day) — a multi-day event can have several meals per day.
    meal: { type: String, trim: true, default: '' },
    perPlate: { type: Number, default: 0, min: 0 },
    // `plates` is the quoted/estimated count shown on the quotation.
    plates: { type: Number, default: 0, min: 0 },
    // `actualPlates` is entered after the event (post-event billing). When set,
    // it — not `plates` — drives the billed amount and the final invoice. null
    // means "not yet finalised", so the estimate still applies.
    actualPlates: { type: Number, default: null, min: 0 },
    days: { type: Number, default: 1, min: 1 },
    amount: { type: Number, default: 0, min: 0 },
  }],

  // ── Repeatable decoration line items ─────────────────────────────────────
  // Each is a flat-priced décor selection (from a DecorationPackage or custom).
  // decorationCost is kept in sync as the sum of these (plus any event-package
  // decoration) for the invoice/print code.
  decorationItems: [{
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'DecorationPackage', default: null },
    name: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    cost: { type: Number, default: 0, min: 0 },
    details: { type: String, trim: true, default: '' },
  }],

  // ── Rented utensils / cookware (self-cooking guests) ─────────────────────
  // Each line hires some quantity of a UtensilItem at a per-unit cost; the sum
  // of amounts is utensilsCost, added to the booking total. Quantities reserve
  // stock against the item's owned total while the booking is active.
  utensilItems: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'UtensilItem', default: null },
    name: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'piece' },
    cost: { type: Number, default: 0, min: 0 },      // per-unit at time of booking
    quantity: { type: Number, default: 0, min: 0 },  // how many taken
    amount: { type: Number, default: 0, min: 0 },    // cost × quantity
  }],
  utensilsCost: { type: Number, default: 0, min: 0 },

  // ── Miscellaneous chargeable extras ──────────────────────────────────────
  // Flat-priced add-ons that don't belong to any of the typed buckets above —
  // e.g. the "Additional facilities" (sound system, projector, Wi-Fi) a client
  // takes off a quotation. Amounts are stored GROSS (GST already included, the
  // way they were quoted). extrasCost is the sum, included in totalAmount.
  // `price` and `gstPercent` are the ex-GST inputs kept so the line stays
  // editable after the event ("₹2,000 + 18%"); `amount` is the GROSS total
  // actually billed (price × quantity + GST) and is the field the invoice reads.
  extraItems: [{
    name: { type: String, trim: true, default: '' },
    detail: { type: String, trim: true, default: '' },
    price: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0, max: 28 },
    quantity: { type: Number, default: 1, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  }],
  extrasCost: { type: Number, default: 0, min: 0 },

  // ── Origin quotation ─────────────────────────────────────────────────────
  // Set when the booking was created by converting an EventQuotation, so the
  // sales trail from proposal → booking → invoice stays intact.
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventQuotation', default: null },
  quotationNumber: { type: String, trim: true, default: '' },

  // Status Management
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
    default: 'Pending'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid'],
    default: 'Pending'
  },

  // Where the booking came from — lets the PMS distinguish public website
  // enquiries (need a follow-up call) from bookings taken at reception.
  source: {
    type: String,
    enum: ['website', 'reception', 'phone', 'walk-in', 'internal'],
    default: 'reception'
  },

  // Setup and Configuration
  setupType: {
    type: String,
    enum: ['Theater', 'Classroom', 'Banquet', 'Conference', 'U-Shape', 'Cocktail']
  },
  specialRequests: {
    type: String,
    trim: true
  },
  additionalServices: [String],

  // Wedding/Marriage Specific Features
  decorationType: {
    type: String,
    enum: ["Standard", "Premium", "Custom"],
    default: "Standard"
  },
  // Client's requirement description when decorationType is "Custom"
  decorationDetails: {
    type: String,
    trim: true
  },
  decorationCost: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Floor/Venue Selection
  floorSelection: {
    type: [String],
    default: []
  },
  floorCost: {
    type: Number,
    default: 0
  },
  // Charge for guest rooms reserved for the event that are NOT part of a booked
  // floor package (the `rooms` array). Billed at the banquet per-room rate,
  // separate from the hall/floor price. Computed on the form and stored here so
  // the invoice/quotation can bill it.
  roomsCost: {
    type: Number,
    default: 0,
    min: 0
  },

  // Menu System (for catered events)
  menu: {
    mealType: { 
      type: String, 
      default: "" 
    },
    hasMeals: {
      type: Boolean,
      default: false
    },
    numberOfPlates: {
      type: String,
      default: ""
    },
    side: { 
      type: Object, 
      default: {} 
    },
    extra: { 
      type: Object, 
      default: {} 
    },
    combo: {
      type: Object,
      default: {}
    },
    beverages: {
      type: Object,
      default: {}
    }
  },
  menuCost: {
    type: Number,
    default: 0
  },

  // Multi-day event support
  daysWithMeals: {
    type: Number,
    default: 0
  },

  // ── Event coordinator / sales ownership ──────────────────────────────────
  salesExecutive: { type: String, trim: true, default: '' },
  eventManager: { type: String, trim: true, default: '' },
  coordinatorPhone: { type: String, trim: true, default: '' },

  // ── Payment schedule (installment plan) ──────────────────────────────────
  // Independent of the `payments` ledger — this is the agreed plan of what is
  // due and when, which reception ticks off as installments are collected.
  paymentSchedule: [{
    label: { type: String, trim: true, default: '' }, // e.g. "1st Installment"
    dueDate: { type: Date, default: null },
    amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' }
  }],

  // ── Post-event billing ───────────────────────────────────────────────────
  // Set when staff finalise the bill after the event using the actual plates
  // consumed. Once true, totalAmount / cateringItems reflect actuals, not the
  // quoted estimate, and the invoice bills those actuals.
  billingFinalized: { type: Boolean, default: false },
  finalizedAt: { type: Date, default: null },

  // ── Contract & terms ─────────────────────────────────────────────────────
  cancellationPolicy: { type: String, trim: true, default: '' },
  refundPolicy: { type: String, trim: true, default: '' },
  damageCharges: { type: String, trim: true, default: '' },
  overtimeCharges: { type: String, trim: true, default: '' },
  outsideVendorPolicy: { type: String, trim: true, default: '' },
  termsAccepted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Pre-save middleware for calculations
banquetBookingSchema.pre('save', function() {
  // If a payments ledger exists, the advance is the sum of all entries —
  // this is the source of truth. Falls back to the manual advanceAmount when
  // there are no ledger entries (legacy bookings).
  if (Array.isArray(this.payments) && this.payments.length > 0) {
    this.advanceAmount = this.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }

  // Calculate remaining amount
  this.remainingAmount = Math.max(0, this.totalAmount - this.advanceAmount);
  
  // Update payment status based on amounts
  if (this.advanceAmount === 0) {
    this.paymentStatus = 'Pending';
  } else if (this.advanceAmount >= this.totalAmount) {
    this.paymentStatus = 'Paid';
  } else {
    this.paymentStatus = 'Partial';
  }
  
  // Set eventName from eventType if not provided
  if (!this.eventName && this.eventType) {
    this.eventName = this.eventType;
  }
});

// Instance methods
banquetBookingSchema.methods.isWeddingEvent = function() {
  return ['Wedding', 'Engagement', 'Reception'].includes(this.eventType);
};

banquetBookingSchema.methods.requiresMenu = function() {
  return this.isWeddingEvent() || this.eventType === 'Corporate';
};

banquetBookingSchema.methods.isMultiDay = function() {
  return this.endDate && this.endDate > this.eventDate;
};

export default mongoose.model('BanquetBooking', banquetBookingSchema);
