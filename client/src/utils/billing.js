// ───────────────────────────────────────────────────────────────────────────
// Billing helpers — pure functions that take a resolved billing config (the
// merged Settings → defaults object from useBilling()) and apply the configured
// rates/symbols. Components import these instead of writing `* 0.05`, `* 200`,
// `'₹'` etc. inline, so every money rule has exactly one definition.
// ───────────────────────────────────────────────────────────────────────────
import { BILLING_DEFAULTS } from '../config/operationalDefaults';

// Resolve a (possibly partial / undefined) billing object against the defaults
// so callers never crash on a missing field while settings are still loading.
export const resolveBilling = (billing) => ({ ...BILLING_DEFAULTS, ...(billing || {}) });

const round = (n, billing) => (billing.roundAmounts ? Math.round(n) : n);

// GST on a room subtotal using the configured room rate.
export const calcGst = (amount, billing) => {
  const b = resolveBilling(billing);
  return round((Number(amount) || 0) * (b.roomGstRate / 100), b);
};

// GST on a POS/restaurant subtotal using the configured POS rate.
export const calcPosGst = (amount, billing) => {
  const b = resolveBilling(billing);
  return round((Number(amount) || 0) * (b.posGstRate / 100), b);
};

// Breakfast charge for a stay: per-night rate × nights.
export const calcBreakfast = (nights, billing) => {
  const b = resolveBilling(billing);
  return round((Number(nights) || 0) * b.breakfastChargePerNight, b);
};

// Clamp a discount percentage to [0, maxDiscountPercent].
export const clampDiscount = (pct, billing) => {
  const b = resolveBilling(billing);
  return Math.min(b.maxDiscountPercent, Math.max(0, Number(pct) || 0));
};

export const defaultCheckInTime = (billing) => resolveBilling(billing).defaultCheckInTime;
export const defaultCheckOutTime = (billing) => resolveBilling(billing).defaultCheckOutTime;
export const currencySymbol = (billing) => resolveBilling(billing).currencySymbol;

// Format a number as a currency amount using the configured symbol.
// `fractionDigits` defaults to 0 (whole rupees) to match the app's existing style;
// pass 2 for paise-precise figures (e.g. accounting ledgers).
export const formatCurrency = (n, billing, fractionDigits = 0) => {
  const b = resolveBilling(billing);
  const value = (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${b.currencySymbol}${value}`;
};

// ── Live (module-level) billing config ──────────────────────────────────────
// SettingsContext pushes the resolved billing config here whenever settings
// load, so plain (non-React) code — print/invoice HTML builders, formatter
// utilities, and arrow components without a hook scope — can read the configured
// symbol and rates without access to a hook. This is the global source outside
// of components.
let _liveBilling = { ...BILLING_DEFAULTS };

export const setLiveBilling = (billing) => {
  _liveBilling = { ...BILLING_DEFAULTS, ...(billing || {}) };
};

// The whole resolved config, for callers that need rates as well as the symbol.
export const liveBilling = () => _liveBilling;

// The configured symbol (e.g. '₹'), for places that just need the glyph.
export const currencySym = () => _liveBilling.currencySymbol;

// Live GST fractions for POS / room, for plain code that recomputes GST.
export const livePosGstFraction = () => _liveBilling.posGstRate / 100;
export const liveRoomGstFraction = () => _liveBilling.roomGstRate / 100;

// Format money with the live configured symbol — usable anywhere.
export const money = (n, fractionDigits = 0) => {
  const value = (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${_liveBilling.currencySymbol}${value}`;
};
