import Role from '../models/Role.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import logger from '../config/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/activityLogger.js';
import { PERMISSION_CATALOG } from '../config/permissions.js';

/**
 * Admin-only role management controller
 * Only administrators can create, manage, and assign permissions to roles
 */

// Create new role (Admin only)
export const createRole = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    departmentId, 
    permissions = [], 
    hierarchy = 1, 
    accessLevel = {}, 
    settings = {}, 
    userAccountSettings = {},
    createDefaultUser = false,
    defaultUserInfo = {}
  } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ 
      success: false, 
      message: 'Role name is required' 
    });
  }

  // Check if role already exists
  const existingRole = await Role.findOne({ name: name.trim() });
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

  // Create role data with enhanced settings
  const roleData = {
    name: name.trim(),
    description: description?.trim() || '',
    department: departmentId,
    permissions,
    hierarchy: Math.max(1, Math.min(10, hierarchy)), // Ensure hierarchy is between 1-10
    accessLevel: {
      departments: accessLevel.departments || [],
      rooms: accessLevel.rooms || 'limited',
      reports: accessLevel.reports || 'limited',
      pages: accessLevel.pages || []
    },
    settings: {
      canManageStaff: settings.canManageStaff || false,
      canViewReports: settings.canViewReports || false,
      canManageBookings: settings.canManageBookings || false,
      maxApprovalAmount: settings.maxApprovalAmount || 0,
      canCreateUsers: settings.canCreateUsers || false,
      canAssignRoles: settings.canAssignRoles || false,
      canManageSettings: settings.canManageSettings || false,
      canAccessSettings: settings.canAccessSettings || false,
      canManageRoles: settings.canManageRoles || false,
      canViewAllStaff: settings.canViewAllStaff || false,
      canEditStaffProfiles: settings.canEditStaffProfiles || false,
      canDeactivateStaff: settings.canDeactivateStaff || false
    },
    userAccountSettings: {
      canHaveUserAccount: userAccountSettings.canHaveUserAccount !== false,
      defaultPasswordPattern: userAccountSettings.defaultPasswordPattern || '[firstName][0-3][random4]',
      forcePasswordChange: userAccountSettings.forcePasswordChange !== false,
      passwordExpiryDays: userAccountSettings.passwordExpiryDays || 90,
      usernamePattern: userAccountSettings.usernamePattern || '[firstName].[lastName]'
    },
    createdBy: req.user.id
  };

  // Auto-configure admin roles
  if (name.toLowerCase().includes('admin')) {
    roleData.hierarchy = 10;
    roleData.settings = {
      canManageStaff: true,
      canViewReports: true,
      canManageBookings: true,
      canCreateUsers: true,
      canAssignRoles: true,
      canManageSettings: true,
      canAccessSettings: true,
      canManageRoles: true,
      canViewAllStaff: true,
      canEditStaffProfiles: true,
      canDeactivateStaff: true,
      maxApprovalAmount: 999999
    };
    roleData.accessLevel.departments = 'all';
    roleData.accessLevel.rooms = 'all';
    roleData.accessLevel.reports = 'all';
  }

  // Create new role
  const role = new Role(roleData);
  await role.save();

  logger.info('Role created by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    roleId: role._id,
    roleName: role.name,
    hierarchy: role.hierarchy
  });

  let defaultUserCredentials = null;

  // Create default user account if requested
  if (createDefaultUser && role.userAccountSettings.canHaveUserAccount) {
    try {
      const { firstName = 'Default', lastName = 'User', email, phone } = defaultUserInfo;
      
      // Validate required fields for user creation
      if (!email || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Email and phone are required when creating default user account'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { phone }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      // Generate username and password using role patterns
      let username = role.generateUsername(firstName, lastName);
      
      // Ensure username is unique
      let usernameExists = await User.findOne({ username });
      let counter = 1;
      while (usernameExists) {
        username = `${role.generateUsername(firstName, lastName)}${counter}`;
        usernameExists = await User.findOne({ username });
        counter++;
      }

      const password = role.generatePassword(firstName, lastName);

      // Generate employee ID
      const lastUser = await User.findOne({}, {}, { sort: { 'createdAt': -1 } });
      const lastId = lastUser?.profile?.employeeId ? 
        parseInt(lastUser.profile.employeeId.replace(/\D/g, '')) : 1000;
      const employeeId = `EMP${(lastId + 1).toString().padStart(4, '0')}`;

      // Create user data
      const userData = {
        username,
        password,
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: role._id,
        department: departmentId,
        permissions: role.permissions || [],
        isActive: true,
        profile: {
          employeeId,
          joiningDate: new Date(),
          ...defaultUserInfo.profile
        },
        createdBy: req.user.id
      };

      const user = new User(userData);
      await user.save();

      defaultUserCredentials = {
        username,
        password,
        email: user.email,
        employeeId
      };

      logger.info('Default user created for role', {
        adminId: req.user.id,
        adminUsername: req.user.username,
        roleId: role._id,
        roleName: role.name,
        userId: user._id,
        username: user.username
      });

    } catch (error) {
      logger.error('Error creating default user for role:', error);
      // Don't fail role creation if user creation fails
    }
  }

  logActivity(req, {
    action: 'role.create', category: 'role', severity: 'warning', audit: true,
    resource: 'Role', resourceId: role._id,
    description: `Created role "${role.name}" with ${(role.permissions || []).length} permission(s)`,
    changes: { after: { name: role.name, hierarchy: role.hierarchy, permissions: role.permissions } },
  });

  res.status(201).json({
    success: true,
    data: {
      role: role.toPublic(),
      defaultUser: defaultUserCredentials
    },
    message: createDefaultUser && defaultUserCredentials ?
      'Role and default user created successfully' :
      'Role created successfully'
  });
});

