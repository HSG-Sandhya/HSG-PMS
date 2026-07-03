import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";

// Helper function to check if user can manage attendance
export const canManageAttendance = (user) => {
  if (!user) return false;
  if (user.isSystemAdmin === true || user.isSystemAdmin === 'true') return true;
  if (user.roleName && ['Admin', 'System Administrator'].includes(user.roleName)) return true;
  if (user.role && user.role.name && ['Admin', 'System Administrator'].includes(user.role.name)) return true;
  if (Array.isArray(user.permissions)) {
    if (
      user.permissions.includes('manage_attendance') ||
      user.permissions.includes('manage_staff') ||
      user.permissions.includes('admin_access')
    ) {
      return true;
    }
  }
  return false;
};

// Helper to normalize a date to start-of-day (mirrors the model's pre-validate hook).
const toAttendanceDate = (input) => {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to ensure a target staff member is eligible (not admin / system admin / inactive).
const ensureEligibleStaff = async (staffId) => {
  const staff = await User.findById(staffId).populate('role');
  if (!staff) return { ok: false, status: 404, message: 'Staff member not found' };
  if (!staff.isActive) return { ok: false, status: 400, message: 'Staff member is inactive' };
  if (staff.isSystemAdmin) {
    return { ok: false, status: 400, message: 'Cannot mark attendance for system administrators' };
  }
  if (staff.role && ['Admin', 'System Administrator'].includes(staff.role.name)) {
    return { ok: false, status: 400, message: 'Cannot mark attendance for Admin or System Administrator' };
  }
  return { ok: true, staff };
};

// Helper function to get eligible staff (excluding admin and system admin)
const getEligibleStaff = async () => {
  return await User.find({
    isSystemAdmin: false,
    isActive: true
  })
  .populate('role')
  .then(users => users.filter(user =>
    !user.role || !['Admin', 'System Administrator'].includes(user.role.name)
  ));
};

// Whitelist of fields that can be modified via PUT /:id.
const UPDATABLE_FIELDS = new Set([
  'status',
  'clockIn',
  'clockOut',
  'breaks',
  'shift',
  'productivity',
  'notes',
  'leaveType',
  'leaveReason',
  'modificationReason',
]);

const pickUpdatableFields = (input = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (UPDATABLE_FIELDS.has(key)) out[key] = value;
  }
  return out;
};

const sendDuplicate = (res) =>
  res.status(409).json({
    success: false,
    message: 'Attendance already marked for this date',
  });

// @desc    Get all attendance records with filtering
// @route   GET /api/attendance
// @access  Private (Admin/System Admin only)
export const getAllAttendance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      staff,
      status,
      startDate,
      endDate,
      department
    } = req.query;

    // Build query
    let query = {};

    // Filter by staff
    if (staff) {
      query.staff = staff;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Build population query for department filtering
    let populateQuery = {
      path: 'staff',
      select: 'firstName lastName profile.employeeId role department',
      populate: [
        { path: 'role', select: 'name' },
        { path: 'department', select: 'name' }
      ]
    };

    if (department) {
      populateQuery.match = { department: department };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1, createdAt: -1 },
      populate: [
        populateQuery,
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'modifiedBy', select: 'firstName lastName' }
      ]
    };

    const attendance = await Attendance.paginate(query, options);

    res.status(200).json({
      success: true,
      data: attendance.docs,
      pagination: {
        currentPage: attendance.page,
        totalPages: attendance.totalPages,
        totalRecords: attendance.totalDocs,
        hasNext: attendance.hasNextPage,
        hasPrev: attendance.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching attendance records",
    });
  }
};

// @desc    Get daily attendance
// @route   GET /api/attendance/daily
// @access  Private (Admin/System Admin only)
export const getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const attendance = await Attendance.getDailyAttendance(targetDate);

    // Get all eligible staff for the day
    const allStaff = await getEligibleStaff();
    
    // Create attendance summary
    const attendanceMap = new Map();
    attendance.forEach(record => {
      attendanceMap.set(record.staff._id.toString(), record);
    });

    const dailyAttendance = allStaff.map(staff => {
      const record = attendanceMap.get(staff._id.toString());
      return {
        staff: {
          _id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          employeeId: staff.profile.employeeId,
          role: staff.role,
          department: staff.department
        },
        attendance: record || null,
        status: record ? record.status : 'not_marked'
      };
    });

    // Calculate statistics
    const stats = {
      total: allStaff.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      halfDay: attendance.filter(a => a.status === 'half_day').length,
      leave: attendance.filter(a => a.status === 'leave').length,
      notMarked: allStaff.length - attendance.length
    };

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        attendance: dailyAttendance,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Get daily attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching daily attendance",
    });
  }
};

