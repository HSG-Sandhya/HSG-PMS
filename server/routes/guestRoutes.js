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

import { requireManage, requirePermission } from '../middleware/requireManage.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('guest ID'));

router.get('/', requirePermission(['view_guests', 'manage_guests']), getAllGuests);
router.get('/search', requirePermission(['view_guests', 'manage_guests']), searchGuests);
router.get('/:id', requirePermission(['view_guests', 'manage_guests']), getGuestById);
router.post('/', requireManage('manage_guests'), createGuest);
router.put('/:id', requireManage('manage_guests'), updateGuest);
router.delete('/:id', requireManage('manage_guests'), deleteGuest);

export default router;