// Get all roles (Admin only)
export const getAllRoles = asyncHandler(async (req, res) => {
  try {
    const { includeInactive = false, department } = req.query;

    const filter = {};
    if (!includeInactive) filter.isActive = true;
    if (department) filter.department = department;

    const roles = await Role.find(filter)
      .populate('department', 'name')
      .populate('createdBy', 'username firstName lastName')
      .sort({ hierarchy: -1, name: 1 });

    res.json({
      success: true,
      data: roles.map(role => ({
        ...role.toPublic(),
        createdBy: role.createdBy,
        userCount: 0 // Will be populated by separate query if needed
      })),
      message: 'Roles fetched successfully'
    });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message
    });
  }
});

// Get role by ID with user count (Admin only)
export const getRoleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const role = await Role.findById(id)
    .populate('department', 'name')
    .populate('createdBy', 'username firstName lastName');

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  // Get user count for this role
  const userCount = await User.countDocuments({ role: id });

  res.json({
    success: true,
    data: {
      ...role.toPublic(),
      createdBy: role.createdBy,
      userCount
    },
    message: 'Role details fetched successfully'
  });
});

// Update role (Admin only)
export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be updated directly
  delete updates._id;
  delete updates.createdBy;
  delete updates.createdAt;
  delete updates.updatedAt;

  const role = await Role.findById(id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  // Validate department if being updated
  if (updates.department) {
    const department = await Department.findById(updates.department);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department specified'
      });
    }
  }

  // Ensure hierarchy is within valid range
  if (updates.hierarchy !== undefined) {
    updates.hierarchy = Math.max(1, Math.min(10, updates.hierarchy));
  }

  // Snapshot before mutation, for the audit trail.
  const beforeSnapshot = { name: role.name, hierarchy: role.hierarchy, permissions: [...(role.permissions || [])] };

  // Update role. validateModifiedOnly avoids re-validating untouched legacy
  // fields (e.g. older roles with malformed accessLevel data) that would
  // otherwise block a legitimate name/permission edit.
  Object.assign(role, updates);
  await role.save({ validateModifiedOnly: true });

  // If permissions changed, update all users with this role
  if (updates.permissions) {
    await User.updateMany(
      { role: id },
      { $set: { permissions: updates.permissions } }
    );
  }

  logger.info('Role updated by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    roleId: role._id,
    roleName: role.name,
    updates: Object.keys(updates)
  });

  logActivity(req, {
    action: 'role.update', category: 'role', severity: 'warning', audit: true,
    resource: 'Role', resourceId: role._id,
    description: `Updated role "${role.name}" (${Object.keys(updates).join(', ')})`,
    changes: { before: beforeSnapshot, after: { name: role.name, hierarchy: role.hierarchy, permissions: role.permissions } },
  });

  res.json({
    success: true,
    data: role.toPublic(),
    message: 'Role updated successfully'
  });
});

