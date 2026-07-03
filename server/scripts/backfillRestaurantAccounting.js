/**
 * One-time backfill: post every already-Completed restaurant order (table,
 * room-service and POS) into the AccountingEntry ledger as "Restaurant Revenue".
 *
 * Going forward, createOrder/updateOrder keep the ledger in sync automatically;
 * this seeds the history that predates that wiring so the finance reports and
 * the dashboard's revenue reflect restaurant earnings from day one.
 *
 * Each posting is idempotent (keyed by sourceType+sourceId), so running this
 * more than once never duplicates a ledger line.
 *
 * Run:  node server/scripts/backfillRestaurantAccounting.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';
// Registered so room-service orders can resolve their guest (Booking→Room)
// during the sync — populate('roomId') needs both schemas present.
import Booking from '../models/Booking.js'; // eslint-disable-line no-unused-vars
import Room from '../models/Room.js'; // eslint-disable-line no-unused-vars
import { syncRestaurantOrderIncome } from '../services/accountingSync.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel';

(async () => {
  await mongoose.connect(MONGO_URI);

  const orders = await Order.find({ status: 'Completed' }).lean();
  let posted = 0;
  for (const order of orders) {
    await syncRestaurantOrderIncome(order);
    posted += 1;
  }

  console.log(`Backfilled ${posted} completed restaurant order(s) into the accounting ledger.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Restaurant accounting backfill failed:', err);
  process.exit(1);
});
