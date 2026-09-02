import mongoose from 'mongoose';

import { registerModel } from '../db/modelRegistry.js';

/**
 * A short-lived mutual-exclusion record, one document per lock key.
 *
 * Checking availability and then inserting a booking are two separate database
 * operations, and MongoDB has no "insert only if no other document overlaps
 * these dates" primitive — snapshot isolation inside a transaction does not
 * stop it either, because the conflict is a *phantom*: the row we are checking
 * for does not exist yet when we look. Two simultaneous requests can therefore
 * both find room 101 free and both save.
 *
 * A unique `_id`, however, IS atomic. Acquiring means upserting this document;
 * a second acquirer collides on the primary key and waits. That turns
 * check-then-insert into a genuine critical section.
 *
 * `expiresAt` exists so a process that dies mid-booking cannot wedge the desk
 * forever: the next acquirer takes over any lock whose expiry has passed. The
 * TTL index is only housekeeping — takeover does not depend on it, because
 * MongoDB's TTL monitor runs on its own schedule (up to a minute late).
 *
 * Tenant-bound like every other model, so hotels never block each other.
 */
const inventoryLockSchema = new mongoose.Schema(
  {
    _id: { type: String },
    // Who holds it. Release deletes by owner, so a caller whose lock already
    // expired and was taken over cannot delete the new holder's lock.
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, timestamps: true }
);

export default registerModel('InventoryLock', inventoryLockSchema);
