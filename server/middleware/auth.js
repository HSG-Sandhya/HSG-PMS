import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { tokenMatchesCurrentTenant, tenantSlugOfToken } from '../db/tenantContext.js';
import { isTokenRevoked } from '../utils/tokenRevocation.js';
import { tokenFromCookie } from '../utils/authCookie.js';
import { isAdminActor } from '../utils/isAdminActor.js';

const JWT_ALGORITHMS = process.env.JWT_ALGORITHMS
  ? process.env.JWT_ALGORITHMS.split(",").map((a) => a.trim()).filter(Boolean)
  : ["HS256"];

const getTokenFromRequest = (req) => {
  // Preferred: the HttpOnly session cookie, which JavaScript cannot read.
  const cookieToken = tokenFromCookie(req);
  if (cookieToken) return cookieToken;

  // Still accepted: the Authorization header. Sessions issued before the cookie
  // rollout keep working, as do scripts and API clients.
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }

  const headerToken = req.headers["x-auth-token"];
  return typeof headerToken === "string" && headerToken.trim()
    ? headerToken.trim()
    : null;
};

const authenticateToken = (req, res, next) => {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    return res.status(401).json({ 
      success: false,
      message: 'Access denied. No token provided.' 
    });
  }

  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not configured');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: JWT_ALGORITHMS,
    });
    
    // Validate user ID format if present
    const userId = decoded.id || decoded.userId;
    if (userId && !userId.match(/^[0-9a-fA-F]{24}$/)) {
      logger.warn('Authentication failed: Invalid user ID format', {
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Reject a token issued for a different hotel. This path trusts the decoded
    // payload without a DB lookup, so the tenant claim is the only thing stopping
    // a validly-signed token from one hotel being used against another.
    if (!tokenMatchesCurrentTenant(decoded)) {
      logger.warn('Authentication failed: token tenant mismatch', {
        tokenTenant: tenantSlugOfToken(decoded),
        host: req.hostname,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        message: 'Your session is not valid for this hotel. Please sign in again.'
      });
    }

    // Sessions ended by logout / force-logout-all. The signature is still
    // valid — that is the point: a stateless JWT stays cryptographically sound
    // after logout, so the cut-off recorded at revocation is what stops it.
    if (isTokenRevoked(decoded)) {
      logger.warn('Authentication failed: token revoked (logged out)', {
        userId: decoded.id || decoded.userId,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        message: 'Session ended. Please login again.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      error: error.message,
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    if (!process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: JWT_ALGORITHMS,
    });
    // Ignore a token issued for a different hotel — treat as anonymous.
    const usable = tokenMatchesCurrentTenant(verified) && !isTokenRevoked(verified);
    req.user = usable ? verified : null;
  } catch (error) {
    req.user = null;
  }

  next();
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Administrator status by grant, not by the role's display name — a role
  // could be renamed (or created) to match a hard-coded string.
  const isAdmin = isAdminActor(req.user);

  const hasManageStaffPermission = req.user.permissions &&
                                   req.user.permissions.includes('manage_staff');
  
  if (isAdmin || hasManageStaffPermission) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
};

// Alias for consistency with existing code
const requireAuth = authenticateToken;

export { authenticateToken, optionalAuth, requireAuth, requireAdmin };
