import StaffTransaction from '../models/StaffTransaction.js';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import { syncStaffTransactionExpense, removeEntriesBySource } from '../services/accountingSync.js';

// @desc    Get all transactions for a staff member
// @route   GET /api/staff/:staffId/transactions
// @access  Private (Admin/System Admin only)
export const getStaffTransactions = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate, type, status } = req.query;

    // Build query
    let query = { staff: staffId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }

    const transactions = await StaffTransaction.find(query)
      .populate('staff', 'firstName lastName profile.employeeId')
      .populate('processedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('Get staff transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};

// @desc    Create new staff transaction
// @route   POST /api/staff/transactions
// @access  Private (Admin/System Admin only)
export const createStaffTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId, amount, type, reason, paymentMethod, notes } = req.body;

    // Verify staff exists
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const transaction = new StaffTransaction({
      staff: staffId,
      amount,
      type,
      reason,
      paymentMethod: paymentMethod || 'cash',
      notes,
      processedBy: req.user?._id || null
    });

    await transaction.save();
    
    await transaction.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    // Record the payout to staff as an accounting expense.
    await syncStaffTransactionExpense(transaction);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction',
      error: error.message
    });
  }
};

// @desc    Update transaction status
// @route   PUT /api/staff/transactions/:id
// @access  Private (Admin/System Admin only)
export const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod, referenceNumber, notes } = req.body;

    const transaction = await StaffTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    transaction.status = status;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (referenceNumber) transaction.referenceNumber = referenceNumber;
    if (notes) transaction.notes = notes;

    await transaction.save();
    
    await transaction.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    // Keep accounting in step (a cancelled transaction removes its expense).
    await syncStaffTransactionExpense(transaction);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction'
    });
  }
};

// @desc    Get staff transaction summary
// @route   GET /api/staff/:staffId/transactions/summary
// @access  Private (Admin/System Admin only)
export const getStaffTransactionSummary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const summary = await StaffTransaction.getStaffSummary(staffId, start, end);
    
    // Calculate totals
    let totalCredit = 0;
    let totalDebit = 0;
    
    summary.forEach(item => {
      if (['advance', 'salary', 'bonus', 'overtime'].includes(item._id)) {
        totalCredit += item.totalAmount;
      } else {
        totalDebit += item.totalAmount;
      }
    });

    res.json({
      success: true,
      summary: {
        breakdown: summary,
        totalCredit,
        totalDebit,
        netAmount: totalCredit - totalDebit,
        period: { startDate: start, endDate: end }
      }
    });
  } catch (error) {
    console.error('Get transaction summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction summary'
    });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/staff/transactions/:id
// @access  Private (Admin/System Admin only)
export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await StaffTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Only allow deletion of pending transactions
    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending transactions can be deleted'
      });
    }

    await StaffTransaction.findByIdAndDelete(id);
    await removeEntriesBySource('staff_transaction', id); // drop any linked expense entry

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction'
    });
  }
};

// @desc    Get all transactions (admin view)
// @route   GET /api/staff/transactions
// @access  Private (Admin/System Admin only)
export const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, staffId } = req.query;

    // Build query
    let query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (staffId) query.staff = staffId;

    const transactions = await StaffTransaction.find(query)
      .populate('staff', 'firstName lastName profile.employeeId')
      .populate('processedBy', 'firstName lastName')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StaffTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};
