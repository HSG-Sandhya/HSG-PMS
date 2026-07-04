/**
 * Tiny in-memory response cache for read-only GET endpoints.
 *
 * The dashboard fires ~11 stat endpoints on every load and again every 30s on
 * auto-refresh. The underlying data (a small hotel's bookings/rooms/orders)
 * barely changes second-to-second, yet each request pays multiple ~150ms Atlas
 * round-trips. Caching each endpoint's JSON for a few seconds makes reloads and
 * the periodic refresh effectively instant, without touching the DB.
 *
 * Scope is deliberately minimal: process-local Map, GET + 200 only, keyed by
 * URL (query string included). It is NOT a correctness layer — a short TTL just
 * absorbs bursts of identical reads. Mutations can call clearCache() to drop
 * entries immediately when fresh data must show up.
 */

const store = new Map(); // key -> { expires: number, status, body }

/**
 * @param {number} ttlMs  How long a cached response stays fresh.
 * @param {(req) => string} [keyFn]  Optional custom key (defaults to URL).
 */
export const cacheResponse = (ttlMs, keyFn) => (req, res, next) => {
  if (req.method !== 'GET') return next();

  const key = keyFn ? keyFn(req) : req.originalUrl;
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
 * Drop cached entries. With no argument, clears everything; with a string,
 * clears every key that includes that substring (e.g. 'dashboard').
 */
export const clearCache = (match) => {
  if (!match) return store.clear();
  for (const key of store.keys()) {
    if (key.includes(match)) store.delete(key);
  }
};

export default cacheResponse;
