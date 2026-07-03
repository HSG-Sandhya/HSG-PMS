import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';
import bcrypt from 'bcryptjs';
import { 
  successResponse, 
  errorResponse, 
  isValidPhone, 
  isValidObjectId,
  createValidationError,
  createNotFoundError,
  createConflictError,
  generateEmployeeId,
  HTTP_STATUS
} from '../utils/index.js';
import { logActivity } from '../utils/activityLogger.js';

// Get all users with optional filtering
export const getAllUsers = async (req, res) => {
  try {
    const { activeOnly = false, includeInactive = false } = req.query;
    
    // Build query based on filters
    let query = {};
    if (activeOnly === 'true' && !includeInactive) {
      query.isActive = true;
    }

    const users = await User.find(query)
      .populate('role', 'name hierarchy permissions')
      .populate('department', 'name color')
      .select('-password -loginAttempts -lockUntil')
      .sort({ createdAt: -1 });

    // Use toPublic method if available, otherwise return as is
    const responseData = users.map(user => 
      typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON()
    );

    res.json({
      success: true,
      data: responseData,
      message: 'Users fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching users', 
      error: error.message 
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('role', 'name hierarchy permissions')
      .populate('department', 'name color')
      .select('-password -loginAttempts -lockUntil');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const responseData = typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON();

    res.json({
      success: true,
      data: responseData,
      message: 'User fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user', 
      error: error.message 
    });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      phone, 
      role, 
      firstName, 
      lastName, 
      department, 
      isActive = true,
      permissions = [],
      profile = {}
    } = req.body;

    // Validate required fields with specific error messages
    const missingFields = [];
    if (!username) missingFields.push('username');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!phone) missingFields.push('phone');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!role) missingFields.push('role');

    if (missingFields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse(`Missing required fields: ${missingFields.join(', ')}`, HTTP_STATUS.BAD_REQUEST, {
          missingFields,
          requiredFields: ['username', 'email', 'password', 'phone', 'firstName', 'lastName', 'role'],
          example: {
            username: 'john_doe',
            email: 'john@example.com',
            password: 'securePassword123',
            phone: '9876543210',
            firstName: 'John',
            lastName: 'Doe',
            role: 'staff_role_id'
          }
        })
      );
    }

    // Validate phone number format
    if (!isValidPhone(phone)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Phone number must be exactly 10 digits', HTTP_STATUS.BAD_REQUEST)
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }]
    });

    if (existingUser) {
      let conflictField = 'email';
      if (existingUser.username === username) conflictField = 'username';
      else if (existingUser.phone === phone) conflictField = 'phone';
      
      return res.status(400).json({ 
        success: false,
        message: `User with this ${conflictField} already exists` 
      });
    }

    // Validate role and department exist if provided
    if (role) {
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
    }

    if (department) {
      const departmentExists = await Department.findById(department);
      if (!departmentExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department specified'
        });
      }

      // Generate employee ID if department is provided
      if (departmentExists) {
        profile.employeeId = generateEmployeeId(departmentExists.name);
        profile.joiningDate = new Date();
      }
    }

    // Create new user
    const userData = {
      username,
      email: email.toLowerCase().trim(),
      password,
      phone,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      department,
      permissions,
      profile,
      isActive,
      createdBy: req.user?.id
    };

    const user = new User(userData);
    await user.save();

    // Update department staff count if department is provided
    if (department) {
      await Department.findByIdAndUpdate(department, {
        $inc: { staffCount: 1 }
      });
    }

    // Populate role and department for response
    await user.populate('role department');

    // Return user without password
    const userResponse = typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON();
    
    logActivity(req, {
      action: 'user.create', category: 'user', severity: 'warning', audit: true,
      resource: 'User', resourceId: user._id,
      description: `Created user "${user.username || user.email}"`,
    });

    res.status(HTTP_STATUS.CREATED).json(
      successResponse(userResponse, 'User created successfully', HTTP_STATUS.CREATED)
    );
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating user', 
      error: error.message 
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Prevent updating sensitive fields
    delete updateData.createdBy;
    delete updateData.createdAt;

    // If password is being updated, hash it
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // If role or department is being changed, validate they exist
    if (updateData.role) {
      const roleExists = await Role.findById(updateData.role);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
    }

    if (updateData.department) {
      const departmentExists = await Department.findById(updateData.department);
      if (!departmentExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department specified'
        });
      }
    }

    // Get current user data to check department change
    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update timestamp
    updateData.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('role department').select('-password');

    // Update department staff counts if department changed
    if (updateData.department && updateData.department !== currentUser.department?.toString()) {
      // Decrease old department count if it exists
      if (currentUser.department) {
        await Department.findByIdAndUpdate(currentUser.department, {
          $inc: { staffCount: -1 }
        });
      }
      // Increase new department count
      await Department.findByIdAndUpdate(updateData.department, {
        $inc: { staffCount: 1 }
      });
    }

    const responseData = typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON();

    logActivity(req, {
      action: 'user.update', category: 'user', severity: 'warning', audit: true,
      resource: 'User', resourceId: user._id,
      description: `Updated user "${user.username || user.email}" (${Object.keys(updateData || {}).join(', ')})`,
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: responseData,
      user: responseData // Keep for backward compatibility
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating user', 
      error: error.message 
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Prevent deleting system admin
    if (user.isSystemAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system administrator'
      });
    }

    // Update department staff count before deletion
    if (user.department) {
      await Department.findByIdAndUpdate(user.department, {
        $inc: { staffCount: -1 }
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: user.toJSON(),
      user: user.toJSON() // Keep for backward compatibility
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting user', 
      error: error.message 
    });
  }
};

