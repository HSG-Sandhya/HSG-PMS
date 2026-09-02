import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickStaffSummary, STAFF_DETAIL_PERMISSIONS } from '../services/staffVisibility.js';
import { ALL_PERMISSIONS } from '../config/permissions.js';

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'routes');

// Authorization was applied almost exclusively to mutations. Creating a guest
// needed manage_guests; reading every guest needed only a login. The same held
// for staff records (salary, date of birth, home address, emergency contact,
// Aadhaar number and its scan URLs), the accounting ledger and the banking
// transactions. The UI hid those pages, but the UI is not the security
// boundary.

const AUTHZ = /requireManage|requirePermission|requireAdmin|requireSystemAdmin|requireAdminOrManager|checkPermission|canView|canCreate|canSettle/;

// Reads that are deliberately open, each with the reason it has to be.
const INTENTIONALLY_OPEN = {
  'websiteRoutes.js': 'the public guest-facing site; it has no authentication at all',
  'authRoutes.js': 'sign-in and first-run setup must work before anyone has a session',
  'imageRoutes.js': 'images are fetched by <img src>, which cannot send an Authorization header',
  'userRoutes.js': 'the roster behind assignment pickers; the RECORD is reduced instead',
  'staffRoutes.js': 'same roster; staffController reduces the record via limitStaffDetail',
  'dashboardRoutes.js': 'only /role-based and /permissions, which report the caller\'s own identity',
  'settingsRoutes.js': 'reads are authorized in the controller instead: secrets are stripped for everyone and the privileged sections need view_settings',
};

const getRoutes = (src) =>
  [...src.matchAll(/router\.get\(\s*(['"`][^'"`]+['"`])([\s\S]*?)\);/g)].map((m) => ({
    route: m[1].replace(/['"`]/g, ''),
    body: m[2],
  }));

test('every read of guest, staff, financial or operational data is authorized', () => {
  const unexplained = [];
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
    if (INTENTIONALLY_OPEN[file]) continue;
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    // A guard applied to the whole router counts for every route on it. Check
    // EVERY router.use, not just the first — several files authenticate on one
    // line and authorize on another.
    const blanket = [...src.matchAll(/router\.use\(([^;]*?)\);/g)]
      .some((m) => !/^\s*['"`]/.test(m[1]) && AUTHZ.test(m[1]));
    for (const { route, body } of getRoutes(src)) {
      if (blanket || AUTHZ.test(body)) continue;
      unexplained.push(`${file} GET ${route}`);
    }
  }
  assert.deepEqual(unexplained, [], `unauthorized reads:\n  ${unexplained.join('\n  ')}`);
});

test('the reads left open are only the ones with a documented reason', () => {
  // A tripwire: if someone adds a file to the open list, this makes them say why.
  for (const [file, reason] of Object.entries(INTENTIONALLY_OPEN)) {
    assert.equal(fs.existsSync(path.join(routesDir, file)), true, `${file} no longer exists`);
    assert.ok(reason.length > 20, `${file} needs a real reason, not "${reason}"`);
  }
});

test('every permission named in a route guard is one a role can actually be granted', () => {
  const missing = new Set();
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    for (const m of src.matchAll(/require(?:Manage|Permission)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
      for (const p of m[1].match(/['"]([a-z_]+)['"]/g) || []) {
        const name = p.replace(/['"]/g, '');
        if (!ALL_PERMISSIONS.includes(name)) missing.add(`${file}: ${name}`);
      }
    }
  }
  assert.deepEqual([...missing], [],
    'a guard requires a permission no role can hold, so it can never pass');
});

test('a staff summary carries no salary, Aadhaar or home address', () => {
  const full = {
    _id: 'id1', name: 'A Person', position: 'Cook', department: 'Kitchen', role: 'Kitchen Staff',
    status: 'Active', employeeId: 'E1', joiningDate: '2026-01-01',
    salary: 45000, salaryType: 'Monthly', dateOfBirth: '1990-01-01',
    address: '12 Somewhere Lane', phone: '9000000000', email: 'a@x.test',
    emergencyContact: { name: 'B', phone: '9111111111' },
    aadharNumber: '123456789012', aadharFrontUrl: '/uploads/aadhar/f.jpg',
    aadharBackUrl: '/uploads/aadhar/b.jpg', aadharImageUrl: '/uploads/aadhar/i.jpg',
    performanceRating: 4, bankDetails: { accountNumber: '000123' },
  };
  const summary = pickStaffSummary(full);
  for (const leak of ['salary', 'salaryType', 'dateOfBirth', 'address', 'phone', 'email',
    'emergencyContact', 'aadharNumber', 'aadharFrontUrl', 'aadharBackUrl', 'aadharImageUrl',
    'performanceRating', 'bankDetails']) {
    assert.equal(leak in summary, false, `${leak} survived the summary`);
  }
  // ...but enough to pick someone out of a list.
  assert.equal(summary.name, 'A Person');
  assert.equal(summary.department, 'Kitchen');
});

test('the staff-detail permission set is grantable and covers the screens that need it', () => {
  for (const p of STAFF_DETAIL_PERMISSIONS) {
    assert.equal(ALL_PERMISSIONS.includes(p), true, `${p} is not in the catalogue`);
  }
  // Payroll and attendance screens legitimately show pay and contact data.
  for (const p of ['manage_payroll', 'view_payroll', 'manage_attendance', 'view_attendance']) {
    assert.equal(STAFF_DETAIL_PERMISSIONS.includes(p), true);
  }
});

test('every guarded route authenticates before it authorizes', () => {
  // A guard placed ahead of the authentication middleware sees no req.user and
  // answers 401 to everyone, including an administrator — the route looks
  // protected in review and is simply broken. Caught in live testing, not by
  // reading the diff, so it is pinned here.
  const AUTH_NAMES = ['authenticateToken', 'isAuthenticated', 'requireAuth', 'protect',
    'permissionMiddleware.authenticateToken'];
  const problems = [];

  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const blanketAuth = AUTH_NAMES.some((a) =>
      new RegExp(`router\\.use\\(\\s*${a.replace('.', '\\.')}\\s*\\)`).test(src));

    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(([\s\S]*?)\);/g)) {
      const body = m[2];
      const guardAt = body.search(/require(Manage|Permission|Admin|SystemAdmin)/);
      if (guardAt === -1) continue;
      const authAt = Math.min(...AUTH_NAMES.map((a) => {
        const i = body.indexOf(a);
        return i === -1 ? Infinity : i;
      }));
      if (authAt === Infinity) {
        if (!blanketAuth) problems.push(`${file}: guard with no authentication`);
        continue;
      }
      if (authAt > guardAt) {
        problems.push(`${file}: authorization before authentication — ${body.slice(0, 60).replace(/\s+/g, ' ')}`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}`);
});
