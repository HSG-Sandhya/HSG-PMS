import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';
import logger from '../config/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ROLE_TEMPLATES } from '../config/roleTemplates.js';

/**
 * Admin-only settings management controller
 * Only administrators can access and modify system settings
 */

// Get system settings overview (Admin only)
export const getSystemSettings = asyncHandler(async (req, res) => {
  // Get system statistics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const totalRoles = await Role.countDocuments();
  const activeRoles = await Role.countDocuments({ isActive: true });
  const totalDepartments = await Department.countDocuments();

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentUsers = await User.countDocuments({
    createdAt: { $gte: sevenDaysAgo }
  });

  const recentLogins = await User.countDocuments({
    lastLogin: { $gte: sevenDaysAgo }
  });

  // System configuration
  const systemConfig = {
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGODB_URI ? 'Connected' : 'Not configured',
    logLevel: process.env.LOG_LEVEL || 'info'
  };

  res.json({
    success: true,
    data: {
      statistics: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalRoles,
        activeRoles,
        inactiveRoles: totalRoles - activeRoles,
        totalDepartments
      },
      recentActivity: {
        newUsers: recentUsers,
        recentLogins
      },
      systemConfig
    },
    message: 'System settings overview fetched successfully'
  });
});

// Get user management settings (Admin only)
export const getUserManagementSettings = asyncHandler(async (req, res) => {
  // Get all roles with their settings
  const roles = await Role.find({ isActive: true })
    .select('name hierarchy settings userAccountSettings')
    .sort({ hierarchy: -1 });

  // Get departments
  const departments = await Department.find()
    .select('name description isActive')
    .sort({ name: 1 });

  // Default user settings
  const defaultUserSettings = {
    passwordMinLength: 6,
    passwordRequireSpecialChar: false,
    passwordRequireNumber: true,
    passwordRequireUppercase: false,
    accountLockoutAttempts: 5,
    accountLockoutDuration: 30, // minutes
    sessionTimeout: 24 // hours
  };

  res.json({
    success: true,
    data: {
      roles,
      departments,
      defaultUserSettings
    },
    message: 'User management settings fetched successfully'
  });
});

// Update user management settings (Admin only)
export const updateUserManagementSettings = asyncHandler(async (req, res) => {
  const { defaultUserSettings } = req.body;

  // Here you would typically save these settings to a settings collection
  // For now, we'll just log the update
  logger.info('User management settings updated by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    settings: defaultUserSettings
  });

  res.json({
    success: true,
    data: { defaultUserSettings },
    message: 'User management settings updated successfully'
  });
});

// Get role permissions template (Admin only)
export const getRolePermissionsTemplate = asyncHandler(async (req, res) => {
  // Templates live in server/config/roleTemplates.js (single source of truth);
  // their permission strings match the enforced catalog in config/permissions.js.
  res.json({
    success: true,
    data: ROLE_TEMPLATES,
    message: 'Role permission templates fetched successfully'
  });
});

// Create role from template (Admin only)
export const createRoleFromTemplate = asyncHandler(async (req, res) => {
  const { templateName, roleName, departmentId, customizations = {} } = req.body;

  // Look up the requested template from the shared constant.
  const roleTemplate = ROLE_TEMPLATES[templateName];

  if (!roleTemplate) {
    return res.status(400).json({
      success: false,
      message: 'Invalid template name'
    });
  }

  // Check if role already exists
  const existingRole = await Role.findOne({ name: roleName });
  if (existingRole) {
    return res.status(400).json({
      success: false,
      message: 'Role with this name already exists'
    });
  }

  // Validate department if provided
  if (departmentId) {
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department specified'
      });
    }
  }

  // Create role data from template with customizations
  const roleData = {
    name: roleName,
    description: customizations.description || roleTemplate.description,
    department: departmentId,
    permissions: customizations.permissions || roleTemplate.permissions,
    hierarchy: customizations.hierarchy || roleTemplate.hierarchy,
    settings: { ...roleTemplate.settings, ...customizations.settings },
    userAccountSettings: {
      canHaveUserAccount: true,
      defaultPasswordPattern: '[firstName][0-3][random4]',
      forcePasswordChange: true,
      passwordExpiryDays: 90,
      usernamePattern: '[firstName].[lastName]',
      ...customizations.userAccountSettings
    },
    accessLevel: {
      departments: [],
      rooms: 'limited',
      reports: 'limited',
      pages: [],
      ...customizations.accessLevel
    },
    createdBy: req.user.id
  };

  // Create new role
  const role = new Role(roleData);
  await role.save();

  logger.info('Role created from template by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    roleId: role._id,
    roleName: role.name,
    templateUsed: templateName
  });

  res.status(201).json({
    success: true,
    data: role.toPublic(),
    message: 'Role created from template successfully'
  });
});

// Get system logs (Admin only)
export const getSystemLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, level, startDate, endDate } = req.query;

  // This would typically fetch from your logging system
  // For now, return a mock response
  const logs = {
    docs: [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'User login successful',
        userId: req.user.id,
        ip: req.ip
      }
    ],
    totalDocs: 1,
    limit: parseInt(limit),
    page: parseInt(page),
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  };

  res.json({
    success: true,
    data: logs,
    message: 'System logs fetched successfully'
  });
});

// Backup system data (Admin only)
export const backupSystemData = asyncHandler(async (req, res) => {
  const timestamp = new Date().toISOString();
  
  // Get all data for backup
  const users = await User.find().select('-password');
  const roles = await Role.find();
  const departments = await Department.find();

  const backupData = {
    timestamp,
    version: '1.0',
    data: {
      users,
      roles,
      departments
    }
  };

  logger.info('System backup created by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    timestamp,
    userCount: users.length,
    roleCount: roles.length,
    departmentCount: departments.length
  });

  res.json({
    success: true,
    data: {
      backupId: `backup-${timestamp}`,
      timestamp,
      size: JSON.stringify(backupData).length,
      records: {
        users: users.length,
        roles: roles.length,
        departments: departments.length
      }
    },
    message: 'System backup created successfully'
  });
});
