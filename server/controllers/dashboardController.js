import User from '../models/User.js';
import Role from '../models/Role.js';
import logger from '../config/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Dashboard controller for role-based content
 * Returns dashboard data based on user's role and permissions
 */

// Get dashboard data based on user's role and permissions
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Get user with populated role and department
  const user = await User.findById(userId)
    .populate('role', 'name permissions settings accessLevel userAccountSettings')
    .populate('department', 'name');

  if (!user || !user.isActive) {
    return res.status(404).json({
      success: false,
      message: 'User not found or inactive'
    });
  }

  const role = user.role;
  const permissions = role.permissions || [];
  const settings = role.settings || {};
  const accessLevel = role.accessLevel || {};

  // Define available dashboard sections with their required permissions
  const dashboardSections = {
    // Core sections
    profile: {
      name: 'Profile',
      path: '/profile',
      icon: 'user',
      visible: true, // Always visible
      permissions: []
    },
    
    // Staff Management
    staff: {
      name: 'Staff Management',
      path: '/staff',
      icon: 'users',
      visible: settings.canManageStaff || settings.canViewAllStaff,
      permissions: ['manage_staff', 'view_staff'],
      subSections: {
        viewStaff: {
          name: 'View Staff',
          path: '/staff/view',
          visible: settings.canViewAllStaff
        },
        createStaff: {
          name: 'Create Staff',
          path: '/staff/create',
          visible: settings.canManageStaff
        },
        editStaff: {
          name: 'Edit Staff',
          path: '/staff/edit',
          visible: settings.canEditStaffProfiles
        }
      }
    },

    // Role Management
    roles: {
      name: 'Role Management',
      path: '/roles',
      icon: 'shield',
      visible: settings.canManageRoles,
      permissions: ['manage_roles'],
      subSections: {
        viewRoles: {
          name: 'View Roles',
          path: '/roles/view',
          visible: settings.canManageRoles
        },
        createRole: {
          name: 'Create Role',
          path: '/roles/create',
          visible: settings.canManageRoles
        }
      }
    },

    // Booking Management
    bookings: {
      name: 'Bookings',
      path: '/bookings',
      icon: 'calendar',
      visible: settings.canManageBookings || permissions.includes('read_bookings'),
      permissions: ['manage_bookings', 'read_bookings'],
      subSections: {
        viewBookings: {
          name: 'View Bookings',
          path: '/bookings/view',
          visible: permissions.includes('read_bookings')
        },
        createBooking: {
          name: 'Create Booking',
          path: '/bookings/create',
          visible: settings.canManageBookings
        },
        manageBookings: {
          name: 'Manage Bookings',
          path: '/bookings/manage',
          visible: settings.canManageBookings
        }
      }
    },

    // Reports
    reports: {
      name: 'Reports',
      path: '/reports',
      icon: 'chart-bar',
      visible: settings.canViewReports || permissions.includes('read_reports'),
      permissions: ['read_reports', 'view_reports'],
      accessLevel: accessLevel.reports,
      subSections: {
        financialReports: {
          name: 'Financial Reports',
          path: '/reports/financial',
          visible: accessLevel.reports === 'all' || accessLevel.reports === 'department'
        },
        occupancyReports: {
          name: 'Occupancy Reports',
          path: '/reports/occupancy',
          visible: permissions.includes('read_reports')
        },
        staffReports: {
          name: 'Staff Reports',
          path: '/reports/staff',
          visible: settings.canViewReports && settings.canViewAllStaff
        }
      }
    },

    // User Management
    users: {
      name: 'User Management',
      path: '/users',
      icon: 'user-plus',
      visible: settings.canCreateUsers || settings.canAssignRoles,
      permissions: ['create_users', 'manage_users'],
      subSections: {
        createUser: {
          name: 'Create User',
          path: '/users/create',
          visible: settings.canCreateUsers
        },
        assignRoles: {
          name: 'Assign Roles',
          path: '/users/roles',
          visible: settings.canAssignRoles
        }
      }
    },

    // Settings
    settings: {
      name: 'Settings',
      path: '/settings',
      icon: 'cog',
      visible: settings.canAccessSettings || settings.canManageSettings,
      permissions: ['manage_settings', 'access_settings'],
      subSections: {
        systemSettings: {
          name: 'System Settings',
          path: '/settings/system',
          visible: settings.canManageSettings
        },
        profileSettings: {
          name: 'Profile Settings',
          path: '/settings/profile',
          visible: settings.canAccessSettings
        }
      }
    },

    // Rooms (based on access level)
    rooms: {
      name: 'Room Management',
      path: '/rooms',
      icon: 'home',
      visible: accessLevel.rooms !== 'limited',
      permissions: ['manage_rooms', 'view_rooms'],
      accessLevel: accessLevel.rooms,
      subSections: {
        allRooms: {
          name: 'All Rooms',
          path: '/rooms/all',
          visible: accessLevel.rooms === 'all'
        },
        departmentRooms: {
          name: 'Department Rooms',
          path: '/rooms/department',
          visible: accessLevel.rooms === 'department'
        },
        assignedRooms: {
          name: 'Assigned Rooms',
          path: '/rooms/assigned',
          visible: accessLevel.rooms === 'assigned'
        }
      }
    }
  };

  // Filter sections based on visibility
  const visibleSections = {};
  Object.keys(dashboardSections).forEach(key => {
    const section = dashboardSections[key];
    if (section.visible) {
      // Filter sub-sections
      if (section.subSections) {
        const visibleSubSections = {};
        Object.keys(section.subSections).forEach(subKey => {
          const subSection = section.subSections[subKey];
          if (subSection.visible) {
            visibleSubSections[subKey] = subSection;
          }
        });
        section.subSections = visibleSubSections;
      }
      visibleSections[key] = section;
    }
  });

  // Get user stats based on permissions
  const userStats = await getUserStats(user, permissions, settings);

  // Dashboard data
  const dashboardData = {
    user: {
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName(),
      email: user.email,
      role: {
        name: role.name,
        hierarchy: role.hierarchy
      },
      department: user.department ? {
        name: user.department.name,
        id: user.department._id
      } : null,
      profile: user.profile
    },
    navigation: visibleSections,
    stats: userStats,
    permissions: {
      list: permissions,
      settings: settings,
      accessLevel: accessLevel
    }
  };

  logger.info('Dashboard accessed', {
    userId: user._id,
    username: user.username,
    role: role.name,
    sectionsCount: Object.keys(visibleSections).length
  });

  res.json({
    success: true,
    data: dashboardData,
    message: 'Dashboard data retrieved successfully'
  });
});

