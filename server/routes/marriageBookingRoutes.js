import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  getAvailableDates,
} from '../controllers/marriageBookingController.js';

import { requireManage, requirePermission } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('booking ID'));

router.get('/available-dates/:month/:year', requirePermission(['view_events', 'manage_events']), getAvailableDates);
router.get('/', requirePermission(['view_events', 'manage_events']), getAllBookings);
router.get('/:id', requirePermission(['view_events', 'manage_events']), getBookingById);
router.post('/', requireManage('manage_events'), createBooking);
router.put('/:id', requireManage('manage_events'), updateBooking);
router.delete('/:id', requireManage('manage_events'), deleteBooking);

export default router;
