/**
 * Give every existing booking a tracking token.
 *
 * The public status endpoint (GET /api/website/bookings/:ref/status) now
 * requires a per-booking token instead of accepting the ObjectId as its only
 * credential. New bookings get one from a schema default; rows created before
 * that change have none, so they answer 404 — safe, but untrackable.
 *
 * This fills them in. It writes only where the field is missing, so it is
 * idempotent and cannot rotate a token a guest already holds.
 *
 * Run:  node server/scripts/backfillTrackingTokens.js
 *       node server/scripts/backfillTrackingTokens.js --dry-run
 */
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  if (!MONGO_URI) {
    console.error('✖ MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`● database: ${db.databaseName}${DRY_RUN ? '  (dry run)' : ''}`);

  // The driver directly, not the model: trackingToken is select:false, and this
  // is a per-document value so there is nothing to batch into one update.
  const missing = await db.collection('bookings')
    .find({ $or: [{ trackingToken: { $exists: false } }, { trackingToken: null }, { trackingToken: '' }] })
    .project({ _id: 1, invoiceNumber: 1 })
    .toArray();

  console.log(`● bookings without a token: ${missing.length}`);
  if (!missing.length || DRY_RUN) {
    if (DRY_RUN && missing.length) {
      missing.forEach((b) => console.log(`    would fill ${b.invoiceNumber || b._id}`));
    }
    await mongoose.disconnect();
    return;
  }

  let filled = 0;
  for (const b of missing) {
    const token = crypto.randomBytes(16).toString('hex');
    const res = await db.collection('bookings').updateOne(
      // Re-assert the condition so a concurrent write cannot be overwritten.
      { _id: b._id, $or: [{ trackingToken: { $exists: false } }, { trackingToken: null }, { trackingToken: '' }] },
      { $set: { trackingToken: token } }
    );
    if (res.modifiedCount) filled += 1;
  }

  const remaining = await db.collection('bookings').countDocuments({ trackingToken: { $exists: false } });
  console.log(`✅ filled ${filled}; still missing: ${remaining}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('✖ backfill failed:', err.message);
  process.exit(1);
});
