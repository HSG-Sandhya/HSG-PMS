// Tentative-hold auto-release.
//
// A "Tentative" booking is an unconfirmed hold. Left alone it would block the
// room forever, so this sweep cancels holds that have sat past the configured
// window (Settings → Operations → Front desk → holdExpiryHours) and frees any
// room they were holding — unless a guest is actually checked into it.
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { getOps } from '../config/operationalConfig.js';

export const releaseExpiredHolds = async () => {
  const { frontDesk } = await getOps();
  const hours = Number(frontDesk.holdExpiryHours) || 0;
  if (hours <= 0) return { released: 0 }; // 0 = auto-release disabled

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const expired = await Booking.find(
    { bookingStatus: 'Tentative', createdAt: { $lt: cutoff } },
    { _id: 1, roomId: 1 },
  ).lean();
  if (!expired.length) return { released: 0 };

  const ids = expired.map((b) => b._id);
  // updateMany bypasses per-doc save hooks — fine here, we only flip status.
  await Booking.updateMany({ _id: { $in: ids } }, { $set: { bookingStatus: 'Cancelled' } });

  // Free each held room, unless someone is actually checked into it.
  const roomIds = [...new Set(expired.filter((b) => b.roomId).map((b) => String(b.roomId)))];
  for (const rid of roomIds) {
    const occupied = await Booking.exists({ roomId: rid, bookingStatus: 'Checked-In' });
    if (!occupied) await Room.findByIdAndUpdate(rid, { status: 'available', isAvailable: true });
  }
  return { released: ids.length };
};

// Run the sweep once now, then on a fixed interval. Returns the timer handle.
export const scheduleHoldExpirySweep = (intervalMinutes = 30) => {
  const run = () =>
    releaseExpiredHolds()
      .then((r) => { if (r.released) console.log(`[holdExpiry] released ${r.released} expired hold(s)`); })
      .catch((e) => console.error('[holdExpiry] sweep failed:', e.message));
  run();
  const timer = setInterval(run, Math.max(1, intervalMinutes) * 60 * 1000);
  timer.unref?.(); // don't keep the process alive just for the sweep
  return timer;
};
