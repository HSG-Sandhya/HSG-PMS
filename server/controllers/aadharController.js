import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for Aadhar image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/aadhar');
    try {
      await fs.promises.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'aadhar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// In-memory OTP storage (in production, use Redis or database)
const otpStorage = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP for Aadhar verification
const sendAadharOTP = async (req, res) => {
  try {
    const { aadharNumber } = req.body;

    // Validate Aadhar number format
    if (!aadharNumber || !/^\d{12}$/.test(aadharNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Aadhar number format'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Store OTP (in production, this should be in Redis or database)
    otpStorage.set(aadharNumber, {
      otp: otp,
      expiry: otpExpiry,
      attempts: 0
    });

    // In production, integrate with SMS gateway to send OTP
    // For demo purposes, we'll just log it
    console.log(`🔐 OTP for Aadhar ${aadharNumber}: ${otp}`);
    console.log(`📱 SMS would be sent to registered mobile number`);

    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      message: `OTP sent successfully to registered mobile number ending with ***${aadharNumber.slice(-4)}`,
      data: {
        aadharNumber: aadharNumber,
        otpExpiry: new Date(otpExpiry).toISOString(),
        // In demo mode, return OTP for testing (remove in production)
        demoOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        // Show OTP in response for development testing
        testOTP: otp
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// Verify OTP for Aadhar
const verifyAadharOTP = async (req, res) => {
  try {
    const { aadharNumber, otp } = req.body;

    // Validate input
    if (!aadharNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Aadhar number and OTP are required'
      });
    }

    // Check if OTP exists
    const storedOTPData = otpStorage.get(aadharNumber);
    if (!storedOTPData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedOTPData.expiry) {
      otpStorage.delete(aadharNumber);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check attempt limit
    if (storedOTPData.attempts >= 3) {
      otpStorage.delete(aadharNumber);
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (storedOTPData.otp !== otp) {
      storedOTPData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        attemptsRemaining: 3 - storedOTPData.attempts
      });
    }

    // OTP verified successfully
    otpStorage.delete(aadharNumber);

    res.json({
      success: true,
      message: 'Aadhar verified successfully',
      data: {
        aadharNumber: aadharNumber,
        verified: true,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
};

// Upload Aadhar image
export const uploadAadharImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const side = req.body.side || 'front'; // front or back
    
    // Generate unique filename
    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const extension = originalName.split('.').pop();
    const filename = `aadhar_${side}_${timestamp}.${extension}`;
    
    // Move file to final location
    const uploadDir = path.join(__dirname, '../uploads/aadhar');
    const finalPath = path.join(uploadDir, filename);
    fs.renameSync(req.file.path, finalPath);

    // Generate URL for accessing the image
    const imageUrl = `/uploads/aadhar/${filename}`;

    console.log(`📄 Aadhar ${side} image uploaded: ${filename}`);

    res.json({
      success: true,
      message: `Aadhar ${side} image uploaded successfully`,
      data: {
        url: imageUrl,
        filename: filename,
        side: side
      }
    });

  } catch (error) {
    console.error('Upload Aadhar image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload Aadhar image'
    });
  }
};

export {
  sendAadharOTP,
  verifyAadharOTP,
  upload
};
