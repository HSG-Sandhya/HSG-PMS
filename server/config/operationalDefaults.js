// ───────────────────────────────────────────────────────────────────────────
// Operational defaults — THE single source of truth for every business rule.
//
// These are the ONLY places these literals are allowed to appear in the whole
// server. The Settings schema seeds its `default:` values from here, the runtime
// config accessor (config/operationalConfig.js) falls back to these when a value
// is unset, and the booking/restaurant/housekeeping controllers read the resolved
// config — never a bare literal. To change a default app-wide, change it here;
// to change it per-property, edit it in Settings (Billing & Tariff / Operations).
//
// Values are chosen to EXACTLY preserve the behaviour the app shipped with, so
// nothing changes until an admin edits a setting.
// ───────────────────────────────────────────────────────────────────────────

// Billing & Tariff — money, tax, invoice numbering, currency.
export const BILLING_DEFAULTS = Object.freeze({
  roomGstRate: 5,                 // % GST applied to room tariff (subtotal)
  posGstRate: 5,                  // % GST applied to restaurant / POS orders
  breakfastChargePerNight: 200,   // ₹ added per night when tariff includes breakfast
  defaultCheckInTime: '12:00',    // HH:mm used when a booking omits a check-in time
  defaultCheckOutTime: '11:00',   // HH:mm used when a booking omits a check-out time
  invoicePrefix: 'HSG',           // leading token on every generated invoice number
  currencyCode: 'INR',            // ISO currency code stored on accounts/transactions
  currencySymbol: '₹',            // symbol rendered in front of amounts app-wide
  maxDiscountPercent: 100,        // upper clamp on a booking discount percentage
  roundAmounts: true,             // round computed money values to whole units
  banquetVenueHourlyRate: 2000,   // ₹ per hour for duration-based banquet venue cost
  tableChargePerPersonHour: 150,  // ₹ per guest for the first hour of dining (300 for 2)
  tableChargePerPersonHalfHour: 75, // ₹ per guest for each started half-hour after the 1st hr
  tableMinGuests: 2,              // minimum guests billed on an occupied table
  tablePackingCharge: 15,         // ₹ flat charge to pack leftover food
});

// Operations — module workflow defaults (housekeeping, payroll, accounting).
export const OPERATIONS_DEFAULTS = Object.freeze({
  housekeeping: Object.freeze({
    defaultTaskType: 'Regular Cleaning',   // task type for newly created tasks
    defaultPriority: 'Medium',             // priority for manually created tasks
    checkoutCleaningPriority: 'High',      // priority for auto checkout-cleaning tasks
    autoCreateOnCheckout: true,            // raise a cleaning task when a guest checks out
  }),
  payroll: Object.freeze({
    defaultSalary: 25000,                  // ₹ fallback salary when a staff record has none
    minWalletRecharge: 10,                 // ₹ minimum staff wallet recharge amount
  }),
  accounting: Object.freeze({
    defaultAccountType: 'savings',         // type pre-selected for a new account
    defaultPaymentMethod: 'cash',          // method pre-selected for a new transaction
  }),
});

// Convenience flat list of the GST-bearing billing keys, used by callers that
// just need a percentage → fraction conversion without re-deriving it.
export const pctToFraction = (pct) => (Number(pct) || 0) / 100;