// @desc    Mark attendance for staff
// @route   POST /api/attendance
// @access  Private (Admin/System Admin only)
export const markAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { staff, date, status, clockIn, clockOut, shift, leaveType, leaveReason, notes } = req.body;

    const eligibility = await ensureEligibleStaff(staff);
    if (!eligibility.ok) {
      return res.status(eligibility.status).json({ success: false, message: eligibility.message });
    }

    if (status === 'leave' && (!leaveType || !leaveReason)) {
      return res.status(400).json({
        success: false,
        message: "Leave type and reason are required for leave status",
      });
    }

    const attendanceDate = toAttendanceDate(date);

    const attendanceData = {
      staff,
      date: attendanceDate,
      status,
      notes,
      approvedBy: req.user?._id || null,
      approvedAt: new Date(),
    };
    if (clockIn) {
      attendanceData.clockIn = { time: new Date(clockIn), method: 'manual', ipAddress: req.ip };
    }
    if (clockOut) {
      attendanceData.clockOut = { time: new Date(clockOut), method: 'manual', ipAddress: req.ip };
    }
    if (shift) attendanceData.shift = shift;
    if (status === 'leave') {
      attendanceData.leaveType = leaveType;
      attendanceData.leaveReason = leaveReason;
    }

    const attendance = new Attendance(attendanceData);
    if (clockIn && clockOut) attendance.calculateWorkHours();

    try {
      await attendance.save();
    } catch (saveErr) {
      if (saveErr?.code === 11000) return sendDuplicate(res);
      throw saveErr;
    }

    await attendance.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'approvedBy', select: 'firstName lastName' },
    ]);

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: attendance,
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while marking attendance",
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Private (Admin/System Admin only)
export const updateAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = pickUpdatableFields(req.body);

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    if (attendance.payrollProcessed) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify attendance record that has been processed in payroll",
      });
    }

    // Validate leave-status updates carry leave metadata.
    const nextStatus = updateData.status ?? attendance.status;
    if (nextStatus === 'leave') {
      const leaveType = updateData.leaveType ?? attendance.leaveType;
      const leaveReason = updateData.leaveReason ?? attendance.leaveReason;
      if (!leaveType || !leaveReason) {
        return res.status(400).json({
          success: false,
          message: "Leave type and reason are required for leave status",
        });
      }
    }

    if (updateData.clockIn) {
      updateData.clockIn = {
        time: new Date(updateData.clockIn.time || updateData.clockIn),
        method: updateData.clockIn.method || 'manual',
        ipAddress: req.ip,
        location: updateData.clockIn.location,
      };
    }
    if (updateData.clockOut) {
      updateData.clockOut = {
        time: new Date(updateData.clockOut.time || updateData.clockOut),
        method: updateData.clockOut.method || 'manual',
        ipAddress: req.ip,
        location: updateData.clockOut.location,
      };
    }

    updateData.modifiedBy = req.user?._id || null;
    updateData.modificationReason = updateData.modificationReason || 'Updated by admin';

    Object.assign(attendance, updateData);

    if (updateData.clockIn || updateData.clockOut) {
      attendance.calculateWorkHours();
    }

    await attendance.save();

    await attendance.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'approvedBy', select: 'firstName lastName' },
      { path: 'modifiedBy', select: 'firstName lastName' },
    ]);

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while updating attendance",
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (Admin/System Admin only)
export const deleteAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }
    if (attendance.payrollProcessed) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete attendance record that has been processed in payroll",
      });
    }

    await Attendance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting attendance",
    });
  }
};

