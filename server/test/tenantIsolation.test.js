import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { runWithTenant, BASE_TENANT } from '../db/tenantContext.js';
import { cacheResponse, clearCache, cacheSize } from '../middleware/cache.js';

// One Node process serves every hotel, so any module-level Map is shared by all
// of them. Keyed by URL alone, /api/dashboard/revenue-summary is the SAME string
// for every hotel: the first to ask would have its revenue, occupancy and guest
// activity handed to the next hotel that asked inside the 15s TTL, defeating the
// database-per-hotel isolation. These tests pin the tenant to the cache key.

// No database in unit tests. Without this, a model read would sit in Mongoose's
// buffer for the full 10s timeout; failing fast lets the settings loader take its
// documented "DB hiccup → defaults" path immediately.
mongoose.set('bufferCommands', false);

const HOTEL_A = { slug: 'hotel-a', name: 'A', dbName: 'a' };
const HOTEL_B = { slug: 'hotel-b', name: 'B', dbName: 'b' };

// Minimal req/res doubles: enough for the middleware's GET / 200 / json path.
const call = (mw, url, body) =>
  new Promise((resolve) => {
    const req = { method: 'GET', originalUrl: url };
    const res = {
      statusCode: 200,
      headers: {},
      set(k, v) { this.headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(payload) { resolve({ payload, cache: this.headers['X-Cache'] }); return this; },
    };
    mw(req, res, () => res.json(body)); // next() → the "controller" answers
  });

test('one hotel never serves another hotel a cached dashboard', async () => {
  clearCache(undefined, { allTenants: true });
  const cache = cacheResponse(15_000);
  const url = '/api/dashboard/revenue-summary';

  const a = await runWithTenant({ tenant: HOTEL_A }, () => call(cache, url, { revenue: 111 }));
  assert.equal(a.cache, 'MISS');

  // Hotel B asks for the identical URL while A's entry is still fresh.
  const b = await runWithTenant({ tenant: HOTEL_B }, () => call(cache, url, { revenue: 222 }));
  assert.equal(b.cache, 'MISS', 'B must not hit A entry');
  assert.equal(b.payload.revenue, 222, "B got another hotel's revenue");

  // Each still caches for itself.
  const a2 = await runWithTenant({ tenant: HOTEL_A }, () => call(cache, url, { revenue: 999 }));
  assert.equal(a2.cache, 'HIT');
  assert.equal(a2.payload.revenue, 111);
});

test('a custom keyFn cannot opt out of tenant scoping', async () => {
  clearCache(undefined, { allTenants: true });
  const cache = cacheResponse(15_000, () => 'fixed-key');

  const a = await runWithTenant({ tenant: HOTEL_A }, () => call(cache, '/x', { v: 'A' }));
  const b = await runWithTenant({ tenant: HOTEL_B }, () => call(cache, '/x', { v: 'B' }));

  assert.equal(a.payload.v, 'A');
  assert.equal(b.payload.v, 'B');
  assert.equal(b.cache, 'MISS');
});

test('clearing one hotel cache leaves the others intact', async () => {
  clearCache(undefined, { allTenants: true });
  const cache = cacheResponse(15_000);
  const url = '/api/dashboard/summary';

  await runWithTenant({ tenant: HOTEL_A }, () => call(cache, url, { v: 'A' }));
  await runWithTenant({ tenant: HOTEL_B }, () => call(cache, url, { v: 'B' }));
  assert.equal(cacheSize(), 2);

  await runWithTenant({ tenant: HOTEL_A }, () => clearCache('dashboard'));
  assert.equal(cacheSize(), 1, "A's flush must not drop B's entry");

  const b = await runWithTenant({ tenant: HOTEL_B }, () => call(cache, url, { v: 'B2' }));
  assert.equal(b.cache, 'HIT');
  assert.equal(b.payload.v, 'B');
});

test('outside a request the key falls back to the base hotel', async () => {
  clearCache(undefined, { allTenants: true });
  const cache = cacheResponse(15_000);

  const first = await call(cache, '/api/dashboard/', { v: 1 });          // no context
  const again = await runWithTenant({ tenant: BASE_TENANT }, () =>       // base context
    call(cache, '/api/dashboard/', { v: 2 }));

  assert.equal(first.cache, 'MISS');
  assert.equal(again.cache, 'HIT', 'no-context and base must be the same scope');
});

test('a non-GET request is never cached', async () => {
  clearCache(undefined, { allTenants: true });
  const cache = cacheResponse(15_000);
  await new Promise((resolve) => cache({ method: 'POST', originalUrl: '/x' }, {}, resolve));
  assert.equal(cacheSize(), 0);
});

// ── Settings cache ───────────────────────────────────────────────────────────
// Worse than a stale dashboard: these values (GST rates, invoice prefix,
// currency, discount ceiling) are written INTO saved bookings and invoices, so
// serving one hotel's billing config to another leaves permanent wrong records.

test('each hotel gets its own settings cache entry', async () => {
  const { getBilling, invalidateOperationalConfig, configCacheSize } =
    await import('../config/operationalConfig.js');

  invalidateOperationalConfig({ allTenants: true });
  assert.equal(configCacheSize(), 0);

  await runWithTenant({ tenant: HOTEL_A }, () => getBilling());
  await runWithTenant({ tenant: HOTEL_B }, () => getBilling());
  assert.equal(configCacheSize(), 2, 'a shared slot would leave this at 1');

  // Saving settings at one hotel must not flush the other's.
  await runWithTenant({ tenant: HOTEL_A }, () => invalidateOperationalConfig());
  assert.equal(configCacheSize(), 1);
});

// ── Session revocation ───────────────────────────────────────────────────────

test('a revocation applies only to the hotel that issued it', async () => {
  const { revokeUserTokens, isTokenRevoked } = await import('../utils/tokenRevocation.js');
  const FakeUser = { updateOne: async () => ({ acknowledged: true }) };

  const userId = '000000000000000000000001'; // same id shape in both databases
  const token = { id: userId, iat: Math.floor(Date.now() / 1000) - 60 };

  await runWithTenant({ tenant: HOTEL_A }, () => revokeUserTokens(FakeUser, userId));

  assert.equal(
    await runWithTenant({ tenant: HOTEL_A }, () => isTokenRevoked(token)), true);
  assert.equal(
    await runWithTenant({ tenant: HOTEL_B }, () => isTokenRevoked(token)), false,
    "one hotel's logout must not end another hotel's session");
});
