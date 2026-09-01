import test from 'node:test';
import assert from 'node:assert/strict';

import { isAdminActor, isAdminRole } from '../utils/isAdminActor.js';
import { imageTypeOf } from '../utils/fileSignature.js';

// ── Administrator status comes from grants, never a display name ─────────────
// Regression guard for the substring check that promoted anything named
// "System Auditor" or "Assistant Administrator" to full administrator.
test('isAdminActor ignores role names entirely', () => {
  const named = (name) => ({ role: { name, permissions: [] }, permissions: [] });

  assert.equal(isAdminActor(named('System Auditor')), false);
  assert.equal(isAdminActor(named('Assistant Administrator')), false);
  assert.equal(isAdminActor(named('System Operator')), false);
  assert.equal(isAdminActor(named('Super Admin')), false, 'name alone must not grant');

  assert.equal(isAdminActor({ isSystemAdmin: true }), true);
  assert.equal(isAdminActor({ role: { permissions: ['admin_access'] } }), true);
  assert.equal(isAdminActor({ permissions: ['system_administration'] }), true);
  assert.equal(isAdminActor(null), false);
  assert.equal(isAdminActor({}), false);
});

test('isAdminActor reads a hydrated document via hasPermission', () => {
  const doc = { hasPermission: (p) => p === 'admin_access' };
  assert.equal(isAdminActor(doc), true);
  assert.equal(isAdminActor({ hasPermission: () => false }), false);
});

test('isAdminRole needs permissions selected, and fails closed without them', () => {
  assert.equal(isAdminRole({ name: 'Super Admin', permissions: ['admin_access'] }), true);
  assert.equal(isAdminRole({ name: 'Super Admin' }), false, 'omitted projection must not pass');
  assert.equal(isAdminRole({ name: 'Cleaner', permissions: ['manage_rooms'] }), false);
});

// ── Uploaded files are identified by content, not filename ───────────────────
test('imageTypeOf accepts real images and rejects disguised payloads', () => {
  assert.equal(imageTypeOf(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpg');
  assert.equal(imageTypeOf(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])), 'png');
  assert.equal(
    imageTypeOf(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])),
    'webp',
  );

  assert.equal(imageTypeOf(Buffer.from('<?php system($_GET["c"]); ?>')), null);
  assert.equal(imageTypeOf(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(
    imageTypeOf(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('AVI ')])),
    null,
    'RIFF alone is not WebP',
  );
  assert.equal(imageTypeOf(Buffer.alloc(0)), null);
});

// ── Availability overlap must be half-open ───────────────────────────────────
// The deleted /bookings/availability used inclusive comparisons and turned away
// back-to-back stays. This pins the correct semantics.
const overlaps = (bookedIn, bookedOut, wantIn, wantOut) =>
  new Date(bookedIn) < new Date(wantOut) && new Date(bookedOut) > new Date(wantIn);

test('back-to-back stays do not overlap', () => {
  assert.equal(overlaps('2026-09-03', '2026-09-05', '2026-09-05', '2026-09-07'), false);
  assert.equal(overlaps('2026-09-05', '2026-09-07', '2026-09-03', '2026-09-05'), false);
});

test('genuine overlaps are still detected', () => {
  assert.equal(overlaps('2026-09-03', '2026-09-07', '2026-09-04', '2026-09-06'), true);
  assert.equal(overlaps('2026-09-03', '2026-09-05', '2026-09-04', '2026-09-08'), true);
  assert.equal(overlaps('2026-09-04', '2026-09-06', '2026-09-03', '2026-09-07'), true);
});

// ── Private file paths are confined by construction ──────────────────────────
// Mirrors resolveInDir() in controllers/privateFileController.js: only the
// basename is trusted, so traversal cannot escape the directory.
import { basename, join } from 'path';

const resolveInDir = (stored, dir) => {
  if (!stored || typeof stored !== 'string') return null;
  const name = basename(stored.replace(/\\/g, '/').trim());
  if (!name || name === '.' || name === '..') return null;
  return join(dir, name);
};

test('stored paths cannot escape their directory', () => {
  const DIR = '/srv/uploads/id-cards';
  for (const evil of ['../../../../etc/passwd', '/etc/passwd', 'a/b/../../../etc/shadow']) {
    const out = resolveInDir(evil, DIR);
    assert.ok(out.startsWith(DIR + '/'), `escaped: ${evil} -> ${out}`);
  }
  assert.equal(resolveInDir('..', DIR), null);
  assert.equal(resolveInDir('', DIR), null);
  assert.equal(resolveInDir(null, DIR), null);
  // A real stored value (absolute prod path) resolves to the filename.
  assert.equal(
    resolveInDir('/var/www/sandhyagrand/server/uploads/id-cards/id-card-1.png', DIR),
    join(DIR, 'id-card-1.png'),
  );
});
