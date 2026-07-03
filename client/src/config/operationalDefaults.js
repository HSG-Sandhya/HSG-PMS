// ───────────────────────────────────────────────────────────────────────────
// Operational defaults (client mirror) — the single place these literals live
// on the front-end. SettingsContext seeds `defaultSettings` from here and the
// billing/operations helpers fall back to these when the server hasn't sent a
// value yet. Keep in lock-step with server/config/operationalDefaults.js.
//
// Values preserve the app's original hardcoded behaviour exactly.
// ───────────────────────────────────────────────────────────────────────────

// Billing & Tariff — money, tax, invoice numbering, currency.
export const BILLING_DEFAULTS = {
  roomGstRate: 5,                 // % GST applied to room tariff (subtotal)
  posGstRate: 5,                  // % GST applied to restaurant / POS orders
  breakfastChargePerNight: 200,   // ₹ added per night when tariff includes breakfast
  defaultCheckInTime: '12:00',    // HH:mm used when a booking omits a check-in time
  defaultCheckOutTime: '11:00',   // HH:mm used when a booking omits a check-out time
  invoicePrefix: 'HSG',           // leading token on every generated invoice number
  currencyCode: 'INR',            // ISO currency code
  currencySymbol: '₹',            // symbol rendered in front of amounts app-wide
  maxDiscountPercent: 100,        // upper clamp on a booking discount percentage
  roundAmounts: true,             // round computed money values to whole units
  banquetVenueHourlyRate: 2000,   // ₹ per hour for duration-based banquet venue cost
  tableChargePerPersonHour: 150,  // ₹ per guest for the first hour of dining (300 for 2)
  tableChargePerPersonHalfHour: 75, // ₹ per guest for each started half-hour after the 1st hr
  tableMinGuests: 2,              // minimum guests billed on an occupied table
  tablePackingCharge: 15,         // ₹ flat charge to pack leftover food
};

// Operations — module workflow defaults (housekeeping, payroll, accounting).
export const OPERATIONS_DEFAULTS = {
  housekeeping: {
    defaultTaskType: 'Regular Cleaning',
    defaultPriority: 'Medium',
    checkoutCleaningPriority: 'High',
    autoCreateOnCheckout: true,
  },
  payroll: {
    defaultSalary: 25000,
    minWalletRecharge: 10,
  },
  accounting: {
    defaultAccountType: 'savings',
    defaultPaymentMethod: 'cash',
  },
};
