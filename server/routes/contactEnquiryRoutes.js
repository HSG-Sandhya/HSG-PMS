import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage, requirePermission } from '../middleware/requireManage.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { listEnquiries, getEnquiry, updateEnquiry } from '../controllers/contactEnquiryController.js';

const router = express.Router();

router.use(authenticateToken);
router.param('id', objectIdParam('enquiry ID'));

// An enquiry is a member of the public's name, email, phone and message, so it
// is guest data and gated like guest data. Reception holds these already.
const canRead = requirePermission(['view_guests', 'manage_guests', 'manage_bookings']);
const canWrite = requireManage(['manage_guests', 'manage_bookings']);

router.get('/', canRead, listEnquiries);
router.get('/:id', canRead, getEnquiry);
router.patch('/:id', canWrite, updateEnquiry);

export default router;
