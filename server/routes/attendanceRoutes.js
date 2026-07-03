import express from "express";
import { body, param } from "express-validator";
import mongoose from "mongoose";
import {
  getAllAttendance,
  getDailyAttendance,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  getStaffAttendance,
  getAttendanceStats,
  bulkMarkAttendance,
  getEligibleStaffForAttendance,
  canManageAttendance,
} from "../controllers/attendanceController.js";
import { requireAuth } from "../middleware/auth.js";

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

// Test endpoint to verify routes are working (no auth required)
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Attendance routes are working' });
});

// Apply authentication middleware to all routes
router.use(requireAuth);

// Centralized admin guard — every attendance endpoint requires manage rights.
router.use((req, res, next) => {
  if (!canManageAttendance(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only Admin and System Admin can access attendance.",
    });
  }
  next();
});

// Validation middleware for marking attendance
const markAttendanceValidation = [
  body('staff')
    .notEmpty()
    .withMessage('Staff ID is required')
    .isMongoId()
    .withMessage('Invalid staff ID'),
  body('status')
    .isIn(['present', 'absent', 'late', 'half_day', 'overtime', 'holiday', 'leave'])
    .withMessage('Invalid attendance status'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('leaveType')
    .if(body('status').equals('leave'))
    .notEmpty()
    .withMessage('Leave type is required for leave status')
    .isIn(['sick', 'casual', 'earned', 'maternity', 'paternity', 'emergency', 'unpaid'])
    .withMessage('Invalid leave type'),
  body('leaveReason')
    .if(body('status').equals('leave'))
    .notEmpty()
    .withMessage('Leave reason is required for leave status')
    .isLength({ min: 5, max: 500 })
    .withMessage('Leave reason must be between 5 and 500 characters')
];

// Validation for bulk attendance
const bulkAttendanceValidation = [
  body('attendanceRecords')
    .isArray({ min: 1, max: 500 })
    .withMessage('Attendance records array is required (max 500 per request)'),
  body('attendanceRecords.*.staff')
    .isMongoId()
    .withMessage('Invalid staff ID'),
  body('attendanceRecords.*.status')
    .isIn(['present', 'absent', 'late', 'half_day', 'overtime', 'holiday', 'leave'])
    .withMessage('Invalid attendance status'),
  body('attendanceRecords.*.leaveType')
    .optional()
    .isIn(['sick', 'casual', 'earned', 'maternity', 'paternity', 'emergency', 'unpaid'])
    .withMessage('Invalid leave type'),
  body('attendanceRecords.*.leaveReason')
    .optional()
    .isString()
    .isLength({ min: 5, max: 500 })
    .withMessage('Leave reason must be 5–500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
];

// Routes

// @route   GET /api/attendance
// @desc    Get all attendance records with filtering
// @access  Private (Admin/System Admin only)
router.get('/', getAllAttendance);

// @route   GET /api/attendance/daily
// @desc    Get daily attendance for all staff
// @access  Private (Admin/System Admin only)
router.get('/daily', getDailyAttendance);

// @route   GET /api/attendance/eligible-staff
// @desc    Get list of staff eligible for attendance (excluding admin/system admin)
// @access  Private (Admin/System Admin only)
router.get('/eligible-staff', getEligibleStaffForAttendance);

// @route   GET /api/attendance/stats
// @desc    Get attendance statistics
// @access  Private (Admin/System Admin only)
router.get('/stats', getAttendanceStats);

// @route   GET /api/attendance/staff/:staffId
// @desc    Get attendance history for specific staff
// @access  Private (Admin/System Admin only)
router.get(
  '/staff/:staffId',
  param('staffId').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Invalid staff ID'),
  getStaffAttendance,
);

// @route   POST /api/attendance
// @desc    Mark attendance for staff
// @access  Private (Admin/System Admin only)
router.post('/', requireManage('manage_attendance'), markAttendanceValidation, markAttendance);

// @route   POST /api/attendance/bulk
// @desc    Bulk mark attendance for multiple staff
// @access  Private (Admin/System Admin only)
router.post('/bulk', requireManage('manage_attendance'), bulkAttendanceValidation, bulkMarkAttendance);

const idParamValidation = param('id')
  .custom((v) => mongoose.Types.ObjectId.isValid(v))
  .withMessage('Invalid attendance ID');

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (Admin/System Admin only)
router.put('/:id', requireManage('manage_attendance'), idParamValidation, updateAttendance);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (Admin/System Admin only)
router.delete('/:id', requireManage('manage_attendance'), idParamValidation, deleteAttendance);

export default router;
