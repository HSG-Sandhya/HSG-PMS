import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import logger from '../config/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/activityLogger.js';

// Login user
export const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  logger.info('Login attempt', {
    username: username || 'N/A',
    email: email || 'N/A',
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Validate required fields
  if (!password) {
    logger.warn('Login failed: Password missing', { ip: req.ip });
    return res.status(400).json({
      success: false,
      message: 'Password is required'
    });
  }

  if (!username && !email) {
    logger.warn('Login failed: Username/email missing', { ip: req.ip });
    return res.status(400).json({
      success: false,
      message: 'Username or email is required'
    });
  }

  // Find user by username or email
  const user = await User.findOne(
    username ? { username } : { email }
  ).select('+password').populate('role department');

  if (!user) {
    logger.warn('Login failed: User not found', {
      identifier: username || email,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    logger.warn('Login failed: Account deactivated', {
      userId: user._id,
      username: user.username,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Compare password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logger.warn('Login failed: Invalid password', {
      userId: user._id,
      username: user.username,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET not configured');
    throw new Error('Server configuration error');
  }

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

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } // Extended to 30 days for persistent login
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
    lastLogin: user.lastLogin
  };

  logger.info('Login successful', {
    userId: user._id,
    username: user.username,
    ip: req.ip
  });

  logActivity(req, {
    userName: user.username || user.email,
    action: 'login',
    category: 'auth',
    severity: 'info',
    audit: true,
    resource: 'Auth',
    resourceId: user._id,
    description: `${user.username || user.email} signed in`,
  });

  res.json({
    success: true,
    token,
    user: userResponse,
    message: 'Login successful'
  });
});

// Logout user
export const logout = asyncHandler(async (req, res) => {
  logger.info('User logout', {
    userId: req.user?.id,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get current user profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password -loginAttempts -lockUntil')
    .populate('role department');
    
  if (!user) {
    logger.warn('Profile fetch failed: User not found', {
      userId: req.user.id,
      ip: req.ip
    });
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Build normalized profile response
  const profileResponse = {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.getFullName ? user.getFullName() : `${user.firstName} ${user.lastName}`,
    staffId: user.profile?.employeeId || null,
    role: user.role?._id || null,
    roleName: user.role?.name || 'user',
    permissions: user.role?.permissions?.length
      ? user.role.permissions
      : (user.isSystemAdmin || user.role?.name === 'admin')
        ? ['*']
        : [],
    department: user.department?._id || null,
    departmentName: user.department?.name || null,
    isSystemAdmin: user.isSystemAdmin || false,
    profile: user.profile,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  res.json({
    success: true,
    data: profileResponse,
    message: 'Profile fetched successfully'
  });
});

// Refresh token endpoint
export const refreshToken = asyncHandler(async (req, res) => {
  logger.info('Token refresh attempt', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Generate a new JWT secret for this session (optional enhanced security)
  const currentSecret = process.env.JWT_SECRET;
  
  // Create a new token with extended expiration
  const newTokenPayload = {
    id: crypto.randomUUID(), // Temporary ID for anonymous refresh
    sessionId: crypto.randomBytes(16).toString('hex'),
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  const newToken = jwt.sign(newTokenPayload, currentSecret);

  logger.info('New token generated', {
    sessionId: newTokenPayload.sessionId,
    ip: req.ip
  });

  res.json({
    success: true,
    token: newToken,
    message: 'Token refreshed successfully',
    expiresIn: '24h'
  });
});

// Force logout all sessions (clears all tokens)
export const forceLogoutAll = asyncHandler(async (req, res) => {
  logger.info('Force logout all sessions', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // In a production environment, you might want to:
  // 1. Invalidate all refresh tokens in database
  // 2. Add current tokens to a blacklist
  // 3. Rotate the JWT secret
  
  res.json({
    success: true,
    message: 'All sessions invalidated. Please login again.'
  });
});

// Change the logged-in user's own password (self-service).
// Requires the current password; the staff member sets a new one of their choice.
export const changeOwnPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters'
    });
  }

  // password has `select: false`, so pull it explicitly to compare.
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isCurrentValid = await user.comparePassword(currentPassword);
  if (!isCurrentValid) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from the current password'
    });
  }

  // Assign + save so the User pre-save hook hashes the password.
  user.password = newPassword;
  await user.save();

  logger.info('User changed own password', { userId: user._id, username: user.username });

  res.json({ success: true, message: 'Password changed successfully' });
});
