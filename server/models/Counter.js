import mongoose from 'mongoose';

import { registerModel } from '../db/modelRegistry.js';

/**
 * Atomic sequence counters, one document per numbering scope.
 *
 * `_id` is the scope key ("invoice:HSG", "order:260902", …) and `seq` is the
 * last number handed out. All allocation goes through a single `$inc`, which
 * MongoDB applies atomically, so two simultaneous requests get two different
 * numbers instead of both reading the same "latest" and racing to save it.
 *
 * Tenant-bound like every other model, so each hotel counts independently.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true }
);

export default registerModel('Counter', counterSchema);