// Toggle user status (active/inactive)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // First check if user exists
    const user = await User.findById(id).select('isActive department');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Prevent deactivating system admin
    if (user.isSystemAdmin && user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate system administrator'
      });
    }

    const newStatus = !user.isActive;

    // Use findByIdAndUpdate to update only the specific fields
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { 
        $set: {
          isActive: newStatus,
          updatedAt: new Date()
        }
      },
      { 
        new: true,
        runValidators: false,
        strict: false
      }
    ).populate('role department').select('-password').lean();

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found during update' 
      });
    }

    // Update department staff count
    if (user.department) {
      const increment = newStatus ? 1 : -1;
      await Department.findByIdAndUpdate(user.department, {
        $inc: { staffCount: increment }
      });
    }

    res.json({
      success: true,
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser,
      user: updatedUser // Keep for backward compatibility
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error toggling user status', 
      error: error.message 
    });
  }
};

// Change user password
export const changePassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword, currentPassword } = req.body;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If not system admin and not the user themselves, check permissions
    if (!req.user?.isSystemAdmin && req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to change this user\'s password'
      });
    }

    // If user is changing their own password, verify current password
    if (req.user?.id === userId && currentPassword) {
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

// Deactivate user (soft delete)
export const deactivateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deactivating system admin
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isSystemAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate system administrator'
      });
    }

    // Deactivate user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    ).populate('role department');

    // Update department staff count
    if (user.department) {
      await Department.findByIdAndUpdate(user.department, {
        $inc: { staffCount: -1 }
      });
    }

    const responseData = typeof updatedUser.toPublic === 'function' ? updatedUser.toPublic() : updatedUser.toJSON();

    logActivity(req, {
      action: 'user.deactivate', category: 'user', severity: 'critical', audit: true,
      resource: 'User', resourceId: updatedUser._id,
      description: `Deactivated user "${updatedUser.username || updatedUser.email}"`,
    });

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: error.message
    });
  }
};

// Activate user
export const activateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: true, updatedAt: new Date() },
      { new: true }
    ).populate('role department');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update department staff count
    if (updatedUser.department) {
      await Department.findByIdAndUpdate(updatedUser.department, {
        $inc: { staffCount: 1 }
      });
    }

    const responseData = typeof updatedUser.toPublic === 'function' ? updatedUser.toPublic() : updatedUser.toJSON();

    logActivity(req, {
      action: 'user.activate', category: 'user', severity: 'info', audit: true,
      resource: 'User', resourceId: updatedUser._id,
      description: `Activated user "${updatedUser.username || updatedUser.email}"`,
    });

    res.json({
      success: true,
      message: 'User activated successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error activating user',
      error: error.message
    });
  }
};

// Get users by department
export const getUsersByDepartment = async (req, res) => {
  try {
    const departmentId = req.params.departmentId;

    const users = await User.find({ 
      department: departmentId, 
      isActive: true 
    })
      .populate('role', 'name hierarchy permissions')
      .populate('department', 'name color')
      .select('-password -loginAttempts -lockUntil')
      .sort({ 'profile.joiningDate': -1 });

    const responseData = users.map(user => 
      typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON()
    );

    res.json({
      success: true,
      data: responseData,
      message: `Users in department fetched successfully`
    });
  } catch (error) {
    console.error('Error fetching users by department:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by department',
      error: error.message
    });
  }
};

// Get users by role
export const getUsersByRole = async (req, res) => {
  try {
    const { role: roleParam, roleId } = req.params;
    const roleIdentifier = roleId || roleParam;

    let query = { isActive: true };
    
    // Handle both role name and role ID
    if (roleIdentifier) {
      // Check if it's an ObjectId (24 hex characters)
      if (/^[0-9a-fA-F]{24}$/.test(roleIdentifier)) {
        query.role = roleIdentifier;
      } else {
        // Find role by name first
        const role = await Role.findOne({ name: roleIdentifier });
        if (role) {
          query.role = role._id;
        } else {
          return res.status(404).json({
            success: false,
            message: 'Role not found'
          });
        }
      }
    }

    const users = await User.find(query)
      .populate('role', 'name hierarchy permissions')
      .populate('department', 'name color')
      .select('-password -loginAttempts -lockUntil')
      .sort({ 'profile.joiningDate': -1 });

    const responseData = users.map(user => 
      typeof user.toPublic === 'function' ? user.toPublic() : user.toJSON()
    );

    res.json({
      success: true,
      data: responseData,
      message: `Users with specified role fetched successfully`
    });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching users by role', 
      error: error.message 
    });
  }
};