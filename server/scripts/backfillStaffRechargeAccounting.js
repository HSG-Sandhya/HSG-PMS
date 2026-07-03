/**
 * One-time backfill: post every already-successful staff phone recharge into the
 * AccountingEntry ledger as a "Staff Phone Recharge" expense against the staff
 * member it was done for.
 *
 * Going forward, createStaffRecharge / updateRechargeStatus keep the ledger in
 * sync automatically; this seeds the recharges that predate that wiring so the
 * finance reports and P&L reflect this staff cost from day one.
 *
 * Each posting is idempotent (keyed by sourceType+sourceId), so running this
 * more than once never duplicates a ledger line.
 *
 * Run:  node server/scripts/backfillStaffRechargeAccounting.js   (from server/)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import StaffRecharge from '../models/StaffRecharge.js';
// Registered so recharge.staff can populate the staff member's name during sync.
import User from '../models/User.js'; // eslint-disable-line no-unused-vars
import { syncStaffRechargeExpense } from '../services/accountingSync.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel';

(async () => {
  await mongoose.connect(MONGO_URI);

  const recharges = await StaffRecharge.find({ status: 'success' })
    .populate('staff', 'firstName lastName')
    .lean();
  let posted = 0;
  for (const recharge of recharges) {
    await syncStaffRechargeExpense(recharge);
    posted += 1;
  }

  console.log(`Backfilled ${posted} successful staff recharge(s) into the accounting ledger.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Staff recharge accounting backfill failed:', err);
  process.exit(1);
});
