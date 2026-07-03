import express from "express";
import { objectIdParam } from '../middleware/validateObjectId.js';
import { body } from "express-validator";
import {
  generatePayroll,
  getAllPayrolls,
  generatePayrollPDF,
  approvePayroll,
  markPayrollAsPaid,
  getPayrollSummary
} from "../controllers/payrollController.js";
import { requireAuth } from "../middleware/auth.js";

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('payroll ID'));

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation middleware for generating payroll
const generatePayrollValidation = [
  body('staffId')
    .notEmpty()
    .withMessage('Staff ID is required')
    .isMongoId()
    .withMessage('Invalid staff ID'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030')
];

// Validation for marking payroll as paid
const markAsPaidValidation = [
  body('paymentMethod')
    .isIn(['bank_transfer', 'cash', 'cheque', 'upi'])
    .withMessage('Invalid payment method'),
  body('transactionId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Transaction ID must be between 1 and 100 characters'),
  body('bankDetails')
    .optional()
    .isObject()
    .withMessage('Bank details must be an object'),
  body('bankDetails.accountNumber')
    .optional()
    .isLength({ min: 8, max: 20 })
    .withMessage('Account number must be between 8 and 20 characters'),
  body('bankDetails.ifscCode')
    .optional()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code format'),
  body('bankDetails.bankName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Bank name must be between 2 and 100 characters'),
  body('bankDetails.accountHolderName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2 and 100 characters')
];

// Routes

// @route   GET /api/payroll
// @desc    Get all payroll records with filtering
// @access  Private (Admin/System Admin only)
router.get('/', getAllPayrolls);

// @route   GET /api/payroll/summary
// @desc    Get payroll summary statistics
// @access  Private (Admin/System Admin only)
router.get('/summary', getPayrollSummary);

// @route   POST /api/payroll/generate
// @desc    Generate payroll for staff
// @access  Private (Admin/System Admin only)
router.post('/generate', requireManage('manage_payroll'), generatePayrollValidation, generatePayroll);

// @route   GET /api/payroll/:id/pdf
// @desc    Generate and download payroll PDF
// @access  Private (Admin/System Admin only)
router.get('/:id/pdf', generatePayrollPDF);

// @route   PUT /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (Admin/System Admin only)
router.put('/:id/approve', requireManage('manage_payroll'), approvePayroll);

// @route   PUT /api/payroll/:id/pay
// @desc    Mark payroll as paid
// @access  Private (Admin/System Admin only)
router.put('/:id/pay', requireManage('manage_payroll'), markAsPaidValidation, markPayrollAsPaid);

export default router;
