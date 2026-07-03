/**
 * One-time migration for the reserved-vs-checked-in split.
 *
 * Before this change, a booking's "Confirmed" status doubled as "checked in",
 * so a Confirmed booking whose stay covers today represented an in-house guest.
 * This backfills checkedIn=true for exactly those bookings, so existing in-house
 * guests stay marked present (and their rooms occupied). Future-dated Confirmed
 * reservations are left as checkedIn=false — they're reservations, not arrivals.
 *
 * Safe to run multiple times (idempotent).
 *
 * Run:  node server/scripts/backfillCheckedIn.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from '../models/Booking.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel';

(async () => {
  await mongoose.connect(MONGO_URI);
  const now = new Date();

  const res = await Booking.updateMany(
    {
      bookingStatus: 'Confirmed',
      checkedIn: { $ne: true },
      checkIn: { $lte: now },
      checkOut: { $gte: now },
    },
    [
      { $set: { checkedIn: true, checkedInAt: { $ifNull: ['$checkedInAt', '$checkIn'] } } },
    ],
  );

  console.log(`Backfilled checkedIn=true on ${res.modifiedCount} in-house booking(s).`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
