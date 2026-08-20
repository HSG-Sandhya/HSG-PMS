import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration for optional staff login credentials.
 *
 * Staff below role hierarchy 6 are now personnel records: tracked for
 * attendance and payroll, with no username or password. Two things in the
 * existing database block that and must be fixed before the feature works.
 *
 * 1. THE USERNAME INDEX. It was created as a plain `unique` index back when
 *    every user had a username. A credential-less record stores no username at
 *    all, and a non-sparse unique index treats every missing field as the same
 *    `null` — so the FIRST such staff member saves fine and the SECOND fails
 *    with E11000. Mongoose creates missing indexes automatically but never
 *    alters an existing one, so this has to be done explicitly: drop it and
 *    recreate it as `{ unique: true, sparse: true }`.
 *
 * 2. EXISTING USERS have no `hasLoginAccess` field. They all currently hold
 *    credentials and are actively logging in, so they are backfilled to `true`.
 *    Nobody is locked out by this migration — the new rule applies to staff
 *    created from here on, and to anyone whose role is deliberately changed.
 *
 * Safe to run more than once.
 *
 *   node scripts/migrate-optional-staff-credentials.js          # apply
 *   node scripts/migrate-optional-staff-credentials.js --dry-run # report only
 */

const DRY_RUN = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`✅ Connected${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`);

  const users = mongoose.connection.db.collection('users');

  // ── 1. username index ────────────────────────────────────────────────────
  const indexes = await users.indexes();
  const usernameIdx = indexes.find(
    (i) => i.key && Object.keys(i.key).length === 1 && i.key.username === 1,
  );

  console.log('username index:', usernameIdx
    ? `${usernameIdx.name} unique=${!!usernameIdx.unique} sparse=${!!usernameIdx.sparse}`
    : '(none)');

  if (usernameIdx && usernameIdx.unique && usernameIdx.sparse) {
    console.log('   → already sparse+unique, nothing to do');
  } else if (DRY_RUN) {
    console.log('   → WOULD drop and recreate as { unique: true, sparse: true }');
  } else {
    if (usernameIdx) {
      await users.dropIndex(usernameIdx.name);
      console.log(`   → dropped ${usernameIdx.name}`);
    }
    await users.createIndex({ username: 1 }, { unique: true, sparse: true, name: 'username_1' });
    console.log('   → recreated as { unique: true, sparse: true }');
  }

  // ── 2. backfill hasLoginAccess ───────────────────────────────────────────
  const missing = await users.countDocuments({ hasLoginAccess: { $exists: false } });
  console.log(`\nusers without hasLoginAccess: ${missing}`);

  if (missing === 0) {
    console.log('   → nothing to backfill');
  } else if (DRY_RUN) {
    console.log(`   → WOULD set hasLoginAccess=true on ${missing} existing user(s)`);
  } else {
    const res = await users.updateMany(
      { hasLoginAccess: { $exists: false } },
      { $set: { hasLoginAccess: true } },
    );
    console.log(`   → set hasLoginAccess=true on ${res.modifiedCount} user(s)`);
  }

  // ── Report: who the new default WOULD affect, for visibility only ────────
  // Nothing here is changed. Existing staff keep the login they have; this is
  // just so whoever runs the migration can see which roles now sit below the
  // threshold and may want an explicit override (front desk being the usual
  // case, since they are level 5 but need to sign in for check-in).
  const roles = await mongoose.connection.db.collection('roles')
    .find({}, { projection: { name: 1, hierarchy: 1, userAccountSettings: 1 } })
    .sort({ hierarchy: -1 })
    .toArray();

  console.log('\nROLE LOGIN RULE (level 6+ signs in by default):');
  for (const r of roles) {
    const explicit = r.userAccountSettings?.canHaveUserAccount;
    const allows = typeof explicit === 'boolean' ? explicit : (r.hierarchy || 1) >= 6;
    const how = typeof explicit === 'boolean' ? 'override' : 'by level';
    console.log(`  L${String(r.hierarchy ?? '?').padStart(2)} ${(r.name || '').padEnd(32)} login=${allows ? 'YES' : 'no '} (${how})`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
};

run().catch(async (err) => {
  console.error('❌ Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
