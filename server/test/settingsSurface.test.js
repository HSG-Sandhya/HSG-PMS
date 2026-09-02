import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const routes = fs.readFileSync(path.join(here, '..', 'routes', 'settingsRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(here, '..', 'controllers', 'settingsController.js'), 'utf8');

// Removed after an audit: no caller in the admin client or the website, and
// zero requests across two weeks of production access logs — a window that
// recorded 219 other settings requests across 20 distinct paths.

const declared = (method, route) =>
  new RegExp(`router\\.${method}\\(\\s*'${route.replace(/\//g, '\\/')}'`).test(routes);

test('the mock stubs are gone from the routes and the controller', () => {
  // Both echoed the request body back with a fake id, persisted nothing, and
  // answered "201 created successfully" — so a caller would believe it worked.
  assert.equal(declared('post', '/room-types'), false);
  assert.equal(declared('post', '/amenities'), false);
  for (const fn of ['createRoomType', 'createAmenity']) {
    assert.equal(controller.includes(`const ${fn} =`), false, `${fn} still defined`);
    assert.equal(controller.includes(`\n  ${fn},`), false, `${fn} still exported`);
  }
});

test('the 404 fixture route is gone', () => {
  // GET /invalid-endpoint answered 404 on purpose. The app's own not-found
  // handler already does that for every unmatched path.
  assert.equal(declared('get', '/invalid-endpoint'), false);
  assert.equal(controller.includes('const invalidEndpoint ='), false);
});

test('every bare section alias is gone', () => {
  for (const section of ['marriage', 'rooms', 'banquetHallBooking', 'invoice',
    'notifications', 'staff', 'theme', 'payment', 'security', 'tax']) {
    for (const method of ['get', 'put', 'patch']) {
      assert.equal(declared(method, `/${section}`), false,
        `${method.toUpperCase()} /${section} is a second door onto /section/${section}`);
    }
  }
});

test('the real sub-paths under those names are untouched', () => {
  // The aliases went; the endpoints that live beneath them are in daily use.
  const kept = [
    ['post', '/theme/apply'], ['get', '/theme/presets'],
    ['post', '/payment/test-connection'],
    ['put', '/security/policy'], ['post', '/security/test'],
    ['post', '/notifications/test'],
    ['post', '/tax/validate-gst'], ['post', '/tax/validate-pan'],
    ['get', '/staff/shift-templates'],
    ['post', '/invoice/preview'],
    ['get', '/room-categories'], ['post', '/room-categories'],
    ['get', '/section/:section'], ['put', '/section/:section'],
    ['get', '/public/theme'], ['get', '/public/branding'],
  ];
  for (const [method, route] of kept) {
    assert.equal(declared(method, route), true, `${method.toUpperCase()} ${route} was removed by mistake`);
  }
});

test('the duplicate permissions route is gone but the used one remains', () => {
  assert.equal(declared('get', '/staff/permissions'), false, 'duplicate of /permissions');
  assert.equal(controller.includes('const getAllPermissions ='), false);
  assert.equal(declared('get', '/permissions'), true, '/permissions is used by the Roles UI');
});

test('the duplicate invoice-templates route is gone but the used one remains', () => {
  assert.equal(declared('get', '/invoice/templates'), false);
  assert.equal(declared('get', '/invoice-templates'), true);
});

test('the backup routes and their guards survived the cleanup', () => {
  // These were graded in a separate change; make sure this one did not disturb them.
  for (const [method, route] of [['get', '/backup'], ['get', '/backup/history'],
    ['get', '/backup/storage-stats'], ['get', '/backup/download/:filename'],
    ['post', '/backup/manual'], ['delete', '/backup/:filename']]) {
    assert.equal(declared(method, route), true, `${method.toUpperCase()} ${route} lost`);
  }
  assert.match(routes, /router\.use\('\/backup', requireBackupRead\)/);
  assert.match(routes, /requireSystemAdmin, settingsController\.downloadBackup/);
});

test('every route still points at a handler the controller exports', () => {
  // `\w+` alone also matches the ".js" of the import line.
  const handlers = [...routes.matchAll(/settingsController\.(\w+)/g)]
    .map((m) => m[1])
    .filter((h) => h !== 'js');
  const orphans = [...new Set(handlers)].filter(
    (h) => !new RegExp(`\\n  ${h},`).test(controller) && !new RegExp(`export const ${h}\\b`).test(controller)
  );
  assert.deepEqual(orphans, [], 'a route references a handler that no longer exists');
});
