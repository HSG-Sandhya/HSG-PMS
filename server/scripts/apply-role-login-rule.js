import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Make the "level 6 and above signs in" rule actually take effect.
 *
 * Role.allowsLogin() only falls back to the hierarchy rule when
 * `userAccountSettings.canHaveUserAccount` is UNSET. Every existing role
 * carries an explicit `true` — written by the old schema default, which stamped
 * it onto every role ever saved — so the rule never applies and junior roles
 * still get credentials.
 *
 * This clears that stale override on roles below the threshold, so they fall
 * back to the rule and stop issuing logins. Roles named in --keep are given an
 * explicit `true` instead: that is the deliberate exception (front desk sits at
 * level 5 but must sign in to check guests in).
 *
 * IMPORTANT — this changes NEW staff only. Existing users already carry
 * `hasLoginAccess: true` and keep the credentials they have; nobody is locked
 * out. Login is only revoked if someone's role is later changed to one that
 * doesn't sign in.
 *
 *   node scripts/apply-role-login-rule.js                       # report only
 *   node scripts/apply-role-login-rule.js --apply --keep="Receptionist / Front Desk Executive"
 *   node scripts/apply-role-login-rule.js --apply --keep="A,B" --tidy-seniors
 *
 * --tidy-seniors also clears the redundant explicit `true` on roles at or above
 * the threshold. Behaviourally a no-op (the rule grants them login anyway); it
 * just makes the role list read "by level" instead of "override".
 */

const THRESHOLD = 6;
const APPLY = process.argv.includes('--apply');
const TIDY_SENIORS = process.argv.includes('--tidy-seniors');

const keepArg = process.argv.find((a) => a.startsWith('--keep='));
const KEEP = keepArg
  ? keepArg.slice('--keep='.length).replace(/^["']|["']$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const resolve = (role) => {
  const explicit = role.userAccountSettings?.canHaveUserAccount;
  if (typeof explicit === 'boolean') return { login: explicit, how: 'override' };
  return { login: (role.hierarchy || 1) >= THRESHOLD, how: 'by level' };
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log(`✅ Connected${APPLY ? '' : ' (REPORT ONLY — no writes)'}`);
  console.log(`Threshold: level ${THRESHOLD}+ signs in.  Keep-list: ${KEEP.length ? KEEP.join(' | ') : '(none)'}\n`);

  const roles = await db.collection('roles').find({}).sort({ hierarchy: -1 }).toArray();

  console.log('CURRENT:');
  for (const r of roles) {
    const { login, how } = resolve(r);
    const n = await db.collection('users').countDocuments({ role: r._id, isActive: true });
    console.log(`  L${String(r.hierarchy ?? '?').padStart(2)} ${(r.name || '').padEnd(38)} login=${login ? 'YES' : 'no '} (${how})  active accounts=${n}`);
  }

  const junior = roles.filter((r) => (r.hierarchy || 1) < THRESHOLD);
  const toClear = junior.filter((r) => !KEEP.includes(r.name) && typeof r.userAccountSettings?.canHaveUserAccount === 'boolean');
  const toKeepOn = junior.filter((r) => KEEP.includes(r.name) && r.userAccountSettings?.canHaveUserAccount !== true);
  const seniorsToTidy = TIDY_SENIORS
    ? roles.filter((r) => (r.hierarchy || 1) >= THRESHOLD && typeof r.userAccountSettings?.canHaveUserAccount === 'boolean')
    : [];

  console.log('\nPLANNED:');
  console.log(`  clear override (→ no login for new staff): ${toClear.length ? toClear.map((r) => r.name).join(', ') : '(none)'}`);
  console.log(`  force login ON (keep-list):                ${toKeepOn.length ? toKeepOn.map((r) => r.name).join(', ') : '(none, already on)'}`);
  if (TIDY_SENIORS) {
    console.log(`  tidy seniors (no behaviour change):        ${seniorsToTidy.length ? seniorsToTidy.map((r) => r.name).join(', ') : '(none)'}`);
  }

  // Warn where clearing the override removes login from a role that clearly
  // uses the app — the operator should know before new hires land on it.
  const APP_USE_HINTS = ['manage_', 'view_', 'update_', 'assign_', 'create_', 'edit_'];
  const notable = toClear.filter((r) => (r.permissions || []).some((p) => APP_USE_HINTS.some((h) => p.startsWith(h))));
  if (notable.length) {
    console.log('\n⚠ These roles hold permissions that imply they USE the app. New staff on them');
    console.log('  will get no login. Switch the role back on in Settings → Role-Based Access if needed:');
    for (const r of notable) {
      console.log(`    ${r.name}: ${(r.permissions || []).slice(0, 6).join(', ')}${(r.permissions || []).length > 6 ? ', …' : ''}`);
    }
  }

  if (!APPLY) {
    console.log('\nNothing changed. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  for (const r of toClear) {
    await db.collection('roles').updateOne(
      { _id: r._id },
      { $unset: { 'userAccountSettings.canHaveUserAccount': '' } },
    );
  }
  for (const r of toKeepOn) {
    await db.collection('roles').updateOne(
      { _id: r._id },
      { $set: { 'userAccountSettings.canHaveUserAccount': true } },
    );
  }
  for (const r of seniorsToTidy) {
    await db.collection('roles').updateOne(
      { _id: r._id },
      { $unset: { 'userAccountSettings.canHaveUserAccount': '' } },
    );
  }
  console.log(`\n→ cleared ${toClear.length}, forced on ${toKeepOn.length}, tidied ${seniorsToTidy.length}`);

  const after = await db.collection('roles').find({}).sort({ hierarchy: -1 }).toArray();
  console.log('\nAFTER:');
  for (const r of after) {
    const { login, how } = resolve(r);
    console.log(`  L${String(r.hierarchy ?? '?').padStart(2)} ${(r.name || '').padEnd(38)} login=${login ? 'YES' : 'no '} (${how})`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
};

run().catch(async (err) => {
  console.error('❌ Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
