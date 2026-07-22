import EventQuotation from '../models/EventQuotation.js';
import BanquetBooking from '../models/BanquetBooking.js';
import InvoiceService from '../services/invoiceService.js';
import { renderEventQuotation } from '../services/invoiceTemplates/eventQuotation.js';
import { packageTotal, addOnTotal, resolveQuantity, isPerHead } from '../services/quotationPricing.js';
import { findSlotConflict } from './banquetController.js';

// Sales quotations for banquet enquiries. A quotation is a standalone proposal
// (no booking yet); once the client accepts one of the quoted packages it is
// converted into a BanquetBooking, which bills through the normal invoice path.

// Fields the server owns — a client must never be able to write these through
// the update endpoint, whether by hand or by echoing back a loaded document.
const SERVER_OWNED_FIELDS = [
  '_id', '__v', 'createdAt', 'updatedAt',
  'quotationNumber', 'status', 'acceptedPackageIndex', 'convertedBookingId', 'convertedAt',
];

// Statuses staff are allowed to set directly. 'Converted' is reached only by
// actually converting, so a stray value can't lock a quotation out of editing.
const CLIENT_SETTABLE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'];

// True when the quotation is tied to a booking that STILL EXISTS.
//
// A converted booking can be deleted afterwards (a cancelled event, or a test
// run). If we trusted convertedBookingId alone, the quotation would be stranded
// — not editable, not deletable and not re-convertible — so a dangling link is
// healed back to "Accepted" and the quotation becomes usable again.
const hasLiveBooking = async (quotation) => {
  if (!quotation.convertedBookingId) return false;
  const exists = await BanquetBooking.exists({ _id: quotation.convertedBookingId });
  if (exists) return true;
  quotation.convertedBookingId = null;
  quotation.convertedAt = null;
  if (quotation.status === 'Converted') quotation.status = 'Accepted';
  await quotation.save();
  return false;
};

export const getAllQuotations = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = { $in: String(req.query.status).split(',') };
    if (req.query.eventType) q.eventType = req.query.eventType;
    const quotations = await EventQuotation.find(q)
      .populate('hallId', 'name capacity')
      .sort({ quotationDate: -1, createdAt: -1 });
    res.json({ success: true, data: quotations, message: 'Quotations fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching quotations', error: error.message });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const quotation = await EventQuotation.findById(req.params.id).populate('hallId', 'name capacity');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.json({ success: true, data: quotation, message: 'Quotation retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching quotation', error: error.message });
  }
};

// The quotation number is sequenced from a count, so two concurrent creates can
// land on the same number. Retry a few times on the unique-index violation.
const saveWithNumberRetry = async (doc, attempts = 4) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await doc.save();
    } catch (error) {
      const duplicate = error?.code === 11000 && /quotationNumber/.test(JSON.stringify(error.keyPattern || error.keyValue || {}));
      if (!duplicate || i === attempts - 1) throw error;
      doc.quotationNumber = undefined; // let the pre-validate hook re-sequence
    }
  }
  return null;
};

