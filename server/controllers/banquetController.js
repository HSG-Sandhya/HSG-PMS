import mongoose from 'mongoose';
import BanquetHall from '../models/BanquetHall.js';
import BanquetBooking from '../models/BanquetBooking.js';
import Housekeeping from '../models/Housekeeping.js';
import EventPackage from '../models/EventPackage.js';
import CateringPackage from '../models/CateringPackage.js';
import DecorationPackage from '../models/DecorationPackage.js';
import UtensilItem from '../models/UtensilItem.js';
import { syncBanquetPayments, removeEntriesBySource } from '../services/accountingSync.js';

// ── Utensil stock helpers ─────────────────────────────────────────────────────
// A booking still "holds" its utensils while it is Pending or Confirmed; once it
// is Completed or Cancelled the items are returned, so availability is derived
// from active bookings rather than a mutable counter (self-heals on edits).
const ACTIVE_UTENSIL_STATUSES = ['Pending', 'Confirmed'];

// Quantity of each utensil item currently reserved by active bookings, keyed by
// itemId string. `excludeBookingId` drops the booking being edited so its own
// current reservation doesn't count against what it's allowed to take.
const reservedUtensilQuantities = async (excludeBookingId = null) => {
  const match = { status: { $in: ACTIVE_UTENSIL_STATUSES }, 'utensilItems.0': { $exists: true } };
  if (excludeBookingId) {
    try { match._id = { $ne: new mongoose.Types.ObjectId(String(excludeBookingId)) }; } catch { /* ignore bad id */ }
  }
  const rows = await BanquetBooking.aggregate([
    { $match: match },
    { $unwind: '$utensilItems' },
    { $match: { 'utensilItems.itemId': { $ne: null } } },
    { $group: { _id: '$utensilItems.itemId', qty: { $sum: '$utensilItems.quantity' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.qty]));
};

// Throws an Error (message names the short item) when any requested utensil line
// exceeds what's still in stock. Lines without an itemId (ad-hoc/custom) skip the
// check since they aren't tracked against owned stock.
const assertUtensilStock = async (utensilItems = [], excludeBookingId = null) => {
  const lines = (utensilItems || []).filter((l) => l && l.itemId && Number(l.quantity) > 0);
  if (lines.length === 0) return;
  const [items, reserved] = await Promise.all([
    UtensilItem.find({ _id: { $in: lines.map((l) => l.itemId) } }).lean(),
    reservedUtensilQuantities(excludeBookingId),
  ]);
  const byId = Object.fromEntries(items.map((i) => [String(i._id), i]));
  for (const line of lines) {
    const item = byId[String(line.itemId)];
    if (!item) continue; // deleted item — leave it to the ad-hoc cost
    const available = (Number(item.quantityTotal) || 0) - (reserved[String(line.itemId)] || 0);
    if (Number(line.quantity) > available) {
      const err = new Error(`Only ${Math.max(0, available)} ${item.unit || 'unit'}(s) of "${item.name}" available (you requested ${line.quantity}).`);
      err.statusCode = 409;
      throw err;
    }
  }
};

// ── Slot / date-range availability ────────────────────────────────────────────
// The venue can run different floors/halls in parallel, so a booking only clashes
// with another ACTIVE booking when their date ranges overlap AND they use the
// same floor/hall (duration-priced events share a notional 'duration' main-hall
// slot). Rooms/floors picked with no real selection ('none') don't reserve a slot.
const FRIENDLY_FLOOR = { first: 'First floor', second: 'Grand Hall (2nd floor)', third: 'Third floor', fourth: 'Crystal Hall (4th floor)', duration: 'the hall' };
const floorTokens = (b) => new Set((b?.floorSelection || []).filter((f) => f && f !== 'none'));

const fmtRange = (start, end) => {
  const o = { day: '2-digit', month: 'short', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-IN', o);
  const e = new Date(end).toLocaleDateString('en-IN', o);
  return s === e ? s : `${s} – ${e}`;
};

// Returns the first conflicting booking, or null. Blank/invalid dates skip the check.
const findSlotConflict = async (data, excludeId = null) => {
  if (!data?.eventDate) return null;
  const start = new Date(data.eventDate);
  const end = data.endDate ? new Date(data.endDate) : start;
  if (Number.isNaN(start.getTime())) return null;
  const wanted = floorTokens(data);
  if (wanted.size === 0) return null; // no real slot claimed → nothing to clash with

  const q = { status: { $nin: ['Cancelled'] }, eventDate: { $lte: end } };
  if (excludeId) q._id = { $ne: excludeId };
  const candidates = await BanquetBooking.find(q)
    .select('eventDate endDate floorSelection customerName eventType')
    .lean();

  for (const c of candidates) {
    const cStart = new Date(c.eventDate);
    const cEnd = c.endDate ? new Date(c.endDate) : cStart;
    if (cEnd < start || cStart > end) continue; // no true date overlap
    const shared = [...wanted].find((t) => floorTokens(c).has(t));
    if (shared) {
      const err = new Error(`${FRIENDLY_FLOOR[shared] || 'This slot'} is already booked for ${fmtRange(cStart, cEnd)}${c.customerName ? ` (${c.customerName}${c.eventType ? ` — ${c.eventType}` : ''})` : ''}.`);
      err.statusCode = 409;
      throw err;
    }
  }
  return null;
};

export const getAllHalls = async (_req, res) => {
  try {
    const halls = await BanquetHall.find().sort({ name: 1 });
    res.json({ success: true, data: halls, message: 'Banquet halls fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banquet halls', error: error.message });
  }
};

export const createHall = async (req, res) => {
  try {
    const hall = new BanquetHall(req.body);
    await hall.save();
    res.status(201).json({ success: true, data: hall, message: 'Banquet hall created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating banquet hall', error: error.message });
  }
};

export const getAllBookings = async (_req, res) => {
  try {
    const bookings = await BanquetBooking.find()
      .populate('hallId', 'name capacity')
      .sort({ eventDate: -1 });
    res.json({ success: true, data: bookings, message: 'Banquet bookings fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banquet bookings', error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await BanquetBooking.findById(req.params.id)
      .populate('hallId', 'name capacity area pricePerHour');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Banquet booking not found' });
    }
    res.json({ success: true, data: booking, message: 'Banquet booking retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching banquet booking', error: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    if (!['Cancelled'].includes(req.body.status)) {
      await findSlotConflict(req.body); // block a clashing date/hall slot
    }
    await assertUtensilStock(req.body.utensilItems); // block over-booking of utensils
    const booking = new BanquetBooking(req.body);
    await booking.save();
    await syncBanquetPayments(booking); // mirror any advance payments into accounting
    res.status(201).json({ success: true, data: booking, message: 'Banquet booking created successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Error creating banquet booking', error: error.message });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const existing = await BanquetBooking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banquet booking not found' });
    }
    const prevStatus = existing.status;

    // Utensils: only enforce stock while the booking stays active — a Completed
    // or Cancelled booking returns everything, so no need to block on it.
    const nextStatus = req.body.status || existing.status;
    if (ACTIVE_UTENSIL_STATUSES.includes(nextStatus)) {
      await assertUtensilStock(req.body.utensilItems ?? existing.utensilItems, existing._id);
    }

    // Block a date/hall clash — but ONLY when the dates or floor actually change,
    // so editing catering/payment on a booking that already overlaps another
    // (pre-existing) one isn't wrongly rejected.
    const normTime = (d) => (d ? new Date(d).getTime() : 0);
    const datesChanged =
      (req.body.eventDate !== undefined && normTime(req.body.eventDate) !== normTime(existing.eventDate)) ||
      (req.body.endDate !== undefined && normTime(req.body.endDate) !== normTime(existing.endDate));
    const sortedFloors = (f) => JSON.stringify([...(f || [])].map(String).sort());
    const floorsChanged = req.body.floorSelection !== undefined &&
      sortedFloors(req.body.floorSelection) !== sortedFloors(existing.floorSelection);
    if (nextStatus !== 'Cancelled' && (datesChanged || floorsChanged)) {
      await findSlotConflict({
        eventDate: req.body.eventDate ?? existing.eventDate,
        endDate: req.body.endDate ?? existing.endDate,
        floorSelection: req.body.floorSelection ?? existing.floorSelection,
      }, existing._id);
    }

    // Assign the changes and save() — NOT findByIdAndUpdate — so the pre-save
    // hook re-derives advanceAmount / remainingAmount / paymentStatus. Otherwise
    // editing a booking to add an advance updates the amount but leaves the
    // payment status stuck at "Pending".
    Object.assign(existing, req.body);
    await existing.save();
    const booking = await existing.populate({ path: 'hallId', select: 'name capacity area pricePerHour' });

    // When the event is completed, queue a cleaning task for the hall
    const becameCompleted = booking.status === 'Completed' && prevStatus !== 'Completed';
    const hallId = booking.hallId?._id || booking.hallId;
    if (becameCompleted && hallId) {
      try {
        await Housekeeping.ensureCleaningTask({
          hallId,
          source: 'banquet_checkout',
          notes: 'Banquet hall requires cleaning after the event.',
        });
      } catch (taskError) {
        console.error('Error creating banquet hall housekeeping task:', taskError);
      }
    }

    await syncBanquetPayments(booking); // reconcile the payments ledger into accounting
    res.json({ success: true, data: booking, message: 'Banquet booking updated successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Error updating banquet booking', error: error.message });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const booking = await BanquetBooking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Banquet booking not found' });
    }
    await removeEntriesBySource('banquet_booking', req.params.id); // drop linked income entries
    res.json({ success: true, message: 'Banquet booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting banquet booking', error: error.message });
  }
};

export const getReports = async (_req, res) => {
  try {
    const totalBookings = await BanquetBooking.countDocuments();
    const totalRevenue = await BanquetBooking.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    res.json({
      success: true,
      data: {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        reportDate: new Date(),
      },
      message: 'Banquet report generated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating banquet report', error: error.message });
  }
};

// ── Event Packages (reusable hall + decor + catering bundles) ───────────────

export const getAllPackages = async (_req, res) => {
  try {
    const packages = await EventPackage.find().populate('hallId', 'name').sort({ name: 1 });
    res.json({ success: true, data: packages, message: 'Packages fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching packages', error: error.message });
  }
};

export const createPackage = async (req, res) => {
  try {
    const pkg = new EventPackage(req.body);
    await pkg.save();
    res.status(201).json({ success: true, data: pkg, message: 'Package created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating package', error: error.message });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const pkg = await EventPackage.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, data: pkg, message: 'Package updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating package', error: error.message });
  }
};

export const deletePackage = async (req, res) => {
  try {
    const pkg = await EventPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting package', error: error.message });
  }
};

// ── Catering Packages (reusable per-plate menu bundles) ─────────────────────

export const getAllCateringPackages = async (_req, res) => {
  try {
    const packages = await CateringPackage.find().sort({ name: 1 });
    res.json({ success: true, data: packages, message: 'Catering packages fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching catering packages', error: error.message });
  }
};

export const createCateringPackage = async (req, res) => {
  try {
    const pkg = new CateringPackage(req.body);
    await pkg.save();
    res.status(201).json({ success: true, data: pkg, message: 'Catering package created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating catering package', error: error.message });
  }
};

export const updateCateringPackage = async (req, res) => {
  try {
    const pkg = await CateringPackage.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Catering package not found' });
    res.json({ success: true, data: pkg, message: 'Catering package updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating catering package', error: error.message });
  }
};

export const deleteCateringPackage = async (req, res) => {
  try {
    const pkg = await CateringPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Catering package not found' });
    res.json({ success: true, message: 'Catering package deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting catering package', error: error.message });
  }
};

// ── Decoration Packages (reusable flat-price décor bundles) ─────────────────

export const getAllDecorationPackages = async (_req, res) => {
  try {
    const packages = await DecorationPackage.find().sort({ name: 1 });
    res.json({ success: true, data: packages, message: 'Decoration packages fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching decoration packages', error: error.message });
  }
};

export const createDecorationPackage = async (req, res) => {
  try {
    const pkg = new DecorationPackage(req.body);
    await pkg.save();
    res.status(201).json({ success: true, data: pkg, message: 'Decoration package created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating decoration package', error: error.message });
  }
};

export const updateDecorationPackage = async (req, res) => {
  try {
    const pkg = await DecorationPackage.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Decoration package not found' });
    res.json({ success: true, data: pkg, message: 'Decoration package updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating decoration package', error: error.message });
  }
};

export const deleteDecorationPackage = async (req, res) => {
  try {
    const pkg = await DecorationPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Decoration package not found' });
    res.json({ success: true, message: 'Decoration package deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting decoration package', error: error.message });
  }
};

// ── Utensil / cookware inventory (rented to self-cooking guests) ─────────────
// Each item carries a live `reserved`/`available` count derived from active
// bookings, so the picker can show what's left and block over-booking.
// `?excludeBooking=<id>` frees the booking being edited from its own count.
export const getAllUtensilItems = async (req, res) => {
  try {
    const [items, reserved] = await Promise.all([
      UtensilItem.find().sort({ name: 1 }).lean(),
      reservedUtensilQuantities(req.query.excludeBooking || null),
    ]);
    const data = items.map((it) => {
      const used = reserved[String(it._id)] || 0;
      return { ...it, reserved: used, available: Math.max(0, (Number(it.quantityTotal) || 0) - used) };
    });
    res.json({ success: true, data, message: 'Utensil items fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching utensil items', error: error.message });
  }
};

export const createUtensilItem = async (req, res) => {
  try {
    const item = new UtensilItem(req.body);
    await item.save();
    res.status(201).json({ success: true, data: item, message: 'Utensil item created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating utensil item', error: error.message });
  }
};

export const updateUtensilItem = async (req, res) => {
  try {
    const item = await UtensilItem.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Utensil item not found' });
    res.json({ success: true, data: item, message: 'Utensil item updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating utensil item', error: error.message });
  }
};

export const deleteUtensilItem = async (req, res) => {
  try {
    const item = await UtensilItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Utensil item not found' });
    res.json({ success: true, message: 'Utensil item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting utensil item', error: error.message });
  }
};

// ── Advance collection — record a payment against a booking ──────────────────
export const addBookingPayment = async (req, res) => {
  try {
    const { amount, method = 'Cash', reference = '', note = '', receivedBy = '', date } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: 'A positive payment amount is required' });
    }
    const booking = await BanquetBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Banquet booking not found' });

    booking.payments.push({ amount: amt, method, reference, note, receivedBy, date: date ? new Date(date) : new Date() });
    // pre-save recomputes advanceAmount / remainingAmount / paymentStatus.
    await booking.save();
    await syncBanquetPayments(booking); // post the new receipt as accounting income

    res.status(201).json({ success: true, data: booking, message: 'Payment recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error recording payment', error: error.message });
  }
};

export const deleteBookingPayment = async (req, res) => {
  try {
    const booking = await BanquetBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Banquet booking not found' });
    booking.payments = booking.payments.filter((p) => String(p._id) !== String(req.params.paymentId));
    await booking.save();
    await syncBanquetPayments(booking); // prune the removed receipt from accounting
    res.json({ success: true, data: booking, message: 'Payment removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing payment', error: error.message });
  }
};

// ── Event calendar — bookings within a month, grouped by day ────────────────
export const getMonthEvents = async (req, res) => {
  try {
    const month = parseInt(req.params.month, 10); // 1-12
    const year = parseInt(req.params.year, 10);
    if (Number.isNaN(month) || Number.isNaN(year) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month or year' });
    }
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await BanquetBooking.find({
      $or: [
        { eventDate: { $gte: start, $lte: end } },
        { endDate: { $gte: start, $lte: end } },
        { $and: [{ eventDate: { $lte: start } }, { endDate: { $gte: end } }] },
      ],
      status: { $nin: ['Cancelled'] },
    }).populate('hallId', 'name').sort({ eventDate: 1, startTime: 1 });

    res.json({ success: true, data: bookings, message: 'Month events fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching month events', error: error.message });
  }
};
