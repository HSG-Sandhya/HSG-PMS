import paymentService from '../services/paymentService.js';
import { logActivity } from '../utils/activityLogger.js';

// Razorpay payment ids look like `pay_ABC123xyz`. Anything else is rejected
// before it reaches the gateway, so a malformed or injected id can't be probed
// against the live Razorpay account.
const RAZORPAY_PAYMENT_ID = /^pay_[A-Za-z0-9]{6,30}$/;

const actorOf = (req) => {
  const u = req.authUser || req.user || {};
  return u.username || u.email || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
};

/**
 * Refund a Razorpay payment. Money leaves the account here, so this route is
 * authenticated, permission-gated (see paymentRoutes.js) and every attempt —
 * successful or not — is written to the audit log with the acting user.
 */
export const refundPayment = async (req, res) => {
  const paymentId = req.params.id;
  const { amount, reason = 'Customer request' } = req.body || {};

  if (!RAZORPAY_PAYMENT_ID.test(String(paymentId || ''))) {
    return res.status(400).json({ success: false, message: 'A valid Razorpay payment ID is required.' });
  }

  // A partial refund amount is optional, but when given it must be a real
  // positive number — `null`/NaN would silently become a FULL refund downstream.
  let refundAmount = null;
  if (amount !== undefined && amount !== null && amount !== '') {
    refundAmount = Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Refund amount must be a positive number.' });
    }
  }

  try {
    const refund = await paymentService.refundPayment(paymentId, refundAmount, reason);

    await logActivity(req, {
      action: 'payment.refund',
      category: 'security',
      severity: 'warning',
      audit: true,
      resource: 'Payment',
      resourceId: paymentId,
      description: `${actorOf(req)} refunded ${refundAmount ? `₹${refundAmount}` : 'the full amount'} on ${paymentId} (${reason})`,
      changes: { paymentId, amount: refundAmount, reason, refundId: refund?.id },
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        receipt: refund.receipt,
        created_at: refund.created_at,
      },
    });
  } catch (error) {
    console.error('Error processing refund:', error);

    await logActivity(req, {
      action: 'payment.refund_failed',
      category: 'security',
      severity: 'critical',
      audit: true,
      resource: 'Payment',
      resourceId: paymentId,
      description: `${actorOf(req)} attempted a refund on ${paymentId} — failed: ${error.message}`,
      changes: { paymentId, amount: refundAmount, reason },
    });

    res.status(502).json({ success: false, message: error.message || 'Failed to process refund' });
  }
};

/** Look up a payment at the gateway. Staff-only — it exposes payer details. */
export const getPaymentDetails = async (req, res) => {
  const paymentId = req.params.id;
  if (!RAZORPAY_PAYMENT_ID.test(String(paymentId || ''))) {
    return res.status(400).json({ success: false, message: 'A valid Razorpay payment ID is required.' });
  }

  try {
    const payment = await paymentService.getPaymentDetails(paymentId);
    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        created_at: payment.created_at,
        description: payment.description,
      },
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(502).json({ success: false, message: 'Failed to fetch payment details' });
  }
};
