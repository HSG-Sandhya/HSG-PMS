import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';

const getSignedAmount = (type, amount) => {
  const value = Number(amount) || 0;
  if (type === 'income') return value;
  if (type === 'expense') return -value;
  return 0;
};

// Get all transactions
export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find().populate('accountId');
    res.json({
      success: true,
      data: transactions,
      message: 'Transactions fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching transactions', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single transaction by ID
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('accountId');
    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        message: 'Transaction not found' 
      });
    }
    res.json({
      success: true,
      data: transaction,
      message: 'Transaction fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching transaction', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new transaction
export const createTransaction = async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();
    
    // Optionally update account balance
    if (transaction.accountId && transaction.amount) {
      const account = await Account.findById(transaction.accountId);
      if (account) {
        if (transaction.type === 'income') {
          account.balance += transaction.amount;
        } else if (transaction.type === 'expense') {
          account.balance -= transaction.amount;
        }
        await account.save();
      }
    }
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transaction created successfully'
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        error: error.message 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Error creating transaction', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update transaction
export const updateTransaction = async (req, res) => {
  try {
    const existingTransaction = await Transaction.findById(req.params.id);
    if (!existingTransaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Keep account balances in sync when account/type/amount changes
    const oldAccountId = existingTransaction.accountId?.toString();
    const newAccountId = transaction.accountId?.toString();
    const oldEffect = getSignedAmount(existingTransaction.type, existingTransaction.amount);
    const newEffect = getSignedAmount(transaction.type, transaction.amount);

    if (oldAccountId && newAccountId && oldAccountId === newAccountId) {
      const delta = newEffect - oldEffect;
      if (delta !== 0) {
        const account = await Account.findById(newAccountId);
        if (account) {
          account.balance += delta;
          await account.save();
        }
      }
    } else {
      if (oldAccountId) {
        const oldAccount = await Account.findById(oldAccountId);
        if (oldAccount) {
          oldAccount.balance -= oldEffect;
          await oldAccount.save();
        }
      }
      if (newAccountId) {
        const newAccount = await Account.findById(newAccountId);
        if (newAccount) {
          newAccount.balance += newEffect;
          await newAccount.save();
        }
      }
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error updating transaction', error: error.message });
  }
};

// Delete transaction
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    // Optionally update account balance
    if (transaction.accountId && transaction.amount) {
      const account = await Account.findById(transaction.accountId);
      if (account) {
        if (transaction.type === 'income') {
          account.balance -= transaction.amount;
        } else if (transaction.type === 'expense') {
          account.balance += transaction.amount;
        }
        await account.save();
      }
    }
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
};
