import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_PERMISSIONS, PERMISSION_CATALOG } from '../config/permissions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const routeSrc = fs.readFileSync(path.join(here, '..', 'routes', 'imageRoutes.js'), 'utf8');

// Writing to the image store was gated on nothing but a valid login. The bytes
// live in MongoDB rather than on disk, and the ids are rendered on the public
// site and the sign-in screen — so any employee calling the API directly could
// fill the database, or delete the hotel's logo and login background and change
// what guests see.

const routeLine = (method, route) =>
  routeSrc.split('\n').find((l) =>
    l.includes(`router.${method}(`) && l.includes(`'${route}'`));

test('upload, delete and the metadata list all require a media permission', () => {
  for (const [method, route] of [['post', '/'], ['delete', '/:id'], ['get', '/']]) {
    const line = routeLine(method, route);
    assert.ok(line, `${method.toUpperCase()} ${route} not found`);
    assert.match(line, /canManageMedia/,
      `${method.toUpperCase()} ${route} is reachable on a login alone`);
  }
});

test('the guard accepts manage_media or manage_settings', () => {
  const decl = routeSrc.match(/const canManageMedia = requirePermission\(\[([^\]]*)\]\)/);
  assert.ok(decl, 'the guard should name its permissions in one place');
  const perms = (decl[1].match(/'([a-z_]+)'/g) || []).map((p) => p.replace(/'/g, ''));
  assert.deepEqual(perms.sort(), ['manage_media', 'manage_settings'],
    'manage_settings is kept so the Appearance picker still works for existing admins');
});

test('fetching one image by id stays public', () => {
  const line = routeLine('get', '/:id');
  assert.ok(line);
  assert.doesNotMatch(line, /authenticateToken|canManageMedia/,
    'the login screen and public site render these through <img src>, which sends no header');
});

test('every guarded image route authenticates before it authorizes', () => {
  for (const [method, route] of [['post', '/'], ['delete', '/:id'], ['get', '/']]) {
    const line = routeLine(method, route);
    assert.ok(line.indexOf('authenticateToken') < line.indexOf('canManageMedia'),
      `${method.toUpperCase()} ${route}: a guard ahead of authentication 401s everyone`);
  }
});

test('manage_media is a permission a role can actually be granted', () => {
  assert.equal(ALL_PERMISSIONS.includes('manage_media'), true,
    'a guard requiring a permission absent from the catalogue can never pass');
  const group = PERMISSION_CATALOG.find((g) => g.permissions.includes('manage_media'));
  assert.ok(group, 'it must sit in a group so it appears in the Roles UI');
});
