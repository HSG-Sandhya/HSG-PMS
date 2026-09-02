import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Staff from '../models/Staff.js';
import {
  STAFF_STATUS,
  STAFF_STATUSES,
  ACCESS_LEVEL,
  ACCESS_LEVELS,
  normalizeStaffStatus,
  scopeForRole,
  levelForRole,
  levelForScope,
  adminScope,
  departmentScope,
} from '../config/staffConstants.js';

mongoose.set('bufferCommands', false); // validation is local; no database needed

const base = () => ({
  name: 'A Person',
  position: 'Cook',
  department: 'Kitchen',
  role: 'Kitchen Staff',
  contactNumber: '9000000000',
  email: `x${Math.random().toString(36).slice(2)}@example.test`,
  joiningDate: new Date('2026-01-01'),
  salary: 20000,
});

const validate = async (doc) => doc.validate().then(() => null).catch((e) => e);

// The schema and the controller disagreed about two fields, and neither
// disagreement was visible until something failed. createStaff wrote
// status:'Active' (schema stores 'active') and assigned the OBJECT shape that
// Role.accessLevel uses to Staff.accessLevel, a String path.

test('the exact values the controller used to write are still rejected as data', async () => {
  // Not a regression test for the fix — a record of WHY it was a bug. A
  // capitalised status is now normalized, but a genuinely wrong one still fails.
  const bad = new Staff({ ...base(), status: 'Archived' });
  const err = await validate(bad);
  assert.ok(err, 'an unknown status must still be rejected');
  assert.ok(err.errors.status, 'the enum validator must be the thing that rejects it');
});

test('a create with controller defaults validates', async () => {
  const data = base();
  data.accessScope = scopeForRole(data.role, data.department);
  data.accessLevel = levelForRole(data.role);
  data.status = STAFF_STATUS.ACTIVE;

  const err = await validate(new Staff(data));
  assert.equal(err, null, err && Object.keys(err.errors || {}).join(', '));
});

test('a capitalised status is stored canonically instead of failing', async () => {
  for (const [sent, want] of [
    ['Active', 'active'],
    ['ACTIVE', 'active'],
    ['On Leave', 'on_leave'],
    ['on-leave', 'on_leave'],
    ['Terminated', 'terminated'],
  ]) {
    const doc = new Staff({ ...base(), status: sent });
    assert.equal(doc.status, want, `${sent} should normalize to ${want}`);
    assert.equal(await validate(doc), null, `${sent} should validate`);
  }
});

test('the object shape sent to accessLevel is reduced instead of throwing a CastError', async () => {
  // Role.accessLevel is an object; Staff.accessLevel is a string. A caller that
  // still sends the object gets the word it implies, not a failed save.
  const full = new Staff({ ...base(), accessLevel: { departments: ['all'], rooms: 'all', reports: 'all' } });
  assert.equal(full.accessLevel, ACCESS_LEVEL.FULL);
  assert.equal(await validate(full), null);

  const limited = new Staff({ ...base(), accessLevel: { departments: ['Kitchen'], rooms: 'limited', reports: 'limited' } });
  assert.equal(limited.accessLevel, ACCESS_LEVEL.LIMITED);
  assert.equal(await validate(limited), null);

  // A plain string still passes through untouched.
  const readOnly = new Staff({ ...base(), accessLevel: 'Read Only' });
  assert.equal(readOnly.accessLevel, 'Read Only');
  assert.equal(await validate(readOnly), null);
});

test('the object concept has its own field and survives the round trip', async () => {
  const doc = new Staff({ ...base(), accessScope: adminScope() });
  assert.equal(await validate(doc), null);
  assert.deepEqual(doc.accessScope.departments, ['all']);
  assert.equal(doc.accessScope.rooms, 'all');
  assert.equal(doc.accessScope.reports, 'all');

  const dept = new Staff({ ...base(), accessScope: departmentScope('Kitchen') });
  assert.deepEqual(dept.accessScope.departments, ['Kitchen']);
  assert.equal(dept.accessScope.rooms, 'limited');
});

test('the status the queries look for is a value the schema can store', () => {
  // getStaffByRole and getStaffByDepartment queried status:'Active' while the
  // schema stores 'active', so they returned an empty list for a department
  // full of active staff — no error, just nothing.
  assert.ok(STAFF_STATUSES.includes(STAFF_STATUS.ACTIVE));
  assert.equal(new Staff({ ...base() }).status, STAFF_STATUS.ACTIVE,
    'the default must be the same value the queries filter on');
});

