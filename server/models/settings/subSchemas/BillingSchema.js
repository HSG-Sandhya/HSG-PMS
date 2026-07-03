import { Schema } from 'mongoose';
import { BILLING_DEFAULTS } from '../../../config/operationalDefaults.js';

// Billing & Tariff settings — every money/tax/invoice/currency rule that used to
// be hardcoded across the booking and POS flows. Defaults come from the single
// operationalDefaults source so the schema and the runtime fallback never drift.
const BillingSchema = new Schema(
  {
    roomGstRate: { type: Number, min: 0, max: 100, default: BILLING_DEFAULTS.roomGstRate },
    posGstRate: { type: Number, min: 0, max: 100, default: BILLING_DEFAULTS.posGstRate },
    breakfastChargePerNight: { type: Number, min: 0, default: BILLING_DEFAULTS.breakfastChargePerNight },
    defaultCheckInTime: { type: String, trim: true, default: BILLING_DEFAULTS.defaultCheckInTime },
    defaultCheckOutTime: { type: String, trim: true, default: BILLING_DEFAULTS.defaultCheckOutTime },
    invoicePrefix: { type: String, trim: true, uppercase: true, default: BILLING_DEFAULTS.invoicePrefix },
    currencyCode: { type: String, trim: true, uppercase: true, default: BILLING_DEFAULTS.currencyCode },
    currencySymbol: { type: String, trim: true, default: BILLING_DEFAULTS.currencySymbol },
    maxDiscountPercent: { type: Number, min: 0, max: 100, default: BILLING_DEFAULTS.maxDiscountPercent },
    roundAmounts: { type: Boolean, default: BILLING_DEFAULTS.roundAmounts },
    banquetVenueHourlyRate: { type: Number, min: 0, default: BILLING_DEFAULTS.banquetVenueHourlyRate },
  },
  { _id: false }
);

export default BillingSchema;
