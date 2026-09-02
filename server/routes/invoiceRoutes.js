import { requirePermission } from '../middleware/requireManage.js';
import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateBanquetInvoice, getInvoiceData } from '../controllers/invoiceController.js';

const router = express.Router();

router.use(authenticateToken);

// Malformed :bookingId -> 400 instead of a Mongoose CastError 500.
router.param('bookingId', objectIdParam('booking ID'));

router.post('/booking/:bookingId', generateBanquetInvoice);
router.get('/booking/:bookingId/data', requirePermission(['view_bookings', 'manage_bookings', 'manage_billing']), getInvoiceData);

export default router;
