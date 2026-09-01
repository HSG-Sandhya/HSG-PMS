import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { body } from 'express-validator';
import {
  getStaffRecharges,
  createStaffRecharge,
  updateRechargeStatus,
  getStaffRechargeSummary,
  getRechargeByTransactionId,
  cancelRecharge,
  getAllRecharges,
  getMonthlyRechargeStats
} from '../controllers/staffRechargeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('recharge ID'));
router.param('staffId', objectIdParam('staff ID'));

// Validation middleware
const createRechargeValidation = [
  body('staffId').isMongoId().withMessage('Valid staff ID is required'),
  body('phoneNumber').isMobilePhone('en-IN').withMessage('Valid Indian mobile number is required'),
  body('amount').isNumeric().isFloat({ min: 10 }).withMessage('Amount must be at least ₹10'),
  body('operator').isIn(['Airtel', 'Jio', 'Vi', 'BSNL', 'Other']).withMessage('Invalid operator'),
  body('planType').optional().isIn(['prepaid', 'postpaid']).withMessage('Invalid plan type'),
  body('date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date'),
  body('paymentMethod').optional().isIn(['wallet', 'cash', 'salary_deduction', 'advance']).withMessage('Invalid payment method')
];

const updateRechargeValidation = [
  body('status').isIn(['pending', 'processing', 'success', 'failed', 'cancelled']).withMessage('Invalid status'),
  body('operatorTransactionId').optional().trim(),
  body('failureReason').optional().trim(),
  body('notes').optional().trim()
];

// Recharges spend hotel money on staff phone numbers. These guards were
// commented out "for development" and shipped that way, leaving the whole
// router anonymous in production. They stay on.
router.use(authenticateToken);

// Reads: anyone who already runs the workforce screens.
const canView = requireManage(['manage_attendance', 'manage_payroll', 'view_payroll', 'manage_staff']);
// Creating a recharge: matches the client gate on the Attendance tab
// (WorkforceManagement.js), which is the only UI that posts here today.
const canCreate = requireManage(['manage_attendance', 'manage_payroll', 'manage_staff']);
// Marking a recharge success/failed or cancelling it has no UI consumer, so it
// is held to the narrower grant.
const canSettle = requireManage(['manage_payroll', 'manage_staff']);

// @route   GET /api/staff/recharges
// @desc    Get all recharges (admin view)
// @access  Private (Admin/System Admin only)
router.get('/', canView, getAllRecharges);

// @route   POST /api/staff/recharges
// @desc    Create new staff recharge
// @access  Private (Admin/System Admin only)
router.post('/', canCreate, createRechargeValidation, createStaffRecharge);

// @route   GET /api/staff/recharges/stats/:year/:month
// @desc    Get monthly recharge statistics
// @access  Private (Admin/System Admin only)
router.get('/stats/:year/:month', canView, getMonthlyRechargeStats);

// @route   GET /api/staff/recharges/transaction/:transactionId
// @desc    Get recharge by transaction ID
// @access  Private (Admin/System Admin only)
router.get('/transaction/:transactionId', canView, getRechargeByTransactionId);

// @route   GET /api/staff/:staffId/recharges
// @desc    Get all recharges for a staff member
// @access  Private (Admin/System Admin only)
router.get('/:staffId/recharges', canView, getStaffRecharges);

// @route   GET /api/staff/:staffId/recharges/summary
// @desc    Get staff recharge summary
// @access  Private (Admin/System Admin only)
router.get('/:staffId/recharges/summary', canView, getStaffRechargeSummary);

// @route   PUT /api/staff/recharges/:id
// @desc    Update recharge status
// @access  Private (Admin/System Admin only)
router.put('/recharges/:id', canSettle, updateRechargeValidation, updateRechargeStatus);

// @route   DELETE /api/staff/recharges/:id
// @desc    Cancel recharge
// @access  Private (Admin/System Admin only)
router.delete('/recharges/:id', canSettle, cancelRecharge);

export default router;
