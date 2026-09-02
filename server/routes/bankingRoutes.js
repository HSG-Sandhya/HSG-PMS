import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { requireManage, requirePermission } from '../middleware/requireManage.js';
const router = express.Router();
import { getAccounts, getAccountById, createAccount, updateAccount, deleteAccount } from '../controllers/accountController.js';
import { getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction } from '../controllers/transactionController.js';
import { getSummary } from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/auth.js';

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));

// Account endpoints
router.get('/accounts', authenticateToken, requirePermission(['view_financial_reports', 'manage_payments', 'manage_accounting']), getAccounts);
router.get('/accounts/:id', authenticateToken, requirePermission(['view_financial_reports', 'manage_payments', 'manage_accounting']), getAccountById);
router.post('/accounts', authenticateToken, requireManage('manage_payments'), createAccount);
router.put('/accounts/:id', authenticateToken, requireManage('manage_payments'), updateAccount);
router.delete('/accounts/:id', authenticateToken, requireManage('manage_payments'), deleteAccount);

// Transaction endpoints
router.get('/transactions', authenticateToken, requirePermission(['view_financial_reports', 'manage_payments', 'manage_accounting']), getTransactions);
router.get('/transactions/:id', authenticateToken, requirePermission(['view_financial_reports', 'manage_payments', 'manage_accounting']), getTransactionById);
router.post('/transactions', authenticateToken, requireManage('manage_payments'), createTransaction);
router.put('/transactions/:id', authenticateToken, requireManage('manage_payments'), updateTransaction);
router.delete('/transactions/:id', authenticateToken, requireManage('manage_payments'), deleteTransaction);

// Report endpoints
router.get('/reports/summary', authenticateToken, requirePermission(['view_financial_reports', 'manage_payments', 'manage_accounting']), getSummary);

export default router;