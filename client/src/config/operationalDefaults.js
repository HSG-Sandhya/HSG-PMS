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
    requireInspection: false,        // completed cleaning must be inspected before "Clean"
    expectedCleaningMinutes: 30,     // ETA stamped on auto-created cleaning tasks
  },
  payroll: {
    defaultSalary: 25000,
    minWalletRecharge: 10,
    payDay: 1,                       // day-of-month the monthly salary is paid
    overtimeMultiplier: 1.5,         // × hourly rate for overtime hours
  },
  accounting: {
    defaultAccountType: 'savings',
    defaultPaymentMethod: 'cash',
    autoPostIncome: true,            // auto-post income/expense to the ledger
    financialYearStartMonth: 4,      // 1–12; India FY starts April
  },
  banquet: {
    advancePercent: 50,              // % of total to confirm a banquet booking
    quotationValidityDays: 15,       // how long a quotation stays valid
    defaultEventHours: 4,            // pre-fill for a new event's duration
    minAdvanceAmount: 0,             // ₹ floor on the advance to confirm
  },
  frontDesk: {
    requireIdProof: false,           // block booking without an ID document
    allowOverbooking: false,         // permit booking a room that's already occupied
    holdExpiryHours: 24,             // tentative/hold auto-release window
    lateCheckoutGraceMinutes: 120,   // grace after checkout time before a late fee
    lateCheckoutFullDayAfter: '18:00', // checkout past this time = full night (else ½ night)
  },
};
