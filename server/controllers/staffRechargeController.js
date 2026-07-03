import StaffRecharge from '../models/StaffRecharge.js';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import { syncStaffRechargeExpense, removeEntriesBySource } from '../services/accountingSync.js';

// @desc    Get all recharges for a staff member
// @route   GET /api/staff/:staffId/recharges
// @access  Private (Admin/System Admin only)
export const getStaffRecharges = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate, status, operator } = req.query;

    // Build query
    let query = { staff: staffId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (operator) {
      query.operator = operator;
    }

    const recharges = await StaffRecharge.find(query)
      .populate('staff', 'firstName lastName profile.employeeId')
      .populate('processedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: recharges.length,
      recharges
    });
  } catch (error) {
    console.error('Get staff recharges error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recharges'
    });
  }
};

// @desc    Create new staff recharge
// @route   POST /api/staff/recharges
// @access  Private (Admin/System Admin only)
export const createStaffRecharge = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      staffId, 
      phoneNumber, 
      amount, 
      operator, 
      planType, 
      planDetails, 
      paymentMethod, 
      notes 
    } = req.body;

    // Verify staff exists
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const recharge = new StaffRecharge({
      staff: staffId,
      phoneNumber,
      amount,
      operator,
      planType: planType || 'prepaid',
      planDetails,
      paymentMethod: paymentMethod || 'cash',
      notes,
      processedBy: req.user?._id || null,
      status: 'processing' // Start with processing status
    });

    await recharge.save();
    
    // Simulate recharge processing (in real app, integrate with recharge API)
    setTimeout(async () => {
      try {
        // Simulate success/failure (90% success rate)
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess) {
          await recharge.markAsSuccess(
            recharge.transactionId,
            `OP${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
          );
          // Recharge went through → record the cash paid to the operator as an
          // expense against this staff member (staff is populated below by the
          // time this fires 2s later).
          await syncStaffRechargeExpense(recharge);
        } else {
          await recharge.markAsFailed('Operator service temporarily unavailable');
        }
      } catch (error) {
        console.error('Recharge processing error:', error);
      }
    }, 2000); // 2 second delay to simulate processing
    
    await recharge.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Recharge initiated successfully',
      recharge
    });
  } catch (error) {
    console.error('Create recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing recharge'
    });
  }
};

// @desc    Update recharge status
// @route   PUT /api/staff/recharges/:id
// @access  Private (Admin/System Admin only)
export const updateRechargeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, operatorTransactionId, failureReason, notes } = req.body;

    const recharge = await StaffRecharge.findById(id);
    if (!recharge) {
      return res.status(404).json({
        success: false,
        message: 'Recharge not found'
      });
    }

    recharge.status = status;
    if (operatorTransactionId) recharge.operatorTransactionId = operatorTransactionId;
    if (failureReason) recharge.failureReason = failureReason;
    if (notes) recharge.notes = notes;

    await recharge.save();

    await recharge.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    // Keep accounting in step: success posts the expense, any other status
    // (failed/cancelled/pending) removes it.
    await syncStaffRechargeExpense(recharge);

    res.json({
      success: true,
      message: 'Recharge updated successfully',
      recharge
    });
  } catch (error) {
    console.error('Update recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating recharge'
    });
  }
};

// @desc    Get staff recharge summary
// @route   GET /api/staff/:staffId/recharges/summary
// @access  Private (Admin/System Admin only)
export const getStaffRechargeSummary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const summary = await StaffRecharge.getStaffSummary(staffId, start, end);
    
    // Get total amount and count
    const totals = await StaffRecharge.aggregate([
      {
        $match: {
          staff: new mongoose.Types.ObjectId(staffId),
          date: { $gte: start, $lte: end },
          status: 'success'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      summary: {
        breakdown: summary,
        totalAmount: totals[0]?.totalAmount || 0,
        totalCount: totals[0]?.totalCount || 0,
        period: { startDate: start, endDate: end }
      }
    });
  } catch (error) {
    console.error('Get recharge summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recharge summary'
    });
  }
};

// @desc    Get recharge by transaction ID
// @route   GET /api/staff/recharges/transaction/:transactionId
// @access  Private (Admin/System Admin only)
export const getRechargeByTransactionId = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const recharge = await StaffRecharge.findOne({ transactionId })
      .populate('staff', 'firstName lastName profile.employeeId')
      .populate('processedBy', 'firstName lastName');

    if (!recharge) {
      return res.status(404).json({
        success: false,
        message: 'Recharge not found'
      });
    }

    res.json({
      success: true,
      recharge
    });
  } catch (error) {
    console.error('Get recharge by transaction ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recharge'
    });
  }
};

// @desc    Cancel recharge
// @route   DELETE /api/staff/recharges/:id
// @access  Private (Admin/System Admin only)
export const cancelRecharge = async (req, res) => {
  try {
    const { id } = req.params;

    const recharge = await StaffRecharge.findById(id);
    if (!recharge) {
      return res.status(404).json({
        success: false,
        message: 'Recharge not found'
      });
    }

    // Only allow cancellation of pending or processing recharges
    if (!['pending', 'processing'].includes(recharge.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or processing recharges can be cancelled'
      });
    }

    recharge.status = 'cancelled';
    recharge.failureReason = 'Cancelled by admin';
    await recharge.save();
    await removeEntriesBySource('staff_recharge', id); // drop any linked expense

    res.json({
      success: true,
      message: 'Recharge cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling recharge'
    });
  }
};

// @desc    Get all recharges (admin view)
// @route   GET /api/staff/recharges
// @access  Private (Admin/System Admin only)
export const getAllRecharges = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, operator, staffId } = req.query;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (operator) query.operator = operator;
    if (staffId) query.staff = staffId;

    const recharges = await StaffRecharge.find(query)
      .populate('staff', 'firstName lastName profile.employeeId')
      .populate('processedBy', 'firstName lastName')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StaffRecharge.countDocuments(query);

    res.json({
      success: true,
      recharges,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecharges: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get all recharges error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recharges'
    });
  }
};

// @desc    Get monthly recharge statistics
// @route   GET /api/staff/recharges/stats/:year/:month
// @access  Private (Admin/System Admin only)
export const getMonthlyRechargeStats = async (req, res) => {
  try {
    const { year, month } = req.params;

    const stats = await StaffRecharge.getMonthlyStats(parseInt(year), parseInt(month));

    res.json({
      success: true,
      stats,
      period: { year: parseInt(year), month: parseInt(month) }
    });
  } catch (error) {
    console.error('Get monthly recharge stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recharge statistics'
    });
  }
};
