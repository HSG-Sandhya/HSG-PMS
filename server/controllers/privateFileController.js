import { basename, isAbsolute, join } from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Booking from '../models/Booking.js';
import Staff from '../models/Staff.js';
import User from '../models/User.js';
import { imageTypeOfFile, CONTENT_TYPE_BY_EXT } from '../utils/fileSignature.js';
import { logActivity } from '../utils/activityLogger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Mirrors app.js: UPLOAD_DIR may be absolute or relative to the server root.
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || 'uploads';
const UPLOAD_BASE = isAbsolute(UPLOAD_BASE_DIR)
  ? UPLOAD_BASE_DIR
  : join(__dirname, '..', UPLOAD_BASE_DIR);

const DIRS = {
  'id-cards': join(UPLOAD_BASE, 'id-cards'),
  aadhar: join(UPLOAD_BASE, 'aadhar'),
};

/**
 * Turn a stored DB value into a path inside the expected directory.
 *
 * Stored values are inconsistent — bookings save multer's absolute `file.path`,
 * the Aadhaar controller saves a `/uploads/aadhar/x.png` URL — so only the
 * basename is trusted and it is re-joined to a directory chosen by the caller,
 * not by the request. That makes `../` traversal structurally impossible rather
 * than merely filtered.
 */
const resolveInDir = (stored, dirKey) => {
  if (!stored || typeof stored !== 'string') return null;
  const name = basename(stored.replace(/\\/g, '/').trim());
  if (!name || name === '.' || name === '..') return null;
  return join(DIRS[dirKey], name);
};

/** Stream a validated image with caching disabled — these are identity documents. */
const streamFile = async (res, filePath) => {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }

  // Serve the type we detect, never one derived from the filename.
  const type = await imageTypeOfFile(filePath);
  if (!type) {
    return res.status(415).json({ success: false, message: 'Stored file is not a valid image.' });
  }

  res.set({
    'Content-Type': CONTENT_TYPE_BY_EXT[type],
    'Content-Length': info.size,
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  createReadStream(filePath).pipe(res);
};

/** Record who looked at whose identity document. */
const auditView = (req, subject, id) =>
  logActivity(req, {
    action: 'private_file.view',
    category: 'security',
    severity: 'info',
    audit: true,
    resource: subject,
    resourceId: id,
    description: `Viewed ${subject} identity document`,
  });

/**
 * GET /api/private-files/booking/:id/id-card/:side
 *
 * Authorisation runs through the booking itself: the lookup uses the
 * tenant-bound connection, so a token issued for one hotel can only ever reach
 * documents referenced by that hotel's bookings — even though the files still
 * share one directory on disk.
 */
export const getBookingIdCard = async (req, res) => {
  try {
    const { id, side } = req.params;
    if (side !== 'front' && side !== 'back') {
      return res.status(400).json({ success: false, message: "Side must be 'front' or 'back'." });
    }

    const booking = await Booking.findById(id).select('idCardImage idCardImageBack').lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const stored = side === 'front' ? booking.idCardImage : booking.idCardImageBack;
    const filePath = resolveInDir(stored, 'id-cards');
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'No ID document on this booking.' });
    }

    await auditView(req, 'Booking', id);
    return await streamFile(res, filePath);
  } catch (error) {
    console.error('Error serving booking ID card:', error);
    return res.status(500).json({ success: false, message: 'Failed to load document.' });
  }
};

/**
 * GET /api/private-files/staff/:id/aadhaar/:side?
 * Reads whichever Aadhaar URL the record holds (Staff first, then User).
 */
export const getStaffAadhaar = async (req, res) => {
  try {
    const { id } = req.params;
    const side = req.params.side || 'front';
    if (side !== 'front' && side !== 'back') {
      return res.status(400).json({ success: false, message: "Side must be 'front' or 'back'." });
    }

    // Staff keeps these at the top level; User nests them under `profile`.
    const staff = await Staff.findById(id)
      .select('aadharFrontUrl aadharBackUrl aadharImageUrl').lean();
    const user = staff ? null : await User.findById(id)
      .select('profile.aadharFrontUrl profile.aadharBackUrl profile.aadharImageUrl').lean();
    const record = staff || user?.profile;
    if (!record) {
      return res.status(404).json({ success: false, message: 'Staff record not found.' });
    }

    const stored = side === 'back'
      ? record.aadharBackUrl
      : (record.aadharFrontUrl || record.aadharImageUrl);
    const filePath = resolveInDir(stored, 'aadhar');
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'No Aadhaar document on this record.' });
    }

    await auditView(req, 'Staff', id);
    return await streamFile(res, filePath);
  } catch (error) {
    console.error('Error serving staff Aadhaar:', error);
    return res.status(500).json({ success: false, message: 'Failed to load document.' });
  }
};
