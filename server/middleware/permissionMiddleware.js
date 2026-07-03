import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const JWT_ALGORITHMS = process.env.JWT_ALGORITHMS
  ? process.env.JWT_ALGORITHMS.split(",").map((a) => a.trim()).filter(Boolean)
  : ["HS256"];

const getTokenFromRequest = (req) => {
  const authHeader = req.header('Authorization');
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }

  const headerToken = req.header('x-auth-token');
  return typeof headerToken === "string" && headerToken.trim()
    ? headerToken.trim()
    : null;
};

const internalError = (res, message, error) =>
  res.status(500).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { error: error.message } : {}),
  });

// Extract user info from JWT token
const extractUserFromToken = async (token) => {
  try {
    if (!process.env.JWT_SECRET) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: JWT_ALGORITHMS,
    });
    const user = await User.findById(decoded.id || decoded.userId)
      .populate('role', 'name permissions hierarchy accessLevel')
      .populate('department', 'name');
    return user;
  } catch (error) {
    return null;
  }
};

/**
 * Enhanced authentication middleware that sets up user context
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: JWT_ALGORITHMS,
    });
    
    // Validate user ID format before database query
    const userId = decoded.id || decoded.userId;
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }
    
    const user = await User.findById(userId)
      .populate('role', 'name permissions hierarchy accessLevel')
      .populate('department', 'name');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User account is not active.'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account is temporarily locked.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn('Permission middleware authentication failed', {
      error: error.message,
      path: req.originalUrl,
      ip: req.ip,
    });
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.'
    });
  }
};

/**
 * Check if user has required permission
 * @param {string|Array} requiredPermissions - Single permission or array of permissions
 * @param {string} operator - 'AND' or 'OR' for multiple permissions (default: 'OR')
 */
const checkPermission = (requiredPermissions, operator = 'OR') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const user = req.user;

      // System admin has all permissions
      if (user.isSystemAdmin) {
        return next();
      }

      // Convert single permission to array for uniform processing
      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      // Check permissions
      let hasPermission = false;
      
      if (operator === 'AND') {
        // User must have ALL permissions
        hasPermission = permissions.every(permission => 
          user.hasPermission(permission)
        );
      } else {
        // User must have at least ONE permission (OR logic)
        hasPermission = permissions.some(permission => 
          user.hasPermission(permission)
        );
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: permissions,
          userRole: user.role?.name || user.legacyRole
        });
      }

      next();
    } catch (error) {
      logger.error('Permission middleware error', {
        error: error.message,
        path: req.originalUrl,
        ip: req.ip,
      });
      return internalError(res, 'Internal server error during permission check.', error);
    }
  };
};

/**
 * Check if user has specific role
 * @param {string|Array} requiredRoles - Single role or array of roles
 */
const checkRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const user = req.user;

      // System admin bypasses role checks
      if (user.isSystemAdmin) {
        return next();
      }

      // Convert single role to array for uniform processing
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

      // Check if user has required role (by name)
      const userRoleName = user.role?.name || user.legacyRole;
      const hasRole = roles.includes(userRoleName);

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient role privileges.',
          required: roles,
          userRole: userRoleName
        });
      }

      next();
    } catch (error) {
      logger.error('Role middleware error', {
        error: error.message,
        path: req.originalUrl,
        ip: req.ip,
      });
      return internalError(res, 'Internal server error during role check.', error);
    }
  };
};

/**
 * Check if user has required hierarchy level
 * @param {number} requiredLevel - Minimum hierarchy level required
 */
const checkHierarchy = (requiredLevel) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const user = req.user;

      // System admin bypasses hierarchy checks
      if (user.isSystemAdmin) {
        return next();
      }

      const userHierarchy = user.role?.hierarchy || 1;
      
      if (userHierarchy < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient hierarchy level.',
          required: requiredLevel,
          userLevel: userHierarchy
        });
      }

      next();
    } catch (error) {
      logger.error('Hierarchy middleware error', {
        error: error.message,
        path: req.originalUrl,
        ip: req.ip,
      });
      return internalError(res, 'Internal server error during hierarchy check.', error);
    }
  };
};

/**
 * Check if user can access specific department
 * @param {string} targetDepartment - Department to check access for
 */
const checkDepartmentAccess = (targetDepartment) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const user = req.user;

      // System admin has access to all departments
      if (user.isSystemAdmin) {
        return next();
      }

      // Check role access level
      const accessLevel = user.role?.accessLevel;
      
      if (accessLevel?.departments === 'all') {
        return next();
      }

      // Check if user has access to specific department
      const userDepartments = (accessLevel?.departments || [user.department?._id])
        .filter(Boolean)
        .map((d) => d.toString());
      const hasAccess = userDepartments.includes(targetDepartment) || 
                       user.department?._id?.toString() === targetDepartment;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. No access to this department.',
          targetDepartment,
          userDepartment: user.department?.name
        });
      }

      next();
    } catch (error) {
      logger.error('Department access middleware error', {
        error: error.message,
        path: req.originalUrl,
        ip: req.ip,
      });
      return internalError(res, 'Internal server error during department access check.', error);
    }
  };
};

