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
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Malformed :staffId -> 400 instead of a Mongoose CastError 500.
router.param('staffId', objectIdParam('staff ID'));

// Validation middleware
const createTransactionValidation = [
  body('staffId').isMongoId().withMessage('Valid staff ID is required'),
  body('amount').isNumeric().isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
  body('type').isIn(['advance', 'salary', 'bonus', 'deduction', 'loan', 'overtime']).withMessage('Invalid transaction type'),
  body('reason').optional({ checkFalsy: true }).trim(),
  body('paymentMethod').optional().isIn(['cash', 'bank_transfer', 'cheque', 'upi']).withMessage('Invalid payment method')
];

const updateTransactionValidation = [
  body('status').isIn(['pending', 'approved', 'paid', 'cancelled']).withMessage('Invalid status'),
  body('paymentMethod').optional().isIn(['cash', 'bank_transfer', 'cheque', 'upi']).withMessage('Invalid payment method'),
  body('referenceNumber').optional().trim(),
  body('notes').optional().trim()
];

// Apply authentication and admin middleware to all routes (disabled for development)
// router.use(requireAuth);
// router.use(requireAdmin);

// @route   GET /api/staff/transactions
// @desc    Get all transactions (admin view)
// @access  Private (Admin/System Admin only)
router.get('/', getAllTransactions);

// @route   POST /api/staff/transactions
// @desc    Create new staff transaction
// @access  Private (Admin/System Admin only)
router.post('/', createTransactionValidation, createStaffTransaction);

// @route   GET /api/staff/:staffId/transactions
// @desc    Get all transactions for a staff member
// @access  Private (Admin/System Admin only)
router.get('/:staffId/transactions', getStaffTransactions);

// @route   GET /api/staff/:staffId/transactions/summary
// @desc    Get staff transaction summary
// @access  Private (Admin/System Admin only)
router.get('/:staffId/transactions/summary', getStaffTransactionSummary);

// @route   PUT /api/staff/transactions/:id
// @desc    Update transaction status
// @access  Private (Admin/System Admin only)
router.put('/transactions/:id', updateTransactionValidation, updateTransactionStatus);

// @route   DELETE /api/staff/transactions/:id
// @desc    Delete transaction
// @access  Private (Admin/System Admin only)
router.delete('/transactions/:id', deleteTransaction);

export default router;
