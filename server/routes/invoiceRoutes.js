import { requirePermission } from '../middleware/requireManage.js';
import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateBanquetInvoice, getInvoiceData } from '../controllers/invoiceController.js';

const router = express.Router();

router.use(authenticateToken);

// Malformed :bookingId -> 400 instead of a Mongoose CastError 500.
router.param('bookingId', objectIdParam('booking ID'));

// Rendering the document was gated on being logged in and nothing else, while
// merely READING its data below needed a permission -- so any staff account at
// all could pull a guest's full tax invoice: name, ID, address, the money. Same
// gate as the data route it renders from.
router.post('/booking/:bookingId', requirePermission(['view_bookings', 'manage_bookings', 'manage_billing']), generateBanquetInvoice);
router.get('/booking/:bookingId/data', requirePermission(['view_bookings', 'manage_bookings', 'manage_billing']), getInvoiceData);

export default router;
