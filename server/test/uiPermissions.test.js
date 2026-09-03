// The UI's route table and the server's permission catalogue must agree.
//
// The route table hand-listed one `manage_*` permission per page — the WRITE
// permission. So a role granted only the read or partial permissions for a page
// was bounced out of a page its own permissions said it could use. This hotel
// has a live instance: Room Attendant holds view_housekeeping_tasks and
// update_room_status, and could not open /housekeeping.
//
// The route table now derives from the catalogue by group, and these tests keep
// the client's mirror of that catalogue honest. A permission added on one side
// and not the other fails here rather than silently locking someone out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { PERMISSION_CATALOG, ALL_PERMISSIONS } from '../config/permissions.js';

const CLIENT = join(process.cwd(), '..', 'client', 'src', 'config');
const mirrorPath = join(CLIENT, 'permissions.js');
const routesPath = join(CLIENT, 'routes.js');
const haveClient = existsSync(mirrorPath) && existsSync(routesPath);

// Pull the catalogue array out of the client mirror without importing JSX/MUI.
const parseClientCatalog = () => {
  const src = readFileSync(mirrorPath, 'utf8');
  const start = src.indexOf('export const PERMISSION_CATALOG = [');
  assert.notEqual(start, -1, 'the client mirror has no PERMISSION_CATALOG');
  const open = src.indexOf('[', start);
  const end = src.indexOf('\n];', open);
  assert.notEqual(end, -1, 'could not find the end of the client catalogue');
  const body = src.slice(open, end + 2);
  // Object keys are bare identifiers in the source; quote them for JSON.
  const json = body
    .replace(/(\{|,)\s*(name|permissions)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[\]}])/g, '$1');
  return JSON.parse(json);
};

test('the client permission catalogue mirrors the server exactly', { skip: haveClient ? false : 'client/ not present' }, () => {
  assert.deepEqual(
    parseClientCatalog(),
    JSON.parse(JSON.stringify(PERMISSION_CATALOG)),
    'client/src/config/permissions.js has drifted from server/config/permissions.js',
  );
});

test('every permission the route table names actually exists', { skip: haveClient ? false : 'client/ not present' }, () => {
  const src = readFileSync(routesPath, 'utf8');

  // Literal permission strings, e.g. permissions: ['view_dashboard'].
  const literals = [...src.matchAll(/permissions:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));

  const unknown = literals.filter((p) => !ALL_PERMISSIONS.includes(p));
  assert.deepEqual(unknown, [],
    `the route table names permissions no role can hold: ${unknown.join(', ')}`);
});

test('every group the route table asks for exists', { skip: haveClient ? false : 'client/ not present' }, () => {
  const src = readFileSync(routesPath, 'utf8');
  const groups = [...src.matchAll(/groupPermissions\(([^)]*)\)/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));

  assert.ok(groups.length > 0, 'no route derives its permissions from a group');
  const known = new Set(PERMISSION_CATALOG.map((g) => g.name));
  const unknown = [...new Set(groups)].filter((g) => !known.has(g));
  assert.deepEqual(unknown, [], `unknown permission groups: ${unknown.join(', ')}`);
});

test('a page is never gated on its write permission alone', { skip: haveClient ? false : 'client/ not present' }, () => {
  const src = readFileSync(routesPath, 'utf8');

  // Every route entry, as (path, permissions) pairs.
  const entries = [...src.matchAll(/path:\s*'([^']+)',[\s\S]{0,400}?permissions:\s*(\[[^\]]*\]|groupPermissions\([^)]*\))/g)]
    .map((m) => ({ path: m[1], perms: m[2] }));

  assert.ok(entries.length >= 15, `expected the full route table, parsed ${entries.length}`);

  // A literal list holding exactly one manage_* permission is the shape that
  // caused this: the page opens only for someone who may WRITE it.
  const writeOnly = entries.filter(({ perms }) => {
    if (perms.startsWith('groupPermissions')) return false;
    const names = [...perms.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    return names.length === 1 && names[0].startsWith('manage_');
  });

  assert.deepEqual(writeOnly.map((e) => e.path), [],
    'these routes open only for a manage_* permission, so read-level roles are bounced');
});

test('the roles this hotel actually uses can reach their own pages', { skip: haveClient ? false : 'client/ not present' }, () => {
  const src = readFileSync(routesPath, 'utf8');
  const permsFor = (path) => {
    const m = src.match(new RegExp(`path: '${path.replace(/\//g, '\\/')}',[\\s\\S]{0,400}?permissions:\\s*(\\[[^\\]]*\\]|groupPermissions\\([^)]*\\))`));
    assert.ok(m, `no route entry for ${path}`);
    if (m[1].startsWith('groupPermissions')) {
      const names = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
      return names.flatMap((n) => PERMISSION_CATALOG.find((g) => g.name === n).permissions);
    }
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  };

  // Taken from the live roles collection, not from a template.
  const roles = {
    'Room Attendant': ['view_housekeeping_tasks', 'update_room_status'],
    'Executive Chef': ['view_restaurant_orders', 'manage_restaurant', 'manage_menu'],
    'Front Desk Executive': ['view_bookings', 'create_bookings', 'edit_bookings', 'view_guests', 'view_rooms'],
    Accountant: ['manage_payments', 'view_financial_reports', 'manage_billing'],
    Security: ['view_guests'],
  };
  const expected = {
    'Room Attendant': '/housekeeping',
    'Executive Chef': '/restaurant',
    'Front Desk Executive': '/bookings',
    Accountant: '/accounting',
    Security: '/guests',
  };

  for (const [role, held] of Object.entries(roles)) {
    const page = expected[role];
    const opens = permsFor(page).some((p) => held.includes(p));
    assert.ok(opens, `${role} cannot open ${page}, though the server lets them`);
  }
});
