import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Import every route, middleware and util.
 *
 * This is the cheapest guard against the whole class of "it only breaks when
 * someone hits that endpoint" defects this codebase has produced:
 *   • `const jwt = require(...)` inside an ES module — a ReferenceError that
 *     made /auth/verify always report a valid token as invalid;
 *   • `router.get('/staff/:id/aadhaar/:side?')` — Express 5 throws while
 *     BUILDING the router, so the whole app fails to boot;
 *   • a renamed or deleted export that only a rarely-taken branch references.
 *
 * Routers are the important half: importing one constructs every path, so a
 * malformed pattern fails here rather than in production.
 */
const filesIn = (dir) => {
  try {
    return readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith('.js'))
      .map((f) => `${dir}/${f}`);
  } catch {
    return [];
  }
};

const MODULES = [...filesIn('routes'), ...filesIn('middleware'), ...filesIn('utils')];

test('every route, middleware and util imports cleanly', async () => {
  assert.ok(MODULES.length > 20, `expected to find modules, got ${MODULES.length}`);

  const failures = [];
  for (const rel of MODULES) {
    try {
      await import(pathToFileURL(join(ROOT, rel)).href);
    } catch (err) {
      failures.push(`${rel}: ${err.message.split('\n')[0]}`);
    }
  }

  assert.deepEqual(failures, [], `modules failed to import:\n  ${failures.join('\n  ')}`);
});

test('the Express app builds with every router mounted', async () => {
  const { default: app } = await import(pathToFileURL(join(ROOT, 'app.js')).href);
  assert.equal(typeof app, 'function', 'app.js must export an Express app');
});
