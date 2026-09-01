import logger from '../config/logger.js';

/**
 * Session revocation for stateless JWTs.
 *
 * A signed JWT cannot be withdrawn once issued, so logging out by deleting the
 * browser's copy left the token itself working until it expired — up to 30 days
 * for anyone who had copied it. This records a per-user cut-off instant instead:
 * a token whose `iat` predates the user's watermark is refused.
 *
 * The hot path costs ZERO database reads. Only users who have actually revoked
 * appear in the map, it is primed once at boot, and every later revocation goes
 * through this module, so a cache miss genuinely means "never revoked". That
 * matters on a shared-tier Atlas cluster where a per-request lookup would be a
 * real cost.
 *
 * Single-process only, which matches deploy/ecosystem.config.cjs (`instances: 1`,
 * in-memory Socket.IO adapter, in-process schedulers). If the API is ever moved
 * to cluster mode, this map must move to Redis alongside the socket adapter, or
 * a logout will only bind on the worker that served it.
 */

// userId -> epoch SECONDS. Seconds, not ms, because a JWT's `iat` is in seconds:
// comparing against a millisecond watermark would revoke a token minted in the
// same second as the logout, which is exactly the token a fresh re-login holds.
const watermarks = new Map();

let primed = false;

/** True when this token was issued before its owner's revocation cut-off. */
export const isTokenRevoked = (decoded) => {
  if (!decoded) return false;
  const userId = String(decoded.id || decoded.userId || '');
  if (!userId) return false;

  const cutoff = watermarks.get(userId);
  if (!cutoff) return false;

  // No `iat` means we cannot place the token relative to the cut-off. Fail
  // closed: a revoked user's token without a timestamp is treated as revoked.
  if (typeof decoded.iat !== 'number') return true;

  return decoded.iat < cutoff;
};

/** Record the cut-off locally. Exported for the boot-time prime. */
const remember = (userId, when) => {
  watermarks.set(String(userId), Math.floor(new Date(when).getTime() / 1000));
};

/**
 * End every existing session for one user. Persists the watermark so it
 * survives a restart, then applies it in-process immediately.
 */
export const revokeUserTokens = async (User, userId) => {
  if (!userId) return null;
  const now = new Date();
  await User.updateOne({ _id: userId }, { $set: { tokenValidFrom: now } });
  remember(userId, now);
  return now;
};

/** End every existing session for every user. */
export const revokeAllTokens = async (User) => {
  const now = new Date();
  const result = await User.updateMany({}, { $set: { tokenValidFrom: now } });
  const ids = await User.find({}).select('_id').lean();
  for (const u of ids) remember(u._id, now);
  return { at: now, users: result.modifiedCount ?? ids.length };
};

/**
 * Load existing watermarks at startup so revocations outlive a restart.
 * Only users that have ever revoked are stored, so this is a small read.
 */
export const primeRevocations = async (User) => {
  try {
    const rows = await User.find({ tokenValidFrom: { $ne: null } })
      .select('_id tokenValidFrom')
      .lean();
    watermarks.clear();
    for (const r of rows) remember(r._id, r.tokenValidFrom);
    primed = true;
    logger.info(`Token revocation list primed (${rows.length} user(s) with revoked sessions)`);
  } catch (error) {
    // Never block startup: an unprimed list fails OPEN (tokens keep working),
    // which is the pre-existing behaviour rather than a new outage.
    logger.warn('Could not prime token revocation list', { error: error.message });
  }
};

export const revocationStats = () => ({ primed, users: watermarks.size });