// @desc    Get staff attendance history
// @route   GET /api/attendance/staff/:staffId
// @access  Private (Admin/System Admin only)
export const getStaffAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { staffId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    // Validate staff exists and is eligible
    const staff = await User.findById(staffId).populate('role');
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found"
      });
    }

    const attendance = await Attendance.getStaffAttendance(staffId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        staff: {
          _id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          employeeId: staff.profile.employeeId
        },
        attendance
      }
    });
  } catch (error) {
    console.error('Get staff attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching staff attendance",
    });
  }
};

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private (Admin/System Admin only)
export const getAttendanceStats = async (req, res) => {
  try {
    const { month, year, staffId } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    if (staffId) {
      // Get stats for specific staff
      const stats = await Attendance.getAttendanceStats(staffId, targetMonth, targetYear);
      
      res.status(200).json({
        success: true,
        data: {
          staffId,
          month: targetMonth,
          year: targetYear,
          statistics: stats
        }
      });
    } else {
      // Get overall stats
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0);

      const stats = await Attendance.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$workHours.actual' },
            overtimeHours: { $sum: '$workHours.overtime' }
          }
        }
      ]);

      // Get total eligible staff count
      const totalStaff = await getEligibleStaff();

      res.status(200).json({
        success: true,
        data: {
          month: targetMonth,
          year: targetYear,
          totalStaff: totalStaff.length,
          statistics: stats
        }
      });
    }
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching attendance statistics",
    });
  }
};

// @desc    Bulk mark attendance
// @route   POST /api/attendance/bulk
// @access  Private (Admin/System Admin only)
export const bulkMarkAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { attendanceRecords, date } = req.body;
    const attendanceDate = toAttendanceDate(date);

    // Build a single eligibility lookup so we don't re-query per record.
    const staffIds = [...new Set(attendanceRecords.map((r) => String(r.staff)))];
    const users = await User.find({ _id: { $in: staffIds } }).populate('role').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const results = [];
    const failures = [];

    for (const record of attendanceRecords) {
      const u = userMap.get(String(record.staff));
      if (!u || !u.isActive
          || u.isSystemAdmin
          || (u.role && ['Admin', 'System Administrator'].includes(u.role.name))) {
        failures.push({ staff: record.staff, error: 'Staff not eligible' });
        continue;
      }
      if (record.status === 'leave' && (!record.leaveType || !record.leaveReason)) {
        failures.push({ staff: record.staff, error: 'Leave type and reason required' });
        continue;
      }

      const set = {
        status: record.status,
        notes: record.notes,
        approvedBy: req.user?._id || null,
        approvedAt: new Date(),
        modifiedBy: req.user?._id || null,
        modificationReason: 'Bulk update',
      };
      if (record.status === 'leave') {
        set.leaveType = record.leaveType;
        set.leaveReason = record.leaveReason;
      }
      if (record.clockIn) {
        set.clockIn = { time: new Date(record.clockIn), method: 'manual', ipAddress: req.ip };
      }
      if (record.clockOut) {
        set.clockOut = { time: new Date(record.clockOut), method: 'manual', ipAddress: req.ip };
      }

      try {
        const doc = await Attendance.findOneAndUpdate(
          { staff: record.staff, date: attendanceDate },
          { $set: set, $setOnInsert: { staff: record.staff, date: attendanceDate } },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
        );
        if (set.clockIn || set.clockOut) {
          doc.calculateWorkHours();
          await doc.save();
        }
        results.push({ staff: record.staff, id: doc._id });
      } catch (err) {
        failures.push({ staff: record.staff, error: err.code === 11000 ? 'Duplicate' : err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk attendance operation completed. ${results.length} records processed.`,
      data: {
        successful: results,
        errors: failures,
        summary: {
          total: attendanceRecords.length,
          successful: results.length,
          failed: failures.length,
        },
      },
    });
  } catch (error) {
    console.error('Bulk mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing bulk attendance",
    });
  }
};

// @desc    Get eligible staff for attendance (excluding admin and system admin)
// @route   GET /api/attendance/eligible-staff
// @access  Private (Admin/System Admin only)
export const getEligibleStaffForAttendance = async (req, res) => {
  try {
    const staff = await getEligibleStaff();

    res.status(200).json({
      success: true,
      data: staff.map(s => ({
        _id: s._id,
        firstName: s.firstName,
        lastName: s.lastName,
        employeeId: s.profile.employeeId,
        role: s.role,
        department: s.department,
        email: s.email,
        phone: s.phone
      }))
    });
  } catch (error) {
    console.error('Get eligible staff error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching eligible staff",
    });
  }
};
