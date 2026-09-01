import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();
import { login, logout, getProfile, forceLogoutAll, changeOwnPassword, changeOwnUsername, getSetupStatus, bootstrapAdmin, requestSetupOtp, verifySetupOtp } from '../controllers/authController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';
import { getCurrentTenant } from '../db/tenantContext.js';
import { setAuthCookie } from '../utils/authCookie.js';

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
router.post('/logout', optionalAuth, logout);

// First-run setup (public, but self-closing once any user exists).
router.get('/setup-status', getSetupStatus);
router.post('/setup/otp/send', requestSetupOtp);
router.post('/setup/otp/verify', verifySetupOtp);
router.post('/setup', bootstrapAdmin);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

// Self-service: any logged-in user changes their own password / username.
router.put('/change-password', authenticateToken, changeOwnPassword);
router.put('/change-username', authenticateToken, changeOwnUsername);

// REMOVED: '/validate' and '/verify'. Two token-introspection endpoints that
// duplicated each other and were called by nothing — not the admin client, the
// website, or anything under deploy/. '/verify' was additionally broken: it ran
// `const jwt = require('jsonwebtoken')` inside an ES module, so it threw
// ReferenceError on every call and reported a perfectly good token as invalid.
// A caller who needs to check a token can use any authenticated route, or
// /auth/profile.

// Token refresh endpoint.
//
// Guarded by authenticateToken rather than a local jwt.verify. The JWT secret is
// shared by every hotel, so a signature check alone does NOT establish which
// tenant a token belongs to: presented against another hotel's host, a validly
// signed token would previously be exchanged for a token stamped with THAT
// host's tenant slug — a cross-tenant upgrade, bounded only by whether the
// user's _id happened to exist in the other hotel's database (which it would
// if that database was ever seeded from this one).
//
// authenticateToken enforces the tenant claim (tokenMatchesCurrentTenant) plus
// the ObjectId-shaped subject check, so renewal can only ever occur on the
// hotel the token was issued for.
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    const decoded = req.user;

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
      // Role grants + user-specific extras (see login in authController.js) —
      // role permissions alone are where nearly everything is granted.
      permissions: [...new Set([
        ...(user.role?.permissions || []),
        ...(user.permissions || []),
      ])],
      // Required: without it tenantSlugOfToken() falls back to "base", so on
      // any hotel other than the original the refreshed token would be rejected
      // by authenticateToken on the very next request. Safe to read from the
      // host because authenticateToken has already established that the
      // incoming token's tenant matches it.
      tenant: getCurrentTenant().slug,
    };

    // Must match login's default (authController.js). These had drifted to
    // '24h' here vs '30d' there, and JWT_EXPIRES_IN is unset, so every refresh
    // silently cut a 30-day session down to one day.
    const newToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
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

    setAuthCookie(res, newToken);

    res.json({
      success: true,
      token: newToken,
      user: userResponse,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    // Verification already happened in authenticateToken, so a failure here is
    // a server-side fault (typically the DB lookup). It must NOT be reported as
    // 401: the client interceptor treats any 401 as a dead session and force-
    // logs the user out, so a transient database blip would end every session.
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not refresh session. Please try again.'
    });
  }
});

// REMOVED: '/refresh-token-new'. It was public and signed a valid JWT for any
// anonymous caller — no credentials, no user lookup, a random UUID as the
// subject. Nothing called it. It was survivable only because authenticateToken
// happens to reject a non-ObjectId `id`; that is an incidental guard, not a
// designed one. Token issuance belongs to /login and /refresh-token alone.

// Force logout all sessions
// Ends every session for every user, the caller's included. This was PUBLIC
// while it was a no-op; now that it actually revokes, an unauthenticated caller
// could have logged out the entire hotel at will.
router.post(
  '/force-logout-all',
  authenticateToken,
  requireManage(['system_administration', 'admin_access']),
  forceLogoutAll,
);

export default router;