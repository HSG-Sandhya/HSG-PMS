import express from 'express';
import { lookupGst } from '../controllers/gstController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All GST lookup routes require authentication.
router.use(authenticateToken);

// Look up a GSTIN → registered company name + address.
router.post('/lookup', lookupGst);

export default router;
