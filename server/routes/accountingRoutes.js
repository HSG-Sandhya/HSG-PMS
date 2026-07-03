import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getReports,
} from '../controllers/accountingController.js';

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('entry ID'));

// Consolidated reports (cash book, ledger, GST, P&L, balance sheet)
router.get('/reports', getReports);

// Income & expense entries
router.get('/entries', getEntries);
router.post('/entries', requireManage('manage_accounting'), createEntry);
router.put('/entries/:id', requireManage('manage_accounting'), updateEntry);
router.delete('/entries/:id', requireManage('manage_accounting'), deleteEntry);

export default router;
