import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Reconcile rooms whose status disagrees with the housekeeping board.
 *
 * The board derives a room tile from the room's newest OPEN task, not from
 * `room.status` — a Pending task always wins. Until the roomController fix,
 * setting a room to "available" left its open tasks standing, so rooms could
 * sit permanently as "Available" on the Rooms page and "Dirty" on the board.
 * This script cleans up the records left behind by that.
 *
 * It reports first and changes nothing unless you pick a direction, because
 * only you know which side is telling the truth:
 *
 *   --close-tasks    The rooms really are clean; the board is stale.
 *                    Cancels their open tasks. Tiles go green.
 *
 *   --mark-dirty     The rooms really do need cleaning; the Rooms page is
 *                    wrong. Sets those rooms to `cleaning`. Tiles stay red and
 *                    the rooms stop being offered as ready.
 *
 * Occupied rooms are never touched — a guest is in them, and neither answer
 * applies.
 *
 *   node scripts/reconcile-room-housekeeping.js                # report only
 *   node scripts/reconcile-room-housekeeping.js --close-tasks
 *   node scripts/reconcile-room-housekeeping.js --mark-dirty
 */

const CLOSE_TASKS = process.argv.includes('--close-tasks');
const MARK_DIRTY = process.argv.includes('--mark-dirty');

if (CLOSE_TASKS && MARK_DIRTY) {
  console.error('Pick one: --close-tasks or --mark-dirty, not both.');
  process.exit(1);
}

const OPEN = ['Pending', 'In Progress'];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log(`✅ Connected${CLOSE_TASKS || MARK_DIRTY ? '' : ' (REPORT ONLY — no writes)'}\n`);

  const rooms = await db.collection('rooms').find({}, { projection: { roomNumber: 1, status: 1 } }).toArray();
  const openTasks = await db.collection('housekeepings')
    .find({ status: { $in: OPEN } }, { projection: { roomId: 1, taskType: 1, status: 1, source: 1, scheduledFor: 1 } })
    .toArray();

  // Newest open task per room — the same rule the board's deriveRoomStatus uses.
  const taskByRoom = new Map();
  for (const t of openTasks) {
    if (!t.roomId) continue;
    const key = String(t.roomId);
    const prev = taskByRoom.get(key);
    if (!prev || new Date(t.scheduledFor || 0) > new Date(prev.scheduledFor || 0)) {
      taskByRoom.set(key, t);
    }
  }

  // Disagreements: the room claims to be ready, the board says there's work.
  // Maintenance tasks are excluded — those legitimately mean out-of-order and
  // are not what "dirty" describes.
  const conflicts = rooms.filter((r) => {
    if (r.status !== 'available') return false;
    const t = taskByRoom.get(String(r._id));
    return !!t && t.taskType !== 'Maintenance';
  });

  // The mirror case: room says it needs cleaning, but no task exists to do it.
  // These are the ones lost to the invalid `source` enum value.
  const orphanedCleaning = rooms.filter(
    (r) => r.status === 'cleaning' && !taskByRoom.has(String(r._id)),
  );

  console.log(`Rooms: ${rooms.length}   open tasks: ${openTasks.length}\n`);

  console.log(`A) "Available" on Rooms, but has an open task (board shows Dirty): ${conflicts.length}`);
  for (const r of conflicts) {
    const t = taskByRoom.get(String(r._id));
    console.log(`   ${r.roomNumber}  task=${t.taskType} (${t.status}, source=${t.source || 'n/a'}, raised ${new Date(t.scheduledFor).toISOString().slice(0, 10)})`);
  }

  console.log(`\nB) "Cleaning" on Rooms, but NO task exists to action it: ${orphanedCleaning.length}`);
  for (const r of orphanedCleaning) {
    console.log(`   ${r.roomNumber}`);
  }

  if (!CLOSE_TASKS && !MARK_DIRTY) {
    console.log('\nNothing changed. Re-run with --close-tasks or --mark-dirty to resolve group A.');
    console.log('Group B is fixed by raising a task — the script does that with either flag.');
    await mongoose.disconnect();
    return;
  }

  // ── Resolve group A ──────────────────────────────────────────────────────
  if (conflicts.length) {
    const ids = conflicts.map((r) => r._id);
    if (CLOSE_TASKS) {
      const res = await db.collection('housekeepings').updateMany(
        { roomId: { $in: ids }, status: { $in: OPEN }, taskType: { $ne: 'Maintenance' } },
        { $set: { status: 'Cancelled', notes: 'Closed by reconciliation — the room was already marked available.' } },
      );
      console.log(`\n→ cancelled ${res.modifiedCount} stale task(s); ${conflicts.length} room(s) now read Clean`);
    } else {
      const res = await db.collection('rooms').updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'cleaning', isAvailable: false } },
      );
      console.log(`\n→ set ${res.modifiedCount} room(s) to "cleaning" to match their open tasks`);
    }
  } else {
    console.log('\n→ group A: nothing to resolve');
  }

  // ── Resolve group B: raise the missing task ──────────────────────────────
  if (orphanedCleaning.length) {
    const docs = orphanedCleaning.map((r) => ({
      roomId: r._id,
      taskType: 'Regular Cleaning',
      notes: 'Raised by reconciliation — the room was marked for cleaning but had no task.',
      priority: 'High',
      status: 'Pending',
      source: 'room_status_update',
      scheduledFor: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.collection('housekeepings').insertMany(docs);
    console.log(`→ raised ${docs.length} missing cleaning task(s)`);
  } else {
    console.log('→ group B: nothing to resolve');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
};

run().catch(async (err) => {
  console.error('❌ Reconciliation failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
