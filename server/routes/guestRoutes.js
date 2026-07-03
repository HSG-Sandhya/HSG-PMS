import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAllGuests,
  searchGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
} from '../controllers/guestController.js';

import { requireManage } from '../middleware/requireManage.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('guest ID'));

router.get('/', getAllGuests);
router.get('/search', searchGuests);
router.get('/:id', getGuestById);
router.post('/', requireManage('manage_guests'), createGuest);
router.put('/:id', requireManage('manage_guests'), updateGuest);
router.delete('/:id', requireManage('manage_guests'), deleteGuest);

export default router;
