import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';
import { syncRestaurantOrderIncome } from '../services/accountingSync.js';

dotenv.config();

// One-off backfill: re-post the accounting income entry for every completed
// walk-in restaurant order (counter POS + dine-in table) so historical entries
// pick up the new rule — walk-in food is recorded GST-free; only room-service
// food carries GST. Idempotent: syncRestaurantOrderIncome upserts by source, so
// running it again just refreshes the same rows. Room orders are untouched.
async function run() {
  try {
    console.log('Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');

    const orders = await Order.find({
      status: 'Completed',
      orderType: { $in: ['pos', 'table'] },
    });
    console.log(`Re-syncing ${orders.length} completed walk-in order(s)…`);

    let done = 0;
    for (const order of orders) {
      await syncRestaurantOrderIncome(order);
      done += 1;
    }
    console.log(`✅ Re-synced ${done} order(s) — walk-in POS/table food now posts GST-free.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