// Delete role (Admin only)
export const deleteRole = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const role = await Role.findById(id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  // Check if any users are assigned to this role
  const userCount = await User.countDocuments({ role: id });
  if (userCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role. ${userCount} user(s) are currently assigned to this role.`
    });
  }

  await Role.findByIdAndDelete(id);

  logger.warn('Role deleted by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    deletedRoleId: role._id,
    deletedRoleName: role.name
  });

  logActivity(req, {
    action: 'role.delete', category: 'role', severity: 'critical', audit: true,
    resource: 'Role', resourceId: role._id,
    description: `Deleted role "${role.name}"`,
    changes: { before: { name: role.name, hierarchy: role.hierarchy, permissions: role.permissions } },
  });

  res.json({
    success: true,
    message: 'Role deleted successfully'
  });
});

// Toggle role status (Admin only)
export const toggleRoleStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const role = await Role.findById(id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  role.isActive = isActive;
  await role.save();

  // If deactivating role, optionally deactivate users (or warn admin)
  if (!isActive) {
    const userCount = await User.countDocuments({ role: id, isActive: true });
    if (userCount > 0) {
      // Just log warning, don't auto-deactivate users
      logger.warn('Role deactivated with active users', {
        adminId: req.user.id,
        roleId: role._id,
        roleName: role.name,
        activeUserCount: userCount
      });
    }
  }

  logger.info('Role status toggled by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    roleId: role._id,
    roleName: role.name,
    newStatus: isActive ? 'active' : 'inactive'
  });

  res.json({
    success: true,
    data: { isActive: role.isActive },
    message: `Role ${isActive ? 'activated' : 'deactivated'} successfully`
  });
});

// Get available permissions for role assignment (Admin only)
export const getAvailablePermissions = asyncHandler(async (req, res) => {
  try {
    // Canonical catalog (shared with /settings/permissions) — see
    // server/config/permissions.js. Returned as a `categories` array to match
    // the RoleDialog / AdminPanel frontend expectations.
    res.json({
      success: true,
      data: {
        categories: PERMISSION_CATALOG
      },
      message: 'Available permissions fetched successfully'
    });
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
      error: error.message
    });
  }
});

// Assign permissions to role (Admin only)
export const assignPermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      success: false,
      message: 'Permissions must be an array'
    });
  }

  const role = await Role.findById(id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  // Update role permissions
  role.permissions = permissions;
  await role.save();

  // Update all users with this role
  await User.updateMany(
    { role: id },
    { $set: { permissions: permissions } }
  );

  logger.info('Permissions assigned to role by admin', {
    adminId: req.user.id,
    adminUsername: req.user.username,
    roleId: role._id,
    roleName: role.name,
    permissionCount: permissions.length
  });

  res.json({
    success: true,
    data: {
      roleId: role._id,
      roleName: role.name,
      permissions: role.permissions
    },
    message: 'Permissions assigned successfully'
  });
});

// Get role statistics (Admin only)
export const getRoleStats = asyncHandler(async (req, res) => {
  const totalRoles = await Role.countDocuments();
  const activeRoles = await Role.countDocuments({ isActive: true });
  const inactiveRoles = await Role.countDocuments({ isActive: false });

  // Roles with user counts
  const rolesWithUserCounts = await Role.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'role',
        as: 'users'
      }
    },
    {
      $project: {
        name: 1,
        hierarchy: 1,
        isActive: 1,
        userCount: { $size: '$users' }
      }
    },
    {
      $sort: { hierarchy: -1 }
    }
  ]);

  // Hierarchy distribution
  const hierarchyDistribution = await Role.aggregate([
    {
      $group: {
        _id: '$hierarchy',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.json({
    success: true,
    data: {
      totalRoles,
      activeRoles,
      inactiveRoles,
      rolesWithUserCounts,
      hierarchyDistribution
    },
    message: 'Role statistics fetched successfully'
  });
});

