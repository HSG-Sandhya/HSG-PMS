import express from 'express';
import { sendAadharOTP, verifyAadharOTP, uploadAadharImage, upload } from '../controllers/aadharController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// All Aadhar routes require authentication
router.use(authenticateToken);

// Aadhaar KYC is only reached from the staff form, so it follows the same
// permissions as creating/editing a staff record (see routes/adminRoutes.js).
// Like the GST lookup, each OTP is a metered Surepass call.
const MANAGE_STAFF = ['manage_staff', 'create_staff', 'edit_staff'];

// Send OTP for Aadhar verification
router.post('/send-otp', requireManage(MANAGE_STAFF), sendAadharOTP);

// Verify OTP for Aadhar
router.post('/verify-otp', requireManage(MANAGE_STAFF), verifyAadharOTP);

// Upload Aadhar image
router.post('/upload', requireManage(MANAGE_STAFF), upload.single('aadharImage'), uploadAadharImage);

export default router;
