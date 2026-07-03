import mongoose from "mongoose";

// A persistent corporate / travel-agent / government account. Holds the
// negotiated rate plan (contractRates per room type) and a credit account
// (limit, terms, running balance) so company bookings can pull contract rates
// and book on credit. Created/updated from the company booking dialog or the
// companies manager.
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  companyType: {
    type: String,
    enum: ["Corporate", "Travel Agent", "Government", "Local Business", "Other", ""],
    default: ""
  },
  gstNumber: { type: String, uppercase: true, trim: true, default: "" },
  pan: { type: String, uppercase: true, trim: true, default: "" },
  billingAddress: { type: String, trim: true, default: "" },

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

  // Corporate rate plan — negotiated rate per room type (overrides rack rate).
  contractRates: [{
    roomType: { type: String, trim: true, default: "" },
    rate: { type: Number, default: 0, min: 0 }
  }],

  // Credit account
  creditLimit: { type: Number, default: 0, min: 0 },
  creditDays: { type: Number, default: 0, min: 0 },
  creditUsed: { type: Number, default: 0, min: 0 },   // running outstanding on credit

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Headroom left on the credit account.
companySchema.virtual("creditAvailable").get(function () {
  return Math.max(0, (this.creditLimit || 0) - (this.creditUsed || 0));
});

companySchema.set("toJSON", { virtuals: true });
companySchema.set("toObject", { virtuals: true });

export default mongoose.model("Company", companySchema);
