import Staff from '../models/Staff.js';
import Settings from '../models/Settings.js';

const STAFF_ROLES = [
  'Admin', 'Manager', 'Front Desk Executive', 'Front Desk Manager',
  'Housekeeping Staff', 'Housekeeping Supervisor', 'Restaurant Manager',
  'Chef', 'Waiter', 'Kitchen Staff', 'Maintenance Staff', 'Security',
  'Accountant', 'Sales Executive', 'HR Executive',
];

export const getAllStaff = async (req, res) => {
  try {
    const { role, department, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (status) filter.status = status;

    const staff = await Staff.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: staff, count: staff.length, message: 'Staff retrieved successfully' });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch staff' });
  }
};

export const searchStaff = async (req, res) => {
  const query = req.query.q;
  try {
    const staff = await Staff.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { position: { $regex: query, $options: 'i' } },
        { department: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { role: { $regex: query, $options: 'i' } },
      ],
    });
    res.json({ success: true, data: staff, message: 'Staff search completed' });
  } catch (error) {
    console.error('Error searching staff:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to search staff' });
  }
};

export const getRolesWithPermissions = async (_req, res) => {
  try {
    const rolesWithPermissions = STAFF_ROLES.map((role) => ({
      name: role,
      permissions: Staff.getRolePermissions(role),
    }));
    res.json({ success: true, data: rolesWithPermissions, message: 'Roles retrieved successfully' });
  } catch (error) {
    console.error('Error getting roles:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get roles' });
  }
};

export const getStaffByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const staff = await Staff.find({ role, status: 'Active' });
    res.json({ success: true, data: staff, message: `Staff with role ${role} retrieved successfully` });
  } catch (error) {
    console.error('Error getting staff by role:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get staff by role' });
  }
};

export const getStaffByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const staff = await Staff.find({ department, status: 'Active' });
    res.json({ success: true, data: staff, message: `Staff in ${department} department retrieved successfully` });
  } catch (error) {
    console.error('Error getting staff by department:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get staff by department' });
  }
};

export const getDepartmentsList = async (_req, res) => {
  try {
    const settings = await Settings.findOne({});
    const departments = settings?.staff?.departments || [];
    res.json({ success: true, data: departments, message: 'Departments retrieved successfully' });
  } catch (error) {
    console.error('Error getting departments:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get departments' });
  }
};

export const getAvailablePages = async (_req, res) => {
  try {
    const availablePages = Staff.getAvailablePages();
    res.json({ success: true, data: availablePages, message: 'Available pages retrieved successfully' });
  } catch (error) {
    console.error('Error getting available pages:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get available pages' });
  }
};

export const getRolePagePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const staffMember = await Staff.findOne({ role });

    if (!staffMember) {
      const defaultPageAccess = Staff.getDefaultPageAccess(role);
      return res.json({
        success: true,
        data: { role, pagePermissions: defaultPageAccess, isDefault: true },
        message: 'Default page permissions for role',
      });
    }

    res.json({
      success: true,
      data: { role, pagePermissions: staffMember.pageAccess, isDefault: false },
      message: 'Role page permissions retrieved successfully',
    });
  } catch (error) {
    console.error('Error getting role page permissions:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get role page permissions' });
  }
};

export const updateRolePagePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { pagePermissions } = req.body;

    const result = await Staff.updateMany(
      { role },
      { $set: { pageAccess: pagePermissions, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      data: { role, pagePermissions, updatedCount: result.modifiedCount },
      message: `Page permissions updated for ${result.modifiedCount} staff members with role ${role}`,
    });
  } catch (error) {
    console.error('Error updating role page permissions:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update role page permissions' });
  }
};

export const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, data: staff, message: 'Staff member retrieved successfully' });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch staff member' });
  }
};

export const createStaff = async (req, res) => {
  try {
    const staffData = req.body;
    if (!staffData.name || !staffData.position || !staffData.department || !staffData.role) {
      return res.status(400).json({ success: false, message: 'Name, position, department, and role are required' });
    }

    staffData.permissions = Staff.getRolePermissions(staffData.role);
    if (!staffData.accessLevel) {
      staffData.accessLevel = {
        departments: [staffData.department],
        rooms: 'all',
        reports: staffData.role === 'Admin' ? 'all' : 'limited',
      };
    }
    if (!staffData.status) staffData.status = 'Active';

    const staff = new Staff(staffData);
    const newStaff = await staff.save();
    res.status(201).json({ success: true, data: newStaff, message: 'Staff member created successfully' });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create staff member' });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    const updateData = req.body;
    if (updateData.role && updateData.role !== staff.role) {
      updateData.permissions = Staff.getRolePermissions(updateData.role);
      if (updateData.role === 'Admin') {
        updateData.accessLevel = { departments: 'all', rooms: 'all', reports: 'all' };
      } else if (!updateData.accessLevel) {
        updateData.accessLevel = {
          departments: [updateData.department || staff.department],
          rooms: 'limited',
          reports: 'limited',
        };
      }
    }

    Object.keys(updateData).forEach((key) => {
      staff[key] = updateData[key];
    });

    const updatedStaff = await staff.save();
    res.json({ success: true, data: updatedStaff, message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update staff member' });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    await staff.deleteOne();
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete staff' });
  }
};

export const getStaffPermissions = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({
      success: true,
      data: { role: staff.role, permissions: staff.permissions, accessLevel: staff.accessLevel },
      message: 'Permissions retrieved successfully',
    });
  } catch (error) {
    console.error('Error getting staff permissions:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get staff permissions' });
  }
};

export const checkPermission = async (req, res) => {
  try {
    const { permission } = req.body;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    const hasPermission = staff.hasPermission(permission);
    res.json({
      success: true,
      data: { hasPermission, permission, role: staff.role },
      message: 'Permission check completed',
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to check permission' });
  }
};

export const assignRole = async (req, res) => {
  try {
    const { role } = req.body;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    staff.role = role;
    staff.permissions = Staff.getRolePermissions(role);
    staff.accessLevel = role === 'Admin'
      ? { departments: 'all', rooms: 'all', reports: 'all' }
      : { departments: [staff.department], rooms: 'limited', reports: 'limited' };

    await staff.save();
    res.json({ success: true, data: staff, message: `Role ${role} assigned successfully` });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to assign role' });
  }
};
