import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';
import { refundPayment, getPaymentDetails } from '../controllers/paymentController.js';

const router = express.Router();

// Gateway operations move real money and expose payer details. Nothing here is
// public — these used to sit on the anonymous /api/website router, where anyone
// holding a payment id could trigger a refund.
router.use(authenticateToken);

// Umbrella grant OR the granular one, matching the convention used elsewhere
// (see staffRoutes.js). System admins pass automatically via requireManage.
router.post('/:id/refund', requireManage(['process_refunds', 'manage_payments']), refundPayment);

router.get('/:id', requireManage(['manage_payments', 'process_refunds', 'view_financial_reports']), getPaymentDetails);

export default router;
