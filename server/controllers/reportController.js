import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';

// Get summary report
export const getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let transactionFilter = {};
    if (startDate && endDate) {
      transactionFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(transactionFilter);
    const accounts = await Account.find({ isActive: true });

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = totalIncome - totalExpense;
    const totalAccounts = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netIncome,
        totalAccounts,
        transactionCount: transactions.length,
        accountCount: accounts.length
      },
      message: 'Summary report generated successfully'
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating summary', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};