import Account from '../models/Account.js';
import AccountingEntry from '../models/AccountingEntry.js';

// Net movement (income − expense) per payment bucket across the whole ledger.
// Bank balances are cumulative, so this is intentionally all-time (not period
// filtered). Returns e.g. { UPI: 126000, Bank: 50000, Cash: 8400 }.
const ledgerNetByBucket = async () => {
  const rows = await AccountingEntry.aggregate([
    {
      $group: {
        _id: '$account',
        net: {
          $sum: { $cond: [{ $eq: ['$entryType', 'income'] }, '$total', { $multiply: ['$total', -1] }] },
        },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.net]));
};

// Get all accounts, each with a live balance = opening balance + ledger net of
// the payment buckets it claims (paymentMethods).
export const getAccounts = async (req, res) => {
  try {
    const [accounts, netByBucket] = await Promise.all([
      Account.getActiveAccounts(),
      ledgerNetByBucket(),
    ]);
    const data = accounts.map((a) => {
      const obj = a.toObject();
      const ledgerNet = (obj.paymentMethods || []).reduce((s, m) => s + (netByBucket[m] || 0), 0);
      obj.openingBalance = obj.balance || 0;      // what the user typed
      obj.ledgerNet = Math.round(ledgerNet * 100) / 100;
      obj.currentBalance = Math.round((obj.openingBalance + ledgerNet) * 100) / 100;
      return obj;
    });
    res.json({
      success: true,
      data,
      message: 'Accounts fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching accounts', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single account by ID
export const getAccountById = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    res.json({
      success: true,
      data: account,
      message: 'Account fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching account', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new account
export const createAccount = async (req, res) => {
  try {
    const account = new Account(req.body);
    await account.save();
    res.status(201).json({
      success: true,
      data: account,
      message: 'Account created successfully'
    });
  } catch (error) {
    console.error('Error creating account:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        error: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Error creating account', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update account
export const updateAccount = async (req, res) => {
  try {
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    res.json({
      success: true,
      data: account,
      message: 'Account updated successfully'
    });
  } catch (error) {
    console.error('Error updating account:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        error: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Error updating account', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete account (soft delete)
export const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Account not found' 
      });
    }
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting account', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};