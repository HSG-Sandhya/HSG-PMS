/**
 * Realign the "Kitchen Staff" role with what kitchen staff actually do.
 *
 * The role was granting staff-administration rights and nothing about the
 * restaurant:
 *
 *   before  manage_staff, view_staff, create_staff, edit_staff, deactivate_staff
 *   after   view_restaurant_orders, manage_restaurant, manage_menu
 *
 * Two consequences of the old set, both wrong for a kitchen account:
 *   • it could read colleagues' salary, date of birth, home address,
 *     emergency contact and Aadhaar number, and deactivate staff;
 *   • it could NOT open /restaurant, which needs manage_restaurant.
 *
 * A user document carries its OWN copy of the permissions, and the guards read
 * `role.permissions OR user.permissions`. Updating the role alone would leave
 * every member still holding the old rights, so both are rewritten.
 *
 * Usage:
 *   node scripts/fixKitchenStaffRole.js            # dry run, changes nothing
 *   node scripts/fixKitchenStaffRole.js --apply    # write
 *   node scripts/fixKitchenStaffRole.js --revert <snapshot.json>
 */
import mongoose from 'mongoose';
import fs from 'fs';
import '../config/env.js';

const ROLE_NAME = 'Kitchen Staff';
const NEXT_PERMISSIONS = ['view_restaurant_orders', 'manage_restaurant', 'manage_menu'];

const apply = process.argv.includes('--apply');
const revertIdx = process.argv.indexOf('--revert');
const revertFile = revertIdx > -1 ? process.argv[revertIdx + 1] : null;

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const roles = db.collection('roles');
  const users = db.collection('users');

  if (revertFile) {
    const snap = JSON.parse(fs.readFileSync(revertFile, 'utf8'));
    if (!apply) {
      console.log(`DRY RUN — would restore role and ${snap.users.length} user(s) from ${revertFile}`);
    } else {
      await roles.updateOne({ _id: new mongoose.Types.ObjectId(snap.role._id) },
        { $set: { permissions: snap.role.permissions } });
      for (const u of snap.users) {
        await users.updateOne({ _id: new mongoose.Types.ObjectId(u._id) },
          { $set: { permissions: u.permissions } });
      }
      console.log(`Restored role and ${snap.users.length} user(s) from ${revertFile}`);
    }
    return mongoose.disconnect();
  }

  const role = await roles.findOne({ name: ROLE_NAME });
  if (!role) throw new Error(`Role "${ROLE_NAME}" not found`);
  const members = await users.find({ role: role._id }).project({ username: 1, firstName: 1, permissions: 1 }).toArray();

  console.log(`role   before: ${(role.permissions || []).join(', ') || '(none)'}`);
  console.log(`role   after : ${NEXT_PERMISSIONS.join(', ')}`);
  console.log(`members: ${members.length}`);
  for (const m of members) {
    console.log(`  ${(m.username || m.firstName || '?').padEnd(16)} [${(m.permissions || []).join(', ') || '(none)'}]`);
  }

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
    return mongoose.disconnect();
  }

  // Snapshot before writing, so --revert can put it back exactly.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `backups/role-kitchen-staff-${stamp}.json`;
  fs.mkdirSync('backups', { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), role, users: members }, null, 2));
  console.log(`\nsnapshot: ${file}`);

  const r = await roles.updateOne({ _id: role._id }, { $set: { permissions: NEXT_PERMISSIONS } });
  const u = await users.updateMany({ role: role._id }, { $set: { permissions: NEXT_PERMISSIONS } });
  console.log(`role updated: ${r.modifiedCount} | users updated: ${u.modifiedCount}`);

  const after = await roles.findOne({ _id: role._id });
  console.log(`verified role: ${(after.permissions || []).join(', ')}`);
  for (const m of await users.find({ role: role._id }).project({ username: 1, permissions: 1 }).toArray()) {
    console.log(`  ${(m.username || '?').padEnd(16)} [${(m.permissions || []).join(', ')}]`);
  }
  return mongoose.disconnect();
};

main().catch((e) => { console.error(e.message); process.exit(1); });