/**
 * Check if user can access specific page
 * @param {string} pageName - Page to check access for
 * @param {string} action - Action type (view, edit, delete)
 */
const checkPageAccess = (pageName, action = 'view') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const user = req.user;

      // System admin has access to all pages
      if (user.isSystemAdmin) {
        return next();
      }

      // Check if user can access page
      const canAccess = user.canAccessPage(pageName, action);
      
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Cannot ${action} ${pageName}.`,
          page: pageName,
          action: action
        });
      }

      next();
    } catch (error) {
      logger.error('Page access middleware error', {
        error: error.message,
        path: req.originalUrl,
        ip: req.ip,
      });
      return internalError(res, 'Internal server error during page access check.', error);
    }
  };
};

/**
 * Middleware to add user info to request without strict permission checking
 * Useful for optional authentication
 */
const addUserInfo = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (token) {
      const user = await extractUserFromToken(token);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without user info if token is invalid
    next();
  }
};

/**
 * System admin only access middleware
 */
const requireSystemAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. System administrator privileges required.'
      });
    }

    next();
  } catch (error) {
    logger.error('System admin middleware error', {
      error: error.message,
      path: req.originalUrl,
      ip: req.ip,
    });
    return internalError(res, 'Internal server error during admin check.', error);
  }
};

/**
 * Admin only access middleware (includes system admin and admin role)
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const user = req.user;
    const roleName = user.role?.name?.toLowerCase?.() || "";
    const isAdmin = user.isSystemAdmin || 
                   roleName.includes('admin') ||
                   roleName.includes('system') ||
                   user.legacyRole === 'admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error', {
      error: error.message,
      path: req.originalUrl,
      ip: req.ip,
    });
    return internalError(res, 'Internal server error during admin check.', error);
  }
};

/**
 * Settings access middleware - only admins can access settings
 */
const requireSettingsAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const user = req.user;
    const hasSettingsAccess = user.isSystemAdmin || 
                             user.role?.name?.toLowerCase() === 'admin' ||
                             user.role?.settings?.canManageSettings ||
                             user.legacyRole === 'admin';

    if (!hasSettingsAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Settings access requires administrator privileges.'
      });
    }

    next();
  } catch (error) {
    logger.error('Settings access middleware error', {
      error: error.message,
      path: req.originalUrl,
      ip: req.ip,
    });
    return internalError(res, 'Internal server error during settings access check.', error);
  }
};

/**
 * Admin or Manager access middleware
 */
const requireAdminOrManager = checkHierarchy(6); // Hierarchy 6+ (Manager level)

/**
 * Legacy middleware for backward compatibility
 */
const adminOnly = checkRole(['admin', 'Admin']);
const managerAndAbove = checkRole(['admin', 'Admin', 'manager', 'Manager']);

/**
 * Common permission combinations
 */
const permissions = {
  // Dashboard access
  viewDashboard: checkPermission('view_reports'),
  
  // Guest management
  manageGuests: checkPermission(['manage_bookings', 'manage_guests', 'check_in_out'], 'OR'),
  
  // Room management
  manageRooms: checkPermission(['manage_rooms', 'update_room_status'], 'OR'),
  
  // Staff management
  manageStaff: checkPermission(['manage_users', 'manage_staff', 'manage_departments'], 'OR'),
  
  // Reports access
  viewReports: checkPermission(['view_reports', 'view_all_reports', 'view_finances'], 'OR'),
  
  // Housekeeping operations
  manageHousekeeping: checkPermission(['manage_housekeeping', 'update_room_status'], 'OR'),
  
  // Restaurant operations
  manageRestaurant: checkPermission(['manage_restaurant', 'manage_menu', 'manage_orders', 'pos_operations'], 'OR'),
  
  // Financial operations
  manageFinance: checkPermission(['view_finances', 'manage_payments', 'generate_reports'], 'OR'),
  
  // Settings management
  manageSettings: checkPermission(['manage_settings', 'system_maintenance'], 'OR')
};

export default {
  checkPermission,
  checkRole,
  checkHierarchy,
  checkDepartmentAccess,
  checkPageAccess,
  addUserInfo,
  authenticateToken,
  requireSystemAdmin,
  requireAdmin,
  requireSettingsAccess,
  requireAdminOrManager,
  adminOnly,
  managerAndAbove,
  permissions,
  extractUserFromToken
};
