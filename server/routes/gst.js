import express from 'express';
import { lookupGst } from '../controllers/gstController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// All GST lookup routes require authentication.
router.use(authenticateToken);

// Look up a GSTIN → registered company name + address.
//
// Gated on the guest/booking permissions rather than left open to any signed-in
// account: each call spends a metered Surepass lookup, and the only place that
// needs it is the guest form's GST auto-fill. Front desk, managers and the
// owner hold these; housekeeping and kitchen accounts do not.
router.post('/lookup', requireManage(['manage_guests', 'manage_bookings']), lookupGst);

export default router;
