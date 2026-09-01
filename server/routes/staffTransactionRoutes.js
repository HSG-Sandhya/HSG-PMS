import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { body } from 'express-validator';
import {
  getStaffTransactions,
  createStaffTransaction,
  updateTransactionStatus,
  getStaffTransactionSummary,
  deleteTransaction,
  getAllTransactions
} from '../controllers/staffTransactionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// Malformed :staffId -> 400 instead of a Mongoose CastError 500.
router.param('staffId', objectIdParam('staff ID'));

// Validation middleware
const createTransactionValidation = [
  body('staffId').isMongoId().withMessage('Valid staff ID is required'),
  body('amount').isNumeric().isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
  body('type').isIn(['advance', 'salary', 'bonus', 'deduction', 'loan', 'overtime']).withMessage('Invalid transaction type'),
  body('reason').optional({ checkFalsy: true }).trim(),
  body('date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date'),
  body('paymentMethod').optional().isIn(['cash', 'bank_transfer', 'cheque', 'upi']).withMessage('Invalid payment method')
];

const updateTransactionValidation = [
  body('status').isIn(['pending', 'approved', 'paid', 'cancelled']).withMessage('Invalid status'),
  body('paymentMethod').optional().isIn(['cash', 'bank_transfer', 'cheque', 'upi']).withMessage('Invalid payment method'),
  body('referenceNumber').optional().trim(),
  body('notes').optional().trim()
];

// Staff advances, salary, bonuses and deductions are money records. These
// guards were commented out "for development" and shipped that way, leaving the
// whole router anonymous in production. They stay on.
router.use(authenticateToken);

// Reads: anyone who already runs the workforce screens.
const canView = requireManage(['manage_attendance', 'manage_payroll', 'view_payroll', 'manage_staff']);
// Creating a transaction: matches the client gate on the Attendance tab
// (WorkforceManagement.js), which is the only UI that posts here today.
const canCreate = requireManage(['manage_attendance', 'manage_payroll', 'manage_staff']);
// Approving/paying out or deleting a record is payroll-grade and has no UI
// consumer, so it is held to the narrower grant.
const canSettle = requireManage(['manage_payroll', 'manage_staff']);

// @route   GET /api/staff/transactions
// @desc    Get all transactions (admin view)
// @access  Private (Admin/System Admin only)
router.get('/', canView, getAllTransactions);

// @route   POST /api/staff/transactions
// @desc    Create new staff transaction
// @access  Private (Admin/System Admin only)
router.post('/', canCreate, createTransactionValidation, createStaffTransaction);

// @route   GET /api/staff/:staffId/transactions
// @desc    Get all transactions for a staff member
// @access  Private (Admin/System Admin only)
router.get('/:staffId/transactions', canView, getStaffTransactions);

// @route   GET /api/staff/:staffId/transactions/summary
// @desc    Get staff transaction summary
// @access  Private (Admin/System Admin only)
router.get('/:staffId/transactions/summary', canView, getStaffTransactionSummary);

// @route   PUT /api/staff/transactions/:id
// @desc    Update transaction status
// @access  Private (Admin/System Admin only)
router.put('/transactions/:id', canSettle, updateTransactionValidation, updateTransactionStatus);

// @route   DELETE /api/staff/transactions/:id
// @desc    Delete transaction
// @access  Private (Admin/System Admin only)
router.delete('/transactions/:id', canSettle, deleteTransaction);

export default router;
