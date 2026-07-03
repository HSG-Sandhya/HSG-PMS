import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAllHalls,
  createHall,
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  getReports,
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getAllCateringPackages,
  createCateringPackage,
  updateCateringPackage,
  deleteCateringPackage,
  getAllDecorationPackages,
  createDecorationPackage,
  updateDecorationPackage,
  deleteDecorationPackage,
  getAllUtensilItems,
  createUtensilItem,
  updateUtensilItem,
  deleteUtensilItem,
  addBookingPayment,
  deleteBookingPayment,
  getMonthEvents,
} from '../controllers/banquetController.js';

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));

router.get('/halls', getAllHalls);
router.post('/halls', requireManage('manage_events'), createHall);

// Event packages (reusable bundles)
router.get('/packages', getAllPackages);
router.post('/packages', requireManage('manage_events'), createPackage);
router.put('/packages/:id', requireManage('manage_events'), updatePackage);
router.delete('/packages/:id', requireManage('manage_events'), deletePackage);

// Catering packages (reusable per-plate menu bundles)
router.get('/catering-packages', getAllCateringPackages);
router.post('/catering-packages', requireManage('manage_events'), createCateringPackage);
router.put('/catering-packages/:id', requireManage('manage_events'), updateCateringPackage);
router.delete('/catering-packages/:id', requireManage('manage_events'), deleteCateringPackage);

// Decoration packages (reusable flat-price décor bundles)
router.get('/decoration-packages', getAllDecorationPackages);
router.post('/decoration-packages', requireManage('manage_events'), createDecorationPackage);
router.put('/decoration-packages/:id', requireManage('manage_events'), updateDecorationPackage);
router.delete('/decoration-packages/:id', requireManage('manage_events'), deleteDecorationPackage);

// Utensil / cookware inventory (rented to self-cooking guests; live stock)
router.get('/utensil-items', getAllUtensilItems);
router.post('/utensil-items', requireManage('manage_events'), createUtensilItem);
router.put('/utensil-items/:id', requireManage('manage_events'), updateUtensilItem);
router.delete('/utensil-items/:id', requireManage('manage_events'), deleteUtensilItem);

// Event calendar — bookings within a given month
router.get('/calendar/:year/:month', getMonthEvents);

router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);
router.post('/bookings', requireManage('manage_events'), createBooking);
router.put('/bookings/:id', requireManage('manage_events'), updateBooking);
router.delete('/bookings/:id', requireManage('manage_events'), deleteBooking);

// Advance collection ledger
router.post('/bookings/:id/payments', requireManage('manage_events'), addBookingPayment);
router.delete('/bookings/:id/payments/:paymentId', requireManage('manage_events'), deleteBookingPayment);

router.get('/reports', getReports);

export default router;
