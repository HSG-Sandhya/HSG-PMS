import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();
import { login, logout, getProfile, refreshToken, forceLogoutAll, changeOwnPassword, getSetupStatus, bootstrapAdmin, requestSetupOtp, verifySetupOtp } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive a JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: JWT token and user profile.
 *       401:
 *         description: Invalid credentials.
 */
// Public routes
router.post('/login', login);
router.post('/logout', logout);

// First-run setup (public, but self-closing once any user exists).
router.get('/setup-status', getSetupStatus);
router.post('/setup/otp/send', requestSetupOtp);
router.post('/setup/otp/verify', verifySetupOtp);
router.post('/setup', bootstrapAdmin);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

// Self-service: any logged-in user changes their own password.
router.put('/change-password', authenticateToken, changeOwnPassword);

// Token validation endpoint
router.get('/validate', authenticateToken, (req, res) => {
  try {
    // If we reach here, the token is valid (middleware passed)
    res.json({
      success: true,
      valid: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      },
      message: 'Token is valid'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      message: 'Token validation failed',
      error: error.message
    });
  }
});

// Token verification endpoint (alias for validate) - Optional auth for testing
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({
      success: true,
      valid: false,
      message: 'No token provided - authentication optional'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    if (!process.env.JWT_SECRET) {
      return res.json({
        success: false,
        valid: false,
        message: 'JWT_SECRET not configured'
      });
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({
      success: true,
      valid: true,
      user: {
        id: verified.id,
        username: verified.username,
        email: verified.email,
        role: verified.role
      },
      message: 'Token is valid'
    });
  } catch (error) {
    res.json({
      success: true,
      valid: false,
      message: 'Invalid token but endpoint accessible',
      error: error.message
    });
  }
});

// Token refresh endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify the current token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data from database
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('role department');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Create new token with fresh permissions
    const tokenPayload = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role?._id || user.role,
      roleName: user.role?.name || 'user',
      department: user.department?._id || user.department,
      departmentName: user.department?.name || 'General',
      isSystemAdmin: user.isSystemAdmin || false,
      permissions: user.permissions || []
    };

    const newToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Prepare user response
    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName(),
      role: user.role,
      department: user.department,
      isSystemAdmin: user.isSystemAdmin,
      profile: user.profile,
      permissions: user.permissions
    };

    res.json({
      success: true,
      token: newToken,
      user: userResponse,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Enhanced token refresh endpoint (public)
router.post('/refresh-token-new', refreshToken);

// Force logout all sessions
router.post('/force-logout-all', forceLogoutAll);

export default router;