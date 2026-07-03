/**
 * setupLogins.js
 * ------------------------------------------------------------------
 * Idempotent setup for ready-to-hand-over staff logins.
 *
 * Creates / ensures:
 *   • "System Administrator" role  (full access)
 *   • "Front Desk" role            (used as-is if it exists; created from
 *                                   fallback perms only if missing)
 *   • "Management" and "Front Desk" departments
 *   • one Admin login              (username: admin)
 *   • one Front-desk login          (username: frontoffice, role: Front Desk)
 *
 * Safe to run multiple times. Each run re-applies the role/department
 * and resets the two accounts' passwords to the known defaults below,
 * so the printed credentials are always valid to hand over.
 *
 *   Run:  node scripts/setupLogins.js
 * ------------------------------------------------------------------
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';

dotenv.config();

// --- Permission sets ------------------------------------------------
// These strings must match the route guards in client/src/App.js and
// the menu items in client/src/components/layout/Sidebar.js.
//
// The front-desk login uses the pre-existing "Front Desk" role. These
// permissions are only used as a fallback to CREATE that role if it
// doesn't already exist — an existing Front Desk role is left untouched.
const FRONT_DESK_FALLBACK_PERMISSIONS = [
  'view_dashboard',
  'manage_bookings',
  'manage_reservations',
  'manage_rooms',
  'manage_guests',
  'manage_housekeeping',
  'manage_restaurant',
  'manage_pos',
];

const ADMIN_PERMISSIONS = [
  'admin_access', 'system_admin', 'manage_settings', 'manage_staff',
  'manage_roles', 'manage_users', 'view_dashboard', 'manage_bookings',
  'manage_reservations', 'manage_rooms', 'manage_guests', 'manage_accounting',
  'manage_payments', 'manage_housekeeping', 'manage_restaurant', 'manage_pos',
  'manage_events', 'manage_channels', 'manage_attendance', 'manage_payroll',
];

// --- Accounts to hand over ------------------------------------------
const ACCOUNTS = [
  {
    label: 'Administrator',
    username: 'admin',
    password: 'Admin@2026',
    email: 'admin@sandhyagrand.com',
    phone: '9000000001',
    firstName: 'Hotel',
    lastName: 'Admin',
    employeeId: 'ADM-001',
    roleName: 'System Administrator',
    departmentName: 'Management',
    isSystemAdmin: true,
  },
  {
    label: 'Front Office',
    username: 'frontoffice',
    password: 'Front@2026',
    email: 'frontoffice@sandhyagrand.com',
    phone: '9000000002',
    firstName: 'Front',
    lastName: 'Office',
    employeeId: 'FO-001',
    roleName: 'Front Desk',
    departmentName: 'Front Desk',
    isSystemAdmin: false,
  },
];

const pagesFor = (perms) =>
  perms.map((p) => ({ page: p, canView: true, canEdit: true, canDelete: false }));

async function ensureRole(name, { description, hierarchy, permissions }) {
  let role = await Role.findOne({ name });
  if (!role) role = new Role({ name });
  role.description = description;
  role.hierarchy = hierarchy;
  role.permissions = permissions;
  role.isActive = true;
  role.accessLevel = { ...(role.accessLevel || {}), pages: pagesFor(permissions) };
  await role.save();
  console.log(`  ✓ role "${name}" (${permissions.length} permissions)`);
  return role;
}

// Use an existing role as-is; only create it (with fallback perms) if missing.
// Never overwrites the permissions of a role that already exists.
async function findOrCreateRole(name, { description, hierarchy, fallbackPermissions }) {
  let role = await Role.findOne({ name });
  if (role) {
    console.log(`  ✓ role "${name}" exists (left untouched, ${role.permissions.length} permissions)`);
    return role;
  }
  role = new Role({
    name, description, hierarchy, isActive: true,
    permissions: fallbackPermissions,
    accessLevel: { pages: pagesFor(fallbackPermissions) },
  });
  await role.save();
  console.log(`  ✓ role "${name}" created (${fallbackPermissions.length} permissions)`);
  return role;
}

async function ensureDepartment(name, { description, color }) {
  let dept = await Department.findOne({ name });
  if (!dept) {
    dept = new Department({ name, description, color, isActive: true });
    await dept.save();
    console.log(`  ✓ department "${name}" created`);
  } else {
    console.log(`  ✓ department "${name}" exists`);
  }
  return dept;
}

async function ensureAccount(acc, roleId, deptId) {
  let user = await User.findOne({ username: acc.username }).select('+password');
  if (!user) {
    user = new User({ username: acc.username });
    console.log(`  ✓ login "${acc.username}" created`);
  } else {
    console.log(`  ✓ login "${acc.username}" updated (password reset to default)`);
  }
  user.email = acc.email;
  user.phone = acc.phone;
  user.firstName = acc.firstName;
  user.lastName = acc.lastName;
  user.role = roleId;
  user.department = deptId;
  user.isActive = true;
  user.isSystemAdmin = acc.isSystemAdmin;
  user.password = acc.password; // pre-save hook hashes it
  if (!user.profile) user.profile = {};
  user.profile.employeeId = acc.employeeId;
  user.profile.joiningDate = user.profile.joiningDate || new Date();
  await user.save();
  return user;
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in .env');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log('Roles & departments:');
    const adminRole = await ensureRole('System Administrator', {
      description: 'Full system access with all administrative privileges',
      hierarchy: 10,
      permissions: ADMIN_PERMISSIONS,
    });
    const frontRole = await findOrCreateRole('Front Desk', {
      description: 'Reception desk: bookings, reservations, rooms, guests, housekeeping, restaurant and POS',
      hierarchy: 5,
      fallbackPermissions: FRONT_DESK_FALLBACK_PERMISSIONS,
    });
    const mgmtDept = await ensureDepartment('Management', {
      description: 'Executive and administrative management',
      color: '#EC4899',
    });
    const frontDept = await ensureDepartment('Front Desk', {
      description: 'Reception and guest-facing operations',
      color: '#6366F1',
    });

    const roleByName = { 'System Administrator': adminRole, 'Front Desk': frontRole };
    const deptByName = { Management: mgmtDept, 'Front Desk': frontDept };

    console.log('\nLogins:');
    for (const acc of ACCOUNTS) {
      await ensureAccount(acc, roleByName[acc.roleName]._id, deptByName[acc.departmentName]._id);
    }

    console.log('\n========================================================');
    console.log(' Ready-to-hand-over credentials (change after first use)');
    console.log('========================================================');
    for (const acc of ACCOUNTS) {
      console.log(`\n  ${acc.label}`);
      console.log(`    Username : ${acc.username}`);
      console.log(`    Password : ${acc.password}`);
    }
    console.log('\n  Login page: /login');
    console.log('========================================================\n');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
})();