// Get user-specific stats based on permissions
const getUserStats = async (user, permissions, settings) => {
  const stats = {};

  try {
    // Staff stats (if user can view staff)
    if (settings.canViewAllStaff || settings.canManageStaff) {
      const totalStaff = await User.countDocuments({ isActive: true });
      const departmentStaff = user.department ? 
        await User.countDocuments({ department: user.department._id, isActive: true }) : 0;
      
      stats.staff = {
        total: settings.canViewAllStaff ? totalStaff : null,
        department: departmentStaff
      };
    }

    // Booking stats (if user can view bookings)
    if (settings.canManageBookings || permissions.includes('read_bookings')) {
      // Note: Assuming you have a Booking model
      // const totalBookings = await Booking.countDocuments();
      // stats.bookings = { total: totalBookings };
      stats.bookings = { total: 0 }; // Placeholder
    }

    // Role stats (if user can manage roles)
    if (settings.canManageRoles) {
      const totalRoles = await Role.countDocuments({ isActive: true });
      stats.roles = { total: totalRoles };
    }

  } catch (error) {
    logger.error('Error fetching user stats:', error);
  }

  return stats;
};

// Get user permissions (utility endpoint)
export const getUserPermissions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const user = await User.findById(userId)
    .populate('role', 'name permissions settings accessLevel');

  if (!user || !user.isActive) {
    return res.status(404).json({
      success: false,
      message: 'User not found or inactive'
    });
  }

  res.json({
    success: true,
    data: {
      permissions: user.role.permissions || [],
      settings: user.role.settings || {},
      accessLevel: user.role.accessLevel || {},
      role: {
        name: user.role.name,
        hierarchy: user.role.hierarchy
      }
    },
    message: 'User permissions retrieved successfully'
  });
});
