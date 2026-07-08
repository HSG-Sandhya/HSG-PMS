import mongoose from "mongoose";
import { BILLING_DEFAULTS } from "../config/operationalDefaults.js";

const bookingSchema = new mongoose.Schema({
  guestName: { type: String, required: [true, "Guest name is required"], trim: true },
  email: {
    type: String,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email address"],
    trim: true,
    lowercase: true
  },
  phone: { type: String, required: [true, "Phone number is required"], trim: true },
  age: { type: String },
  gender: { type: String, enum: ["Male", "Female", "Other", ""] },
  nationality: { type: String },
  // Front-office classification of the guest (drives VIP handling, reporting).
  guestType: {
    type: String,
    enum: ["Individual", "Corporate", "VIP", "Group", ""],
    default: "Individual"
  },

  // ID card
  idCardType: {
    type: String,
    enum: ["Aadhaar Card", "Aadhaar", "Passport", "Driving License", "Voter ID", "PAN Card", "Other"]
  },
  idCardNumber: String,
  idCardImage: String,      // front of the ID document (stored upload path)
  idCardImageBack: String,  // back of the ID document (Aadhaar address side)

  // Travel details
  customerOrigin: String,
  customerDestination: String,
  travelMode: String,
  purposeOfVisit: String,

  // Address
  streetName: String,
  area: String,
  pincode: String,
  district: String,
  state: String,

  // Booking details
  // roomId is optional: website bookings reserve a category (roomType) and the
  // specific room is assigned by staff at check-in. Direct/back-office bookings
  // set roomId immediately.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  // Requested room category, used while no specific room is assigned.
  roomType: { type: String, trim: true, default: "" },
  // Occupancy/sharing label for the rooming list (Single, Twin, Double, …).
  sharing: { type: String, trim: true, default: "" },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  checkIn: { type: Date, required: [true, "Check-in date is required"] },
  checkOut: { type: Date, required: [true, "Check-out date is required"] },
  checkInTime: { type: String, default: BILLING_DEFAULTS.defaultCheckInTime },
  checkOutTime: { type: String, default: BILLING_DEFAULTS.defaultCheckOutTime },
  adults: { type: Number, default: 1, min: 1 },
  children: { type: Number, default: 0, min: 0 },
  // Number of rooms of the chosen category reserved under this booking. Website
  // guests can book several rooms of the same category in one go; staff assign
  // the specific room numbers at check-in.
  roomCount: { type: Number, default: 1, min: 1 },

  // Payment
  totalAmount: { type: Number, required: [true, "Total amount is required"] },
  baseAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },       // percentage off the subtotal (applied 0–100)
  discountAmount: { type: Number, default: 0 }, // rupee value of the discount
  gstAmount: { type: Number, default: 0 },
  // Itemised priced add-ons beyond the room tariff (each a rupee amount).
  extraCharges: {
    extraBed: { type: Number, default: 0 },
    extraPerson: { type: Number, default: 0 },
    foodPackage: { type: Number, default: 0 },
    laundry: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  extraChargesTotal: { type: Number, default: 0 },
  // Tiered late-checkout fee (base, pre-GST) applied at checkout when the guest
  // leaves past the grace window. Folded into baseAmount/gstAmount/totalAmount.
  lateCheckoutFee: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ["Cash", "Card", "UPI", "Net Banking", "Other", "pay_at_hotel", "online", ""]
  },
  paymentStatus: {
    type: String,
    enum: ["Paid", "Pending", "Partial", "Refunded", "Failed"],
    default: "Pending"
  },

  // Payment gateways
  razorpayPaymentId: { type: String, sparse: true },
  razorpayOrderId: { type: String, sparse: true },
  razorpaySignature: { type: String },
  paymentGateway: { type: String, enum: ["razorpay", "paytm", "phonepe", "gpay", "manual"], default: "manual" },
  transactionId: String,
  paymentDate: Date,

  // Status
  // The group workflow extends the lifecycle with Draft (saved enquiry),
  // Tentative (held, unconfirmed) and Checked-In. Legacy individual bookings
  // keep using Confirmed/Pending/Completed/Cancelled/Rejected.
  bookingStatus: {
    type: String,
    enum: ["Draft", "Tentative", "Confirmed", "Pending", "Checked-In", "Cancelled", "Completed", "Rejected"],
    default: "Pending"
  },

  // ── Physical presence ────────────────────────────────────────────────────
  // bookingStatus tracks the *reservation* lifecycle. checkedIn tracks whether
  // the guest has actually arrived. A room is only "occupied" when a booking
  // is checkedIn — a confirmed-but-not-arrived reservation leaves the room
  // available/reserved, so the front desk can still see it as bookable.
  checkedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date, default: null },
  checkedOutAt: { type: Date, default: null },

  specialRequests: String,

  // How the reservation reached the hotel (front-office source of business).
  bookingSource: {
    type: String,
    enum: ["Walk-in", "Website", "OTA", "Corporate", "Travel Agent", "Referral", "Phone", ""],
    default: "Walk-in"
  },
  // Non-priced service preferences selected at booking (Restaurant, Banquet,
  // Pickup & Drop, Room Decoration, etc.). Priced add-ons stay in the amounts.
  additionalServices: { type: [String], default: [] },

  // ── Booking type: individual / group / company ───────────────────────────
  // `individual` (default) keeps the legacy single-guest behaviour. `group`
  // links several room bookings under one coordinator via groupId. `company`
  // marks a corporate booking that bills to the company block below.
  bookingType: {
    type: String,
    enum: ["individual", "group", "company"],
    default: "individual"
  },

  // ── Group booking ────────────────────────────────────────────────────────
  // Every room in a group shares the same groupId + groupName. Exactly one
  // booking in the group carries isGroupMaster: true — that is the master
  // folio the front desk settles against, and groupTotalAmount/groupRoomCount
  // describe the whole party for the consolidated invoice.
  groupId: { type: String, trim: true, default: null, index: true, sparse: true },
  groupName: { type: String, trim: true, default: "" },
  isGroupMaster: { type: Boolean, default: false },
  groupTotalAmount: { type: Number, default: 0 },
  groupRoomCount: { type: Number, default: 0 },

  // Rich group details — only populated on the group master booking. Captures
  // the front-desk group form (type, pax mix, room block, billing & advance)
  // so the consolidated folio and rooming list can be rebuilt from one record.
  groupDetails: {
    groupType: {
      type: String,
      enum: ["Corporate", "Tour", "Religious", "Government", "School/College", "Sports Team", "Family", "Other", ""],
      default: ""
    },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    // Pax breakdown for the whole party.
    adults: { type: Number, default: 0, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    male: { type: Number, default: 0, min: 0 },
    female: { type: Number, default: 0, min: 0 },
    // Room block: blocked inventory by type before individual rooms are assigned.
    roomBlock: [{
      roomType: { type: String, trim: true, default: "" },
      qty: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },   // negotiated group rate per room/night
      pax: { type: Number, default: 0, min: 0 }
    }],
    // Billing: one master folio, individual guest folios, or a split.
    billingType: { type: String, enum: ["master", "individual", "split"], default: "master" },
    // Advance payment captured at booking time.
    advanceAmount: { type: Number, default: 0, min: 0 },
    advancePaymentMode: { type: String, enum: ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", ""], default: "" },
    advanceTransactionId: { type: String, trim: true, default: "" }
  },

  // ── Company / corporate billing ──────────────────────────────────────────
  // Populated when bookingType === 'company'. These print on the invoice in
  // place of (or alongside) the individual guest's details.
  company: {
    // Link to the persistent Company account (rate plan + credit), when one is used.
    ref: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    name: { type: String, trim: true, default: "" },
    companyType: {
      type: String,
      enum: ["Corporate", "Travel Agent", "Government", "Local Business", "Other", ""],
      default: ""
    },
    gstNumber: { type: String, uppercase: true, trim: true, default: "" },
    pan: { type: String, uppercase: true, trim: true, default: "" },
    billingAddress: { type: String, trim: true, default: "" },
    creditLimit: { type: Number, default: 0, min: 0 },
    contactPerson: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" }
  },

  // ── Company booking details ──────────────────────────────────────────────
  // Only populated on the master booking of a company cluster (several employee
  // bookings sharing one groupId, bookingType='company'). Holds contacts, the
  // employee/guest list, room requirement, corporate credit terms and advance.
  companyDetails: {
    primaryContact: {
      name: { type: String, trim: true, default: "" },
      designation: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" }
    },
    alternateContact: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" }
    },
    employees: [{
      name: { type: String, trim: true, default: "" },
      mobile: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      employeeId: { type: String, trim: true, default: "" },
      department: { type: String, trim: true, default: "" },
      designation: { type: String, trim: true, default: "" }
    }],
    roomRequirement: [{
      roomType: { type: String, trim: true, default: "" },
      qty: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 }   // corporate/contract rate per room/night
    }],
    // Billing & credit
    payBy: { type: String, enum: ["guest", "company", "split"], default: "company" },
    creditType: { type: String, enum: ["advance", "credit"], default: "advance" },
    creditDays: { type: Number, default: 0, min: 0 },
    poNumber: { type: String, trim: true, default: "" },
    referenceNumber: { type: String, trim: true, default: "" },
    gstInvoice: { type: Boolean, default: false },
    // Advance payment captured at booking time.
    advanceAmount: { type: Number, default: 0, min: 0 },
    advancePaymentMode: { type: String, enum: ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", ""], default: "" },
    advanceTransactionId: { type: String, trim: true, default: "" }
  },

  // ── Room transfer history ────────────────────────────────────────────────
  // Appended each time a guest is moved to a different room mid-stay. The
  // live roomId always reflects the current room; this is the audit trail.
  transferHistory: [{
    fromRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    fromRoomNumber: String,
    toRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    toRoomNumber: String,
    reason: { type: String, trim: true, default: "" },
    priceAdjustment: { type: Number, default: 0 },
    transferredAt: { type: Date, default: Date.now }
  }],

  // Invoice
  invoiceNumber: {
    type: String,
    unique: true,
    default: function () {
      return `${BILLING_DEFAULTS.invoicePrefix}-1001`; // fallback; controller should overwrite
    }
  },

  // Customer
  customerId: { type: String, unique: true, required: true }
}, { timestamps: true });

// Indexes — keep the common list/lookup queries fast.
//   checkIn (-1)            → sort in getBookings + every date-filtered list
//   roomId + bookingStatus  → "active bookings for this room" lookups + the
//                             populate join from /api/bookings
//   bookingStatus           → status-filtered lists (Pending/Confirmed/etc.)
//   checkIn + checkOut      → overlap queries used by availability checks
bookingSchema.index({ checkIn: -1 });
bookingSchema.index({ roomId: 1, bookingStatus: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ checkIn: 1, checkOut: 1 });

// Auto-update remaining amount
bookingSchema.pre("save", function () {
  this.remainingAmount = Math.max(0, this.totalAmount - this.paidAmount);
});

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
