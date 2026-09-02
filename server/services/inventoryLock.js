// ── The booking critical section ─────────────────────────────────────────────
//
// Every reservation path in this app has the same shape:
//
//     is the room / category free?   →   ...   →   save the booking
//
// which is a check-then-act race. Two guests clicking "Book" in the same second
// both see room 101 free, and both bookings are written. The front desk finds
// out at 9pm when the second guest arrives.
//
// This module makes that window atomic. Two layers, because the app may run as
// more than one process:
//
//   1. An in-process queue, so callers inside ONE node process are serialised
//      for free — no database round-trip, no polling, and no thundering herd
//      hammering a shared-tier Atlas cluster when 100 requests arrive at once.
//   2. A lock document in the tenant's own database, so a second process (a
//      pm2 cluster worker, a second VPS) is excluded too. Because layer 1 has
//      already reduced each process to a single contender, the database sees at
//      most one waiter per process rather than one per request.
//
// The section it guards must stay SHORT: the availability queries and the
// insert, nothing else. Pricing, payment verification, guest upserts and number
// generation all belong outside it.

import { randomUUID } from 'crypto';

import InventoryLock from '../models/InventoryLock.js';
import { getCurrentTenant } from '../db/tenantContext.js';

// How long a holder may keep the lock before another process may take it over.
// Generous: it is a crash guard, not a timeout for normal work. Being taken
// over early is the one way this loses mutual exclusion, so it is set far above
// how long the section actually takes (a few queries and one insert).
const DEFAULT_TTL_MS = 30_000;

// How long a caller waits before giving up. Must stay under the client's own
// request timeout so the guest sees a clear "try again" rather than a hang.
const DEFAULT_WAIT_MS = 15_000;

export class InventoryBusyError extends Error {
  constructor(message = 'Another booking is being confirmed right now. Please try again in a moment.') {
    super(message);
    this.name = 'InventoryBusyError';
    this.status = 503;
  }
}

const tenantSlug = () => {
  try {
    return getCurrentTenant()?.slug || 'base';
  } catch {
    return 'base';
  }
};



// setTimeout keeps the event loop alive, and a lock wait must never be the
// reason a process refuses to exit.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref?.());

// ── Layer 1: in-process serialisation ────────────────────────────────────────
// key → a promise that settles when the last queued caller has finished.
const queues = new Map();

const enqueue = (key, fn, { maxHoldMs, deadline }) => {
  const previous = queues.get(key) || Promise.resolve();

  const turn = async () => {
    // Our turn came, but too late to be worth taking: the caller has been
    // waiting longer than it agreed to. Give up here rather than starting a
    // section whose result nobody is still waiting for.
    if (Date.now() >= deadline) throw new InventoryBusyError();
    return fn();
  };

  // `then(turn, turn)` so one caller's failure never strands the queue behind it.
  const run = previous.then(turn, turn);

  // The queue advances when the holder finishes OR when its hold time is up.
  // Without that ceiling a section that never settles -- a stalled connection,
  // a throttled cluster -- would park every later request in this process
  // forever, since an in-process wait has no database timeout to rescue it.
  // maxHoldMs matches the database lock's own expiry, so both layers agree on
  // how long exclusivity can possibly last.
  const settled = run.then(
    () => {},
    () => {}
  );
  const tail = Promise.race([settled, sleep(maxHoldMs)]);
  queues.set(key, tail);
  // Don't leak a Map entry per key forever; drop it once nobody is waiting.
  settled.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
};

/** Callers currently queued for a key. Tests assert the queue drains. */
export const pendingLockKeys = () => [...queues.keys()];

// ── Layer 2: the database lock ───────────────────────────────────────────────
//
// The filter matches only a lock that has EXPIRED, so a live lock cannot be
// stolen. When it does not match, upsert tries to insert `_id` afresh and
// MongoDB rejects it with a duplicate key — that rejection IS the "held by
// someone else" signal, and it is atomic in a way a read-then-write is not.
const acquire = async (key, owner, ttlMs, waitMs) => {
  const deadline = Date.now() + waitMs;
  let backoff = 25;

  for (;;) {
    const now = new Date();
    try {
      await InventoryLock.findOneAndUpdate(
        { _id: key, expiresAt: { $lte: now } },
        { $set: { owner, expiresAt: new Date(now.getTime() + ttlMs) } },
        { upsert: true }
      );
      return;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      if (Date.now() >= deadline) throw new InventoryBusyError();
      // Jittered, so two processes that collide do not collide again in step.
      await sleep(backoff + Math.random() * backoff);
      backoff = Math.min(backoff * 2, 250);
    }
  }
};

// Scoped by owner: if our lock expired and someone else took it over, this
// deletes nothing rather than cutting the new holder's section short.
const release = async (key, owner) => {
  try {
    await InventoryLock.deleteOne({ _id: key, owner });
  } catch (err) {
    // A failed release is survivable — the lock expires on its own. Failing the
    // booking that already succeeded would not be.
    console.error('[inventoryLock] could not release', key, '-', err.message);
  }
};

/**
 * Run `fn` with exclusive access to the hotel's room inventory.
 *
 * One key per tenant by default. Finer keys (per room type) would allow more
 * parallelism, but a booking consumes both a specific room AND its category's
 * count, a group block spans several categories at once, and a banquet hold can
 * take any room — so callers would have to hold several locks in a consistent
 * order to stay deadlock-free. At one hotel's booking volume that trade is not
 * worth making: the section runs in milliseconds and real contention is rare.
 */
export const withInventoryLock = (fn, { key = 'inventory', ttlMs = DEFAULT_TTL_MS, waitMs = DEFAULT_WAIT_MS } = {}) => {
  const scoped = `${tenantSlug()}:${key}`;
  // One deadline for the WHOLE wait -- queueing behind callers in this process
  // and waiting on the database lock -- so a request cannot hang by spending its
  // budget twice.
  const deadline = Date.now() + waitMs;

  return enqueue(scoped, async () => {
    const owner = randomUUID();
    await acquire(scoped, owner, ttlMs, Math.max(0, deadline - Date.now()));
    try {
      return await fn();
    } finally {
      await release(scoped, owner);
    }
  }, { maxHoldMs: ttlMs, deadline });
};

export default withInventoryLock;
