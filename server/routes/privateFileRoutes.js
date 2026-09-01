import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { getBookingIdCard, getStaffAadhaar } from '../controllers/privateFileController.js';

const router = express.Router();

// Identity documents (Aadhaar, passports, driving licences) used to sit in a
// directory served by express.static with `Access-Control-Allow-Origin: *`.
// Every read now goes through authentication, a permission check, and an
// ownership lookup on the tenant-bound connection.
router.use(authenticateToken);

router.param('id', objectIdParam('record ID'));

router.get(
  '/booking/:id/id-card/:side',
  requireManage(['manage_bookings', 'manage_guests']),
  getBookingIdCard,
);

// Express 5's router has no optional-parameter syntax (`:side?`), so the
// default-side route is registered explicitly.
router.get(
  '/staff/:id/aadhaar',
  requireManage(['manage_staff']),
  getStaffAadhaar,
);

router.get(
  '/staff/:id/aadhaar/:side',
  requireManage(['manage_staff']),
  getStaffAadhaar,
);

export default router;
