import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { requireManage } from '../middleware/requireManage.js';
import {
  getCompanies,
  getCompaniesAnalytics,
  getCompanyById,
  getCompanyHistory,
  createCompany,
  updateCompany,
  deleteCompany,
  recordCreditPayment,
} from '../controllers/companyController.js';

const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('company ID'));

router.get('/', getCompanies);
router.get('/analytics', getCompaniesAnalytics);   // before /:id so it isn't read as an id
router.get('/:id', getCompanyById);
router.get('/:id/history', getCompanyHistory);
router.post('/', requireManage('manage_bookings'), createCompany);
router.put('/:id', requireManage('manage_bookings'), updateCompany);
router.delete('/:id', requireManage('manage_bookings'), deleteCompany);
router.patch('/:id/credit-payment', requireManage('manage_bookings'), recordCreditPayment);

export default router;
