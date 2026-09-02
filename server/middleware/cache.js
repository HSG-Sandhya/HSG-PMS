/**
 * Tiny in-memory response cache for read-only GET endpoints.
 *
 * The dashboard fires ~11 stat endpoints on every load and again every 30s on
 * auto-refresh. The underlying data (a small hotel's bookings/rooms/orders)
 * barely changes second-to-second, yet each request pays multiple ~150ms Atlas
 * round-trips. Caching each endpoint's JSON for a few seconds makes reloads and
 * the periodic refresh effectively instant, without touching the DB.
 *
 * Scope is deliberately minimal: process-local Map, GET + 200 only, short TTL.
 * It is NOT a correctness layer — it just absorbs bursts of identical reads.
 * Mutations can call clearCache() to drop entries immediately when fresh data
 * must show up.
 *
 * TENANCY: the store is one Map shared by every hotel served by this process,
 * so the key MUST identify the hotel. Keyed by URL alone, /api/dashboard/
 * revenue-summary is the same string for every hotel, and the first one to ask
 * would have its revenue, occupancy and guest activity served to the next hotel
 * that asked within the TTL — defeating the database-level isolation entirely.
 * The tenant prefix is applied here rather than inside keyFn so that a caller
 * supplying a custom key cannot opt out of it.
 */

import { getCurrentTenant } from '../db/tenantContext.js';

// Outside a request there is no tenant context; that is the base database, which
// is exactly what getCurrentTenant() falls back to. The try/catch covers
// TENANCY_STRICT, where an unscoped call throws rather than defaulting.
const tenantSlug = () => {
  try {
    return getCurrentTenant()?.slug || 'base';
  } catch {
    return 'base';
  }
};

const store = new Map(); // 'tenant:key' -> { expires: number, status, body }

const scoped = (key) => `${tenantSlug()}:${key}`;

/**
 * @param {number} ttlMs  How long a cached response stays fresh.
 * @param {(req) => string} [keyFn]  Optional custom key (defaults to URL).
 */
export const cacheResponse = (ttlMs, keyFn) => (req, res, next) => {
  if (req.method !== 'GET') return next();

  const key = scoped(keyFn ? keyFn(req) : req.originalUrl);
  const hit = store.get(key);
  const now = Date.now();

  if (hit && hit.expires > now) {
    res.set('X-Cache', 'HIT');
    return res.status(hit.status).json(hit.body);
  }

  // Wrap res.json so the first (cache-miss) response populates the cache.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful reads; never cache errors or timeout 503s.
    if (res.statusCode === 200 && !req.timedout) {
      store.set(key, { expires: Date.now() + ttlMs, status: 200, body });
    }
    res.set('X-Cache', 'MISS');
    return originalJson(body);
  };

  next();
};

/**
 * Drop cached entries for the CURRENT tenant. With no match, clears all of that
 * hotel's entries; with a string, only keys containing it (e.g. 'dashboard').
 * One hotel's mutation must not flush another's cache, so the sweep is scoped
 * by default; pass { allTenants: true } for a genuine process-wide flush.
 */
export const clearCache = (match, { allTenants = false } = {}) => {
  if (allTenants && !match) return store.clear();

  const prefix = allTenants ? null : `${tenantSlug()}:`;
  for (const key of store.keys()) {
    if (prefix && !key.startsWith(prefix)) continue;
    if (match && !key.includes(match)) continue;
    store.delete(key);
  }
};

/** Entry count — for tests and diagnostics. */
export const cacheSize = () => store.size;

export default cacheResponse;
