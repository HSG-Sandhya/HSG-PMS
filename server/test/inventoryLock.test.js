import test from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, skipReason } from './helpers/memoryDb.js';
import { withInventoryLock, InventoryBusyError, pendingLockKeys } from '../services/inventoryLock.js';
import InventoryLock from '../models/InventoryLock.js';
import { runWithTenant } from '../db/tenantContext.js';

const ready = await startDb();

test('inventory lock', { skip: ready ? false : skipReason }, async (t) => {
  t.after(async () => { await stopDb(); });
  t.beforeEach(async () => { await clearDb(); });

  await t.test('only one caller is inside the section at a time', async () => {
    let inside = 0;
    let maxInside = 0;

    await Promise.all(
      Array.from({ length: 50 }, () =>
        withInventoryLock(async () => {
          inside += 1;
          maxInside = Math.max(maxInside, inside);
          // Yield, so an unserialised implementation would definitely interleave.
          await new Promise((r) => setTimeout(r, 1));
          inside -= 1;
        }),
      ),
    );

    assert.equal(maxInside, 1, 'two callers were inside the critical section together');
    assert.equal(inside, 0);
  });

  await t.test('a read-modify-write inside the lock never loses an update', async () => {
    // The exact shape of the booking bug: read a value, pause, write it back.
    let counter = 0;
    await Promise.all(
      Array.from({ length: 40 }, () =>
        withInventoryLock(async () => {
          const seen = counter;
          await new Promise((r) => setTimeout(r, 0));
          counter = seen + 1;
        }),
      ),
    );
    assert.equal(counter, 40, 'an update was lost — the section is not exclusive');
  });

  await t.test('a throwing caller releases the lock for the next one', async () => {
    await assert.rejects(withInventoryLock(async () => { throw new Error('boom'); }), /boom/);
    assert.equal(await withInventoryLock(async () => 'still works'), 'still works');
  });

  await t.test('the lock document is cleaned up, not left behind', async () => {
    await withInventoryLock(async () => {
      assert.equal(await InventoryLock.countDocuments(), 1, 'the lock should exist while held');
    });
    assert.equal(await InventoryLock.countDocuments(), 0, 'the lock should be gone once released');
  });

  await t.test('the queue drains, so the key map does not grow forever', async () => {
    await Promise.all(Array.from({ length: 5 }, () => withInventoryLock(async () => {})));
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(pendingLockKeys(), []);
  });

  await t.test('hotels do not block each other', async () => {
    const order = [];
    const slow = runWithTenant({ tenant: { slug: 'hotel-a' } }, () =>
      withInventoryLock(async () => {
        await new Promise((r) => setTimeout(r, 60));
        order.push('a');
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const fast = runWithTenant({ tenant: { slug: 'hotel-b' } }, () =>
      withInventoryLock(async () => { order.push('b'); }),
    );

    await Promise.all([slow, fast]);
    assert.deepEqual(order, ['b', 'a'], 'one hotel had to wait for another hotel');
  });

  // ── Layer 2: the database lock, which is what excludes a SECOND process ────
  // Written straight into the collection, because a lock held by another
  // process is exactly what this session cannot produce for itself.
  await t.test('a lock held by another process is honoured', async () => {
    await InventoryLock.create({
      _id: 'base:cross-process',
      owner: 'some-other-process',
      expiresAt: new Date(Date.now() + 5_000),
    });

    let ran = false;
    await assert.rejects(
      withInventoryLock(async () => { ran = true; }, { key: 'cross-process', waitMs: 300 }),
      InventoryBusyError,
    );
    assert.equal(ran, false, 'the section ran while another process held the lock');
  });

  await t.test('a lock left behind by a crashed process is taken over, not waited on forever', async () => {
    await InventoryLock.create({
      _id: 'base:crashed',
      owner: 'a-process-that-died',
      expiresAt: new Date(Date.now() - 1_000), // already expired
    });

    assert.equal(
      await withInventoryLock(async () => 'taken over', { key: 'crashed' }),
      'taken over',
    );
  });

  await t.test('a caller gives up rather than hanging when the holder stalls', async () => {
    // A section that never settles: a stalled connection, a throttled cluster.
    const stalled = withInventoryLock(() => new Promise(() => {}), { key: 'stall', ttlMs: 120 });

    const started = Date.now();
    await assert.rejects(
      withInventoryLock(async () => 'never', { key: 'stall', ttlMs: 120, waitMs: 40 }),
      InventoryBusyError,
      'a request queued behind a stalled section must not wait forever',
    );
    assert.ok(Date.now() - started < 2_000, 'the wait was not bounded');
    assert.ok(stalled); // never resolves; the process exits regardless
  });
});
