import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { isConfigured, generateOtp, submitOtp } from '../services/aadhaarKyc.js';
import { isValidAadhaar, normalizeAadhaar } from '../utils/aadhaar.js';

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

// Short-lived OTP session store. For the real provider we keep the vendor's
// client_id; for the dev fallback we keep the simulated code. (In-memory is
// fine here — an OTP session lives ~10 min. Use Redis if you run >1 instance.)
const otpStorage = new Map();

const generateMockOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP for Aadhaar verification.
//  • Provider configured  → real OTP goes to the UIDAI-registered mobile.
//  • Not configured (dev) → clearly-labelled simulation; code returned in body.
const sendAadharOTP = async (req, res) => {
  try {
    const aadharNumber = normalizeAadhaar(req.body.aadharNumber);

    if (!/^\d{12}$/.test(aadharNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar number format' });
    }
    // Reject fake numbers (bad checksum) before spending a provider API call.
    if (!isValidAadhaar(aadharNumber)) {
      return res.status(400).json({
        success: false,
        message: 'That is not a valid Aadhaar number (checksum failed). Please re-check the 12 digits.',
      });
    }

    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (isConfigured()) {
      let clientId;
      try {
        ({ clientId } = await generateOtp(aadharNumber));
      } catch (err) {
        console.error('Aadhaar generate-otp failed:', err.providerMessage || err.message);
        return res.status(502).json({
          success: false,
          message: err.providerMessage || 'Could not send Aadhaar OTP. Please try again.',
        });
      }
      otpStorage.set(aadharNumber, { clientId, expiry: otpExpiry, attempts: 0, real: true });
      return res.json({
        success: true,
        message: `OTP sent to the mobile registered with Aadhaar ****${aadharNumber.slice(-4)}`,
        data: { aadharNumber, otpExpiry: new Date(otpExpiry).toISOString() },
      });
    }

    // Dev fallback — no KYC provider configured.
    const otp = generateMockOTP();
    otpStorage.set(aadharNumber, { otp, expiry: otpExpiry, attempts: 0, real: false });
    console.log(`🔐 [DEV/simulated] Aadhaar OTP for ${aadharNumber}: ${otp} (no KYC provider configured)`);
    return res.json({
      success: true,
      message: 'Demo mode: no real OTP was sent. Enter the code shown to continue.',
      data: {
        aadharNumber,
        otpExpiry: new Date(otpExpiry).toISOString(),
        demo: true,
        testOTP: otp, // surfaced by the UI only in this simulated mode
      },
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// Verify the OTP against whichever channel issued it (provider or dev sim).
const verifyAadharOTP = async (req, res) => {
  try {
    const aadharNumber = normalizeAadhaar(req.body.aadharNumber);
    const { otp } = req.body;

    if (!aadharNumber || !otp) {
      return res.status(400).json({ success: false, message: 'Aadhaar number and OTP are required' });
    }

    const stored = otpStorage.get(aadharNumber);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'OTP not found or expired. Please request a new OTP.' });
    }
    if (Date.now() > stored.expiry) {
      otpStorage.delete(aadharNumber);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }
    if (stored.attempts >= 3) {
      otpStorage.delete(aadharNumber);
      return res.status(400).json({ success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    if (stored.real) {
      // Real provider verification — returns the UIDAI KYC profile on success.
      try {
        const result = await submitOtp(stored.clientId, otp);
        otpStorage.delete(aadharNumber);
        return res.json({
          success: true,
          message: 'Aadhaar verified successfully',
          data: {
            aadharNumber,
            verified: true,
            verifiedAt: new Date().toISOString(),
            fullName: result.fullName,
            dob: result.dob,
            gender: result.gender,
          },
        });
      } catch (err) {
        stored.attempts += 1;
        return res.status(400).json({
          success: false,
          message: err.providerMessage || 'Invalid OTP. Please try again.',
          attemptsRemaining: 3 - stored.attempts,
        });
      }
    }

    // Dev fallback verification.
    if (stored.otp !== otp) {
      stored.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        attemptsRemaining: 3 - stored.attempts,
      });
    }
    otpStorage.delete(aadharNumber);
    return res.json({
      success: true,
      message: 'Aadhaar verified (demo mode)',
      data: { aadharNumber, verified: true, verifiedAt: new Date().toISOString(), demo: true },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
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
