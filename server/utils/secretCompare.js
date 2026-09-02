import crypto from 'node:crypto';

/**
 * Compare two secrets without leaking, through timing, how much of a guess was
 * correct.
 *
 * A plain `a === b` on strings short-circuits at the first differing byte, so
 * the time it takes reveals the length of the matching prefix -- enough to
 * recover a token byte by byte given enough attempts. crypto.timingSafeEqual
 * always reads both buffers in full.
 *
 * It throws on a length mismatch, so lengths are checked first. That discloses
 * only the secret's length, which for a fixed-format token is public anyway.
 */
export const secretsMatch = (supplied, stored) => {
  if (typeof supplied !== 'string' || typeof stored !== 'string') return false;
  if (!supplied || !stored) return false;
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export default secretsMatch;