export const createQuotation = async (req, res) => {
  try {
    const quotation = new EventQuotation(req.body);
    await saveWithNumberRetry(quotation);
    res.status(201).json({ success: true, data: quotation, message: 'Quotation created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating quotation', error: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const quotation = await EventQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (await hasLiveBooking(quotation)) {
      return res.status(409).json({ success: false, message: 'This quotation is already converted to a booking and can no longer be edited.' });
    }
    // Drop everything the server owns (the number is assigned once so the
    // client's printed copy keeps matching ours), then let staff move the
    // status only between the values they're allowed to pick.
    const patch = { ...(req.body || {}) };
    const requestedStatus = patch.status;
    for (const field of SERVER_OWNED_FIELDS) delete patch[field];
    if (CLIENT_SETTABLE_STATUSES.includes(requestedStatus)) patch.status = requestedStatus;
    quotation.set(patch);
    await quotation.save();
    res.json({ success: true, data: quotation, message: 'Quotation updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error updating quotation', error: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const quotation = await EventQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (await hasLiveBooking(quotation)) {
      return res.status(409).json({ success: false, message: 'This quotation has a booking against it — delete the booking first.' });
    }
    await quotation.deleteOne();
    res.json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting quotation', error: error.message });
  }
};

// Copy an existing quotation into a fresh Draft (new number, new dates) — the
// fastest way to quote a similar enquiry.
export const duplicateQuotation = async (req, res) => {
  try {
    const source = await EventQuotation.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ success: false, message: 'Quotation not found' });
    const {
      _id, quotationNumber, quotationDate, validUpto, status, acceptedPackageIndex,
      convertedBookingId, convertedAt, createdAt, updatedAt, __v, ...rest
    } = source;
    const copy = new EventQuotation({ ...rest, quotationDate: new Date(), status: 'Draft' });
    await saveWithNumberRetry(copy);
    res.status(201).json({ success: true, data: copy, message: 'Quotation duplicated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error duplicating quotation', error: error.message });
  }
};

// Render the printable A4 quotation sheet.
export const printQuotation = async (req, res) => {
  try {
    const quotation = await EventQuotation.findById(req.params.id).populate('hallId', 'name capacity').lean();
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    const hotel = await InvoiceService.getHotelInfo();
    const html = renderEventQuotation({
      quotation: { ...quotation, hallName: quotation.hallName || quotation.hallId?.name || '' },
      hotel,
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error rendering quotation', error: error.message });
  }
};

// ── Quotation → booking ──────────────────────────────────────────────────────
// Turns the accepted package (plus any chosen add-ons) into a BanquetBooking so
// the event can be run and billed through the existing banquet pipeline.
//
// Body: { packageIndex, addOnIndexes?: number[], quantity?, status? }
//   packageIndex  — which quoted package the client accepted
//   addOnIndexes  — optional facilities the client also took (default: none)
//   quantity      — final pax/plates; defaults to the package's quoted quantity
export const convertQuotation = async (req, res) => {
  try {
    const quotation = await EventQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (await hasLiveBooking(quotation)) {
      return res.status(409).json({ success: false, message: 'This quotation has already been converted to a booking.' });
    }

    const packages = quotation.packages || [];
    const packageIndex = Number(req.body?.packageIndex ?? quotation.acceptedPackageIndex);
    const pkg = packages[packageIndex];
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Select which quoted package the client accepted.' });
    }
    if (!quotation.eventDate) {
      return res.status(400).json({ success: false, message: 'Set an event date on the quotation before converting it to a booking.' });
    }
    if (!quotation.clientPhone) {
      return res.status(400).json({ success: false, message: 'A contact number is required to create a booking.' });
    }

    const days = Number(pkg.days) || 1;
    const quantity = resolveQuantity({
      override: req.body?.quantity, pkg, expectedGuests: quotation.expectedGuests,
    });
    const perHead = isPerHead(pkg);
    // A per-head package with no head count anywhere prices at ₹0 — that is a
    // missing input, not a free event, so refuse rather than book it.
    if (perHead && quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `"${pkg.name}" is charged ${pkg.priceBasis} — enter the final head count before converting.`,
      });
    }
    const packageAmount = packageTotal(
      { price: pkg.price, priceBasis: pkg.priceBasis, quantity, days },
      quotation.expectedGuests,
    );

    // Per-head packages bill as a catering line (perPlate × plates × days) so
    // post-event finalisation on actual plates works. Flat packages bill as the
    // venue/floor charge instead.
    const cateringItems = perHead ? [{
      name: pkg.name,
      category: 'Package',
      perPlate: Number(pkg.price) || 0,
      plates: quantity,
      days,
      amount: packageAmount,
    }] : [];
    const floorCost = perHead ? 0 : packageAmount;

    // Chosen optional facilities carry their own GST, so they are stored gross.
    const chosen = Array.isArray(req.body?.addOnIndexes) ? req.body.addOnIndexes : [];
    const extraItems = chosen
      .map((i) => (quotation.addOns || [])[Number(i)])
      .filter(Boolean)
      .map((a) => ({
        name: a.name,
        detail: a.unit || '',
        price: Number(a.price) || 0,
        gstPercent: Number(a.gstPercent) || 0,
        quantity: Number(a.quantity) || 1,
        amount: addOnTotal(a),
      }));
    const extrasCost = extraItems.reduce((s, x) => s + x.amount, 0);

    const totalAmount = packageAmount + extrasCost;

    // A converted event is package/duration priced rather than floor-picked, so
    // it claims the notional 'duration' main-hall slot — the same token the
    // booking form uses. Without this the event would neither clash-check
    // against, nor be visible to, other bookings on the same date.
    const floorSelection = ['duration'];
    await findSlotConflict({
      eventDate: quotation.eventDate,
      endDate: quotation.endDate,
      floorSelection,
    });

    const booking = new BanquetBooking({
      hallId: quotation.hallId || undefined,
      customerName: quotation.clientName,
      customerPhone: quotation.clientPhone,
      customerEmail: quotation.clientEmail,
      address: quotation.clientAddress,
      gstNumber: quotation.clientGstin,
      eventType: quotation.eventType,
      eventTitle: quotation.eventTitle,
      eventDate: quotation.eventDate,
      endDate: quotation.endDate || undefined,
      startTime: quotation.startTime || '10:00',
      endTime: quotation.endTime || '18:00',
      guestCount: Math.max(1, quantity || Number(quotation.expectedGuests) || 1),
      expectedGuests: Number(quotation.expectedGuests) || 0,
      seatingStyle: quotation.seatingStyle || '',
      eventDetails: {
        organizationName: quotation.clientCompany || '',
        contactPerson: quotation.clientCompany ? quotation.clientName : '',
      },
      packageName: pkg.name,
      cateringItems,
      cateringPackageName: perHead ? pkg.name : '',
      cateringPerPlate: perHead ? Number(pkg.price) || 0 : 0,
      numberOfPlates: perHead ? quantity : 0,
      menuCost: perHead ? packageAmount : 0,
      floorCost,
      floorSelection,
      extraItems,
      extrasCost,
      totalAmount,
      daysWithMeals: perHead ? days : 0,
      salesExecutive: quotation.preparedBy || '',
      specialRequests: quotation.notes || '',
      status: ['Pending', 'Confirmed'].includes(req.body?.status) ? req.body.status : 'Confirmed',
      source: 'reception',
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
    });
    await booking.save();

    quotation.status = 'Converted';
    quotation.acceptedPackageIndex = packageIndex;
    quotation.convertedBookingId = booking._id;
    quotation.convertedAt = new Date();
    await quotation.save();

    res.status(201).json({
      success: true,
      data: { quotation, booking },
      message: `Booking created from ${quotation.quotationNumber}`,
    });
  } catch (error) {
    // findSlotConflict raises a 409 whose message names the clashing booking —
    // surface it verbatim so reception sees what the date collides with.
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.statusCode ? error.message : 'Error converting quotation',
      error: error.message,
    });
  }
};
