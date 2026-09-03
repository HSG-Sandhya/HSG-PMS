// ── Tenant resolution ────────────────────────────────────────────────────────
//
// Maps the request's host to a hotel, then runs the rest of the request inside
// that hotel's tenant context (so every downstream query hits its database).
//
// Resolution order, and it matters:
//
//   1. exact custom domain      hotelabc.com          → the hotel that owns it
//   2. platform subdomain       taj.example.com       → the tenant registry
//   3. the platform's own hosts example.com, admin.*  → base connection
//   4. anything else                                  → rejected
//
// It used to run 1 and 2 in the opposite order, with a short-circuit in front:
// parseSubdomain() was called first and ANY host without a subdomain returned
// the base tenant immediately. The custom-domain lookup sat below that line and
// was unreachable for an apex domain. So a hotel that registered hotelabc.com
// got the operator's own database instead of its own — and www.hotelabc.com did
// too, because "www" is a reserved subdomain and took the same early exit.
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

// Is this host under a domain the platform itself serves?
//
// Without BASE_DOMAINS we cannot tell our own domain from anybody else's, so
// this answers yes — which is the permissive behaviour the existing
// single-tenant deployment depends on. Set BASE_DOMAINS in production to make
// it strict.
const onPlatformDomain = (host) =>
  !BASE_DOMAINS.length || BASE_DOMAINS.some((d) => host === d || host.endsWith("." + d));

// The hosts to try as a registered custom domain.
//
//   hotelabc.com        → [hotelabc.com]
//   www.hotelabc.com    → [www.hotelabc.com, hotelabc.com]
//   admin.hotelabc.com  → [admin.hotelabc.com, hotelabc.com]
//
// A hotel registers its domain once; it should not also have to register every
// platform-standard prefix in front of it. Only RESERVED labels are folded
// away, so booking.hotelabc.com stays a distinct host a hotel could register
// separately.
const customDomainCandidates = (host) => {
  const dot = host.indexOf(".");
  const label = dot > 0 ? host.slice(0, dot) : null;
  return label && RESERVED.has(label) ? [host, host.slice(dot + 1)] : [host];
};

// host → { record, expires }. Negative results (null record) are cached too.
const cache = new Map();

const lookupTenant = async (host) => {
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.expires > now) return hit.record;

  const Tenant = getTenantModel();

  // 1. Custom domain, exact — before any subdomain parsing, which is the whole
  //    point: an apex domain has no subdomain to parse.
  let record = await Tenant.findOne({
    customDomain: { $in: customDomainCandidates(host) },
  }).lean();

  // 2. A platform subdomain, and only on a platform domain. These used to be
  //    one query joined by $or, which meant a host on SOMEONE ELSE'S domain
  //    could match a tenant purely because its first label happened to equal
  //    that tenant's subdomain — point taj.anything.com at this server and you
  //    reached the tenant "taj". Separating them, and requiring the host to be
  //    under our own domain, closes that.
  if (!record && onPlatformDomain(host)) {
    const subdomain = parseSubdomain(host);
    if (subdomain && !RESERVED.has(subdomain)) {
      record = await Tenant.findOne({ subdomain }).lean();
    }
  }

  cache.set(host, { record: record || null, expires: now + TTL_MS });
  return record || null;
};

// The platform's own hosts: the apex it is served on, its reserved prefixes,
// and local/IP addresses in development.
const isPlatformHost = (host) => {
  if (!host || isIpOrLocal(host)) return true;
  if (!onPlatformDomain(host)) return false;
  const subdomain = parseSubdomain(host);
  return !subdomain || RESERVED.has(subdomain);
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

  // 1 + 2. The registry: custom domain first, then a platform subdomain.
  //
  // Every host now consults the registry, including the operator's own — an
  // apex custom domain has no subdomain to tell them apart by, which is exactly
  // why this was broken. Results are cached per host, so the cost is one query
  // per host per TTL, not one per request.
  //
  // If the control plane is unreachable, a platform host still has an answer
  // that needs no registry, and giving it keeps the operator's own site serving
  // instead of turning a control-database hiccup into a total outage. A tenant
  // host genuinely cannot be resolved, so it is refused rather than guessed at.
  let record;
  try {
    record = await lookupTenant(host);
  } catch (err) {
    logger.error("Tenant registry lookup failed", { host, error: err.message });
    return isPlatformHost(host) ? { tenant: BASE_TENANT } : { error: "unknown" };
  }

  if (record) {
    if (record.status !== "active") {
      return { error: record.status === "suspended" ? "suspended" : "provisioning" };
    }
    return { tenant: record };
  }

  // 3. The platform's own hosts → the operator's database (unchanged
  //    single-tenant behaviour, and how the original deployment keeps working).
  if (isPlatformHost(host)) return { tenant: BASE_TENANT };

  // 4. A host that looks like a hotel's address but matches no active hotel.
  //    Never fall back to another hotel's data.
  return { error: "unknown" };
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
