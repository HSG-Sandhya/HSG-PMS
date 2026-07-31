// ── Tenant resolution ────────────────────────────────────────────────────────
//
// Maps the request's host to a hotel, then runs the rest of the request inside
// that hotel's tenant context (so every downstream query hits its database).
//
//   taj.example.com      → subdomain "taj"      → look up in the tenant registry
//   admin.example.com    → reserved subdomain   → base connection (platform host)
//   example.com          → apex / no subdomain  → base connection
//   admin.sandhyagrand.in→ reserved subdomain   → base connection (existing site)
//
// A registry lookup is cached per-host for TENANT_CACHE_TTL_MS so we don't hit
// the control database on every request (Atlas shared tiers throttle bursts).
//
// If a real subdomain doesn't match any registered/active hotel, the request is
// rejected — we never silently fall back to another hotel's data. Only base /
// reserved / apex hosts use the base connection.

import { getTenantModel } from "../models/control/Tenant.js";
import { getConnectionForTenant } from "../db/tenantConnection.js";
import { runWithTenant, BASE_TENANT } from "../db/tenantContext.js";
import logger from "../config/logger.js";

const TTL_MS = parseInt(process.env.TENANT_CACHE_TTL_MS, 10) || 60_000;

// Subdomains that are never a hotel — the platform's own hosts.
const RESERVED = new Set(
  (process.env.RESERVED_SUBDOMAINS || "www,api,admin,app,static,assets,cdn,mail")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Apex domains the platform is served on. Anything ending in one of these has
// its leading labels treated as the subdomain. Optional: when unset we fall back
// to a "3+ labels ⇒ first label is the subdomain" heuristic, which is correct
// for simple domains (taj.example.com) but not multi-part TLDs (a.co.uk) — set
// BASE_DOMAINS in production to be explicit.
const BASE_DOMAINS = (process.env.BASE_DOMAINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
  .filter(Boolean);

const isIpOrLocal = (host) =>
  host === "localhost" ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
  host.includes(":"); // bare IPv6 / has port already stripped otherwise

// Extract the tenant subdomain from a hostname, or null for a base/apex host.
export const parseSubdomain = (rawHost) => {
  const host = String(rawHost || "").toLowerCase().split(":")[0].trim();
  if (!host || isIpOrLocal(host)) return null;

  if (BASE_DOMAINS.length) {
    const base = BASE_DOMAINS.find(
      (d) => host === d || host.endsWith("." + d)
    );
    if (!base || host === base) return null;
    const label = host.slice(0, host.length - base.length - 1); // strip ".base"
    return label.split(".")[0] || null; // first label of any nested subdomain
  }

  // Heuristic fallback: treat the first label as a subdomain when there are 3+.
  const labels = host.split(".");
  return labels.length >= 3 ? labels[0] : null;
};

// host → { record, expires }. Negative results (null record) are cached too.
const cache = new Map();

const lookupTenant = async (host, subdomain) => {
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expires > now) return hit.record;

  const Tenant = getTenantModel();
  const record = await Tenant.findOne({
    $or: [{ customDomain: host }, ...(subdomain ? [{ subdomain }] : [])],
  }).lean();

  cache.set(host, { record: record || null, expires: now + TTL_MS });
  return record || null;
};

// Drop cached lookups (call after provisioning / status changes).
export const clearTenantCache = (host) => {
  if (host) cache.delete(String(host).toLowerCase().split(":")[0]);
  else cache.clear();
};

// Resolve a host to a tenant WITHOUT any Express/HTTP coupling, so the socket
// layer can reuse the exact same rules. Returns either { tenant } (BASE_TENANT
// for base/reserved/apex hosts) or { error: "unknown"|"suspended"|"provisioning" }.
export const resolveTenantForHost = async (rawHost) => {
  const host = String(rawHost || "").toLowerCase().split(":")[0];
  const subdomain = parseSubdomain(host);

  // Base / reserved / apex host → the operator's own database (unchanged
  // single-tenant behaviour, and how the original deployment keeps working).
  if (!subdomain || RESERVED.has(subdomain)) return { tenant: BASE_TENANT };

  const record = await lookupTenant(host, subdomain);
  if (!record) return { error: "unknown" };
  if (record.status !== "active") {
    return { error: record.status === "suspended" ? "suspended" : "provisioning" };
  }
  return { tenant: record };
};

export const resolveTenant = async (req, res, next) => {
  try {
    const result = await resolveTenantForHost(req.hostname);

    if (result.error) {
      const status = result.error === "unknown" ? 404 : 403;
      const message =
        result.error === "suspended"
          ? "This hotel account is suspended. Contact support."
          : result.error === "provisioning"
            ? "This hotel is being set up. Please try again shortly."
            : "Unknown hotel. Check the address and try again.";
      return res.status(status).json({ success: false, message });
    }

    // getConnectionForTenant handles BASE_TENANT (null dbName → base connection)
    // and ensures every model is compiled on the connection.
    const conn = getConnectionForTenant(result.tenant);
    return runWithTenant({ tenant: result.tenant, conn }, () => next());
  } catch (err) {
    logger.error("Tenant resolution failed", { error: err.message, host: req.hostname });
    return next(err);
  }
};

export default resolveTenant;
