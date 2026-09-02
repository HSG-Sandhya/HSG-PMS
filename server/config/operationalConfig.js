// ───────────────────────────────────────────────────────────────────────────
// Runtime accessor for the operational config. Controllers call getBilling() /
// getOps() instead of hardcoding rates, prefixes or default times. The resolved
// value layers the saved Settings document over the defaults module, so an unset
// field always falls back to the canonical default and never to a stray literal.
//
// A short TTL cache keeps the booking/POS hot paths from re-querying Settings on
// every request; invalidateOperationalConfig() is called from the settings
// update controller so admin edits take effect immediately.
// ───────────────────────────────────────────────────────────────────────────
import Settings from '../models/Settings.js';
import { getCurrentTenant } from '../db/tenantContext.js';
import {
  BILLING_DEFAULTS,
  OPERATIONS_DEFAULTS,
  pctToFraction,
} from './operationalDefaults.js';

const TTL_MS = 15000;

// TENANCY: one entry per hotel. A single shared slot meant the first hotel to
// read settings supplied its GST rates, invoice prefix, currency and discount
// ceiling to every other hotel for the next 15 seconds — and unlike a stale
// dashboard number, those values are written into saved bookings and invoices,
// so the damage outlives the cache. Keyed by tenant slug; the map is bounded by
// the number of hotels served (one database each), so it cannot grow unbounded.
const cache = new Map(); // tenantSlug -> { value: { billing, operations }, at: number }

const tenantSlug = () => {
  try {
    return getCurrentTenant()?.slug || 'base';
  } catch {
    return 'base';
  }
};

// Deep-ish merge: spread defaults, then the saved section over them. Operations
// has one level of nesting (housekeeping/payroll/accounting) so we merge those
// sub-objects individually; billing is flat.
const mergeBilling = (saved = {}) => ({ ...BILLING_DEFAULTS, ...saved });
const mergeOps = (saved = {}) => ({
  housekeeping: { ...OPERATIONS_DEFAULTS.housekeeping, ...(saved.housekeeping || {}) },
  payroll: { ...OPERATIONS_DEFAULTS.payroll, ...(saved.payroll || {}) },
  accounting: { ...OPERATIONS_DEFAULTS.accounting, ...(saved.accounting || {}) },
  banquet: { ...OPERATIONS_DEFAULTS.banquet, ...(saved.banquet || {}) },
  frontDesk: { ...OPERATIONS_DEFAULTS.frontDesk, ...(saved.frontDesk || {}) },
});

async function load() {
  const slug = tenantSlug();
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let doc = null;
  try {
    // Lean read — we only need the two plain sub-objects. Settings resolves
    // against the current tenant's connection, so this is that hotel's document.
    doc = await Settings.findOne({}, { billing: 1, operations: 1 }).lean();
  } catch {
    doc = null; // DB hiccup → fall back entirely to defaults below
  }

  const value = {
    billing: mergeBilling(doc?.billing),
    operations: mergeOps(doc?.operations),
  };
  cache.set(slug, { value, at: Date.now() });
  return value;
}

export async function getBilling() {
  return (await load()).billing;
}

export async function getOps() {
  return (await load()).operations;
}

// Drop the cache so the next read reflects a just-saved Settings change. A
// settings save belongs to one hotel, so only that hotel's entry is dropped;
// pass { allTenants: true } for a process-wide flush (tests, maintenance).
export function invalidateOperationalConfig({ allTenants = false } = {}) {
  if (allTenants) cache.clear();
  else cache.delete(tenantSlug());
}

/** Number of hotels currently cached — for tests and diagnostics. */
export function configCacheSize() {
  return cache.size;
}

// ── Pure helpers (no I/O) — take a resolved billing config ──────────────────

// GST amount on a base figure using the room rate (rounded per roundAmounts).
export function roomGst(base, billing = BILLING_DEFAULTS) {
  const amt = (Number(base) || 0) * pctToFraction(billing.roomGstRate);
  return billing.roundAmounts ? Math.round(amt) : amt;
}

// GST amount on a base figure using the POS rate.
export function posGst(base, billing = BILLING_DEFAULTS) {
  const amt = (Number(base) || 0) * pctToFraction(billing.posGstRate);
  return billing.roundAmounts ? Math.round(amt) : amt;
}

// Prefix an invoice sequence/body, e.g. addInvoicePrefix('1001') → 'HSG-1001'.
export function addInvoicePrefix(body, billing = BILLING_DEFAULTS) {
  return `${billing.invoicePrefix}-${body}`;
}

export { BILLING_DEFAULTS, OPERATIONS_DEFAULTS };
