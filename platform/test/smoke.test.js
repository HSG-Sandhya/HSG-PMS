import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The control plane can create, suspend and reconfigure every hotel, so a
// router that fails to build must never reach a deploy. Importing routes.js
// constructs every path and loads the rate limiters.
test('control-plane routes and app build cleanly', async () => {
  const routes = await import(pathToFileURL(join(ROOT, 'routes.js')).href);
  assert.ok(routes.default, 'routes.js must export a router');

  const { default: app } = await import(pathToFileURL(join(ROOT, 'app.js')).href);
  assert.equal(typeof app, 'function', 'app.js must export an Express app');
});

test('rate limiters are configured for login, setup and the general API', async () => {
  const rl = await import(pathToFileURL(join(ROOT, 'middleware/rateLimit.js')).href);
  for (const name of ['loginLimiter', 'setupLimiter', 'apiLimiter']) {
    assert.equal(typeof rl[name], 'function', `${name} must be exported`);
  }
});