test('the constants and the schema enums cannot drift apart', () => {
  assert.deepEqual([...Staff.schema.path('status').enumValues].sort(), [...STAFF_STATUSES].sort());
  assert.deepEqual([...Staff.schema.path('accessLevel').enumValues].sort(), [...ACCESS_LEVELS].sort());
});

test('scope and level agree with each other for every role', () => {
  for (const role of ['Admin', 'Kitchen Staff', 'Manager', 'Waiter']) {
    const scope = scopeForRole(role, 'Kitchen');
    assert.equal(levelForScope(scope), levelForRole(role),
      `${role}: the one-word level must match the scope it summarises`);
  }
});

test('normalizeStaffStatus leaves an unrecognised value alone for the validator to reject', () => {
  assert.equal(normalizeStaffStatus('Archived'), 'Archived');
  assert.equal(normalizeStaffStatus(undefined), undefined);
  assert.equal(normalizeStaffStatus(null), null);
});

// ── Employee IDs ─────────────────────────────────────────────────────────────
// The generator was `countDocuments() + 1`, which is the same defect already
// fixed for bookings, invoices and restaurant orders — and one more besides.

import {
  formatEmployeeId,
  employeeIdNumber,
  highestEmployeeNumber,
} from '../config/staffConstants.js';

// The old generator, kept only to show what it did.
const countBasedId = (existing) => formatEmployeeId(existing.length + 1);

test('a count is not a high-water mark: the old generator reused a live id', () => {
  // 27 staff, EMP0001..EMP0027. One leaves.
  const roster = Array.from({ length: 27 }, (_, i) => formatEmployeeId(i + 1));
  const afterDeparture = roster.filter((id) => id !== 'EMP0014');

  const chosen = countBasedId(afterDeparture);
  assert.equal(chosen, 'EMP0027');
  assert.equal(afterDeparture.includes(chosen), true,
    'the old generator handed out an id that is still in use — E11000 on save');

  // The counter is seeded from the highest id in use, so it steps over the gap.
  assert.equal(highestEmployeeNumber(afterDeparture), 27);
  assert.equal(formatEmployeeId(highestEmployeeNumber(afterDeparture) + 1), 'EMP0028');
});

test('two callers reading the same count choose the same id; a counter cannot', () => {
  const roster = Array.from({ length: 27 }, (_, i) => formatEmployeeId(i + 1));
  assert.equal(countBasedId(roster), countBasedId(roster),
    'both concurrent creations pick this same value — that is the race');

  // An atomic $inc is applied by the database, so each caller gets a distinct
  // value. Modelled here as the monotonic counter it is.
  let seq = highestEmployeeNumber(roster);
  const a = formatEmployeeId(++seq);
  const b = formatEmployeeId(++seq);
  assert.notEqual(a, b);
  assert.deepEqual([a, b], ['EMP0028', 'EMP0029']);
});

test('the seed compares numerically, not as strings', () => {
  // Sorting strings puts 'EMP9999' above 'EMP10000', so a sort-based seed would
  // read 9999 and hand out ids that already exist.
  const rows = ['EMP0001', 'EMP9999', 'EMP10000', 'EMP10001'];
  assert.equal(highestEmployeeNumber(rows), 10001);
  assert.equal([...rows].sort().pop(), 'EMP9999', 'string sort really does get this wrong');

  // Documents or bare strings, either way.
  assert.equal(highestEmployeeNumber([{ employeeId: 'EMP0042' }, { employeeId: 'EMP0007' }]), 42);
});

test('ids that are not EMP-numbered are ignored rather than poisoning the seed', () => {
  assert.equal(employeeIdNumber('MANUAL-ID'), null);
  assert.equal(employeeIdNumber(undefined), null);
  assert.equal(highestEmployeeNumber(['EMP0005', 'MANUAL-ID', null, { employeeId: '' }]), 5);
  assert.equal(highestEmployeeNumber([]), 0, 'an empty roster starts the counter at zero');
});

test('formatting keeps the four-digit padding and does not truncate beyond it', () => {
  assert.equal(formatEmployeeId(1), 'EMP0001');
  assert.equal(formatEmployeeId(28), 'EMP0028');
  assert.equal(formatEmployeeId(9999), 'EMP9999');
  assert.equal(formatEmployeeId(10000), 'EMP10000');
});
