import Counter from '../models/Counter.js';
import { getCurrentTenant } from '../db/tenantContext.js';

/**
 * Hand out the next number in a sequence, atomically.
 *
 * Every generator in this codebase used the same shape:
 *
 *     read the latest number  ->  add one  ->  check it is free  ->  return it
 *                                                                   ...save later
 *
 * Two requests arriving together both read 107, both decide on 108, and the
 * second to save hits E11000 and surfaces as a 500. At a reception desk that is
 * not hypothetical: two bookings or two restaurant orders genuinely land in the
 * same moment.
 *
 * A `$inc` is applied by the database, not by us, so concurrent callers are
 * serialised by the server and each gets a distinct value.
 *
 * `seed` is called only when a scope is used for the first time, to carry the
 * counter past numbers that already exist from before this mechanism. It is
 * applied with `$max`, so it can never drag a counter backwards even if two
 * processes seed at once.
 */

// Scopes already seeded in this process, so the common path is one write and no
// reads. Keyed by tenant: each hotel has its own counters.
const seededScopes = new Set();

const scopeCacheKey = (key) => {
  let slug = 'base';
  try { slug = getCurrentTenant()?.slug || 'base'; } catch { /* no request context */ }
  return `${slug}:${key}`;
};

export const nextSequence = async (key, { seed = null, start = 0 } = {}) => {
  const cacheKey = scopeCacheKey(key);

  if (!seededScopes.has(cacheKey)) {
    const existing = await Counter.findById(key).lean();
    if (!existing) {
      let seedValue = start;
      if (typeof seed === 'function') {
        try {
          const found = await seed();
          if (Number.isFinite(found)) seedValue = Math.max(seedValue, found);
        } catch (err) {
          // A failed seed must not block the desk; worst case the counter
          // starts low and the duplicate-key retry below covers it.
          console.error(`[sequence] seeding "${key}" failed:`, err.message);
        }
      }
      // $max never lowers an existing value, so a concurrent seed is harmless.
      await Counter.updateOne({ _id: key }, { $max: { seq: seedValue } }, { upsert: true });
    }
    seededScopes.add(cacheKey);
  }

  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
};

/** Forget the seeding cache. Tests and the scratch databases they run against. */
export const resetSequenceCache = () => seededScopes.clear();

/**
 * Run `attempt` again if the database rejects it as a duplicate key.
 *
 * The counter makes collisions vanishingly unlikely, but numbers created before
 * it existed -- or typed in by hand -- are outside its knowledge. Retrying turns
 * the one case it cannot predict into a second, correct number rather than a
 * 500 at the front desk.
 */
export const isDuplicateKeyError = (err) => err?.code === 11000;

export const withDuplicateRetry = async (attempt, retries = 3) => {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt(i);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
};

export default nextSequence;
