import Department from '../models/Department.js';
import User from '../models/User.js';

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('headOfDepartment', 'name email')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ name: 1 })
      .lean();

    // Attach a live staff count per department.
    const counts = await User.aggregate([
      { $match: { department: { $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const withCounts = departments.map((d) => ({
      ...d,
      staffCount: countMap.get(String(d._id)) || 0,
    }));

    res.json({
      success: true,
      data: withCounts,
      message: 'Departments fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
};

// Get single department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headOfDepartment', 'name email phone')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: department,
      message: 'Department fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department',
      error: error.message
    });
  }
};

// Create new department
export const createDepartment = async (req, res) => {
  try {
    const {
      name,
      description,
      headOfDepartment,
      budget,
      staffCount,
      color,
      permissions,
      settings
    } = req.body;

    // Check if department name already exists
    const existingDepartment = await Department.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name already exists'
      });
    }

    // Get default color if not provided
    const colorMap = Department.getColorMap();
    const defaultColor = colorMap[name] || '#6B7280';

    const department = new Department({
      name: name.trim(),
      description: description?.trim(),
      headOfDepartment: headOfDepartment || null,
      budget: budget || 0,
      staffCount: staffCount || 0,
      color: color || defaultColor,
      permissions: permissions || [],
      settings: {
        maxStaff: settings?.maxStaff || null,
        workingHours: {
          start: settings?.workingHours?.start || '09:00',
          end: settings?.workingHours?.end || '17:00'
        },
        breakDuration: settings?.breakDuration || 30
      },
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    });

    await department.save();

    const populatedDepartment = await Department.findById(department._id)
      .populate('headOfDepartment', 'name email')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedDepartment,
      message: 'Department created successfully'
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating department',
      error: error.message
    });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Add updatedBy field
    updateData.updatedBy = req.user?.id || null;

    // Check if name is being changed and if it conflicts
    if (updateData.name) {
      const existingDepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name already exists'
        });
      }
    }

    const department = await Department.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    )
      .populate('headOfDepartment', 'name email')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: department,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department',
      error: error.message
    });
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department has any staff assigned
    const staffCount = await User.countDocuments({ department: id });
    if (staffCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department. ${staffCount} staff member(s) are assigned to this department.`
      });
    }

    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting department',
      error: error.message
    });
  }
};

// Toggle department status
export const toggleDepartmentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    department.isActive = !department.isActive;
    department.updatedBy = req.user?.id || null;
    await department.save();

    const updatedDepartment = await Department.findById(id)
      .populate('headOfDepartment', 'name email')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    res.json({
      success: true,
      data: updatedDepartment,
      message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling department status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department status',
      error: error.message
    });
  }
};

// Get department statistics
export const getDepartmentStats = async (req, res) => {
  try {
    const totalDepartments = await Department.countDocuments();
    const activeDepartments = await Department.countDocuments({ isActive: true });
    const inactiveDepartments = totalDepartments - activeDepartments;

    // Get departments with staff count
    const departmentsWithStaff = await Department.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department',
          as: 'staff'
        }
      },
      {
        $project: {
          name: 1,
          color: 1,
          isActive: 1,
          staffCount: { $size: '$staff' },
          budget: 1
        }
      },
      { $sort: { name: 1 } }
    ]);

    const totalBudget = await Department.aggregate([
      { $group: { _id: null, total: { $sum: '$budget' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalDepartments,
        activeDepartments,
        inactiveDepartments,
        departments: departmentsWithStaff,
        totalBudget: totalBudget[0]?.total || 0
      },
      message: 'Department statistics fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department statistics',
      error: error.message
    });
  }
};
