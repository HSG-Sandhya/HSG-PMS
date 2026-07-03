import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';
import bcrypt from 'bcryptjs';
import { generateRandomPassword } from '../utils/index.js';
import { PERMISSION_CATALOG, ALL_PERMISSIONS } from '../config/permissions.js';

// Create a new user with role-based permissions
export const createUserWithRole = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      roleId,
      departmentId,
      generateCredentials = true
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !roleId || !departmentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: firstName, lastName, email, phone, roleId, and departmentId are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    // Get role and department
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department specified'
      });
    }

    // Check if role can have user account
    if (!role.userAccountSettings?.canHaveUserAccount) {
      return res.status(400).json({
        success: false,
        message: 'This role cannot have a user account'
      });
    }

    // Generate username and password
    let username, password;
    
    if (generateCredentials) {
      // Generate username based on role pattern
      username = role.generateUsername(firstName, lastName);
      
      // Check if username exists
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        // Add random suffix
        username = `${username}${Math.floor(Math.random() * 1000)}`;
      }
      
      // Generate password based on role pattern
      password = role.generatePassword(firstName, lastName);
    } else {
      // Use provided username and password
      username = req.body.username;
      password = req.body.password;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required when not generating credentials'
        });
      }
    }

    // Create user data
    const userData = {
      username,
      password,
      email: email.toLowerCase().trim(),
      phone,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: roleId,
      department: departmentId,
      permissions: role.permissions,
      isActive: true,
      profile: {
        joiningDate: new Date(),
      },
      createdBy: req.user?.id
    };

    // Create new user
    const user = new User(userData);
    await user.save();

    // Return user with credentials
    const userResponse = user.toJSON();
    
    res.status(201).json({
      success: true,
      data: {
        ...userResponse,
        generatedCredentials: generateCredentials ? { username, password } : undefined
      },
      message: 'User created successfully with role-based permissions'
    });
  } catch (error) {
    console.error('Error creating user with role:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating user', 
      error: error.message 
    });
  }
};

// Get all available roles
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true })
      .populate('department', 'name')
      .sort({ hierarchy: -1 });

    res.json({
      success: true,
      data: roles.map(role => role.toPublic()),
      message: 'Roles fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching roles', 
      error: error.message 
    });
  }
};

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      departmentId, 
      permissions = [],
      hierarchy = 1,
      accessLevel = {},
      settings = {},
      userAccountSettings = {}
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

    // Create role data
    const roleData = {
      name: name.trim(),
      description: description?.trim() || '',
      department: departmentId,
      permissions,
      hierarchy,
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
        canAssignRoles: settings.canAssignRoles || false
      },
      userAccountSettings: {
        canHaveUserAccount: userAccountSettings.canHaveUserAccount !== false,
        defaultPasswordPattern: userAccountSettings.defaultPasswordPattern || '[firstName][0-3][random4]',
        forcePasswordChange: userAccountSettings.forcePasswordChange !== false,
        passwordExpiryDays: userAccountSettings.passwordExpiryDays || 90,
        usernamePattern: userAccountSettings.usernamePattern || '[firstName].[lastName]'
      },
      createdBy: req.user?.id
    };

    // Create admin role with all permissions
    if (name.toLowerCase().includes('admin')) {
      roleData.hierarchy = 10;
      roleData.settings.canManageStaff = true;
      roleData.settings.canViewReports = true;
      roleData.settings.canManageBookings = true;
      roleData.settings.canCreateUsers = true;
      roleData.settings.canAssignRoles = true;
      roleData.accessLevel.departments = 'all';
      roleData.accessLevel.rooms = 'all';
      roleData.accessLevel.reports = 'all';
    }

    // Create new role
    const role = new Role(roleData);
    await role.save();

    res.status(201).json({
      success: true,
      data: role.toPublic(),
      message: 'Role created successfully'
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating role', 
      error: error.message 
    });
  }
};

// Get available permissions
export const getAvailablePermissions = async (req, res) => {
  try {
    // Canonical catalog shared across all permission endpoints — see
    // server/config/permissions.js.
    res.json({
      success: true,
      data: {
        categories: PERMISSION_CATALOG,
        allPermissions: ALL_PERMISSIONS
      },
      message: 'Available permissions fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching permissions', 
      error: error.message 
    });
  }
};