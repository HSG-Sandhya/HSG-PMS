import express from 'express';
import { sendAadharOTP, verifyAadharOTP, uploadAadharImage, upload } from '../controllers/aadharController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All Aadhar routes require authentication
router.use(authenticateToken);

// Send OTP for Aadhar verification
router.post('/send-otp', sendAadharOTP);

// Verify OTP for Aadhar
router.post('/verify-otp', verifyAadharOTP);

// Upload Aadhar image
router.post('/upload', upload.single('aadharImage'), uploadAadharImage);

export default router;
