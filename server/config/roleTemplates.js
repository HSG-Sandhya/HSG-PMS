// Default role templates used by GET /admin/settings/role-templates and
// POST /admin/settings/role-from-template (see adminSettingsController.js).
//
// `permissions` MUST use the enforced permission strings from
// ./permissions.js (PERMISSION_CATALOG) — i.e. the same `manage_*` / `view_*`
// strings the route guards check. A role created from a template inherits this
// list verbatim, so dot-notation placeholders (the old values) produced roles
// with no working access. The leading `manage_*` of each feature area is what
// actually gates that page in client/src/App.js + Sidebar.js.
export const ROLE_TEMPLATES = {
  admin: {
    name: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: [
      'view_dashboard', 'manage_bookings', 'manage_reservations', 'manage_rooms',
      'manage_guests', 'manage_staff', 'manage_housekeeping', 'manage_restaurant',
      'manage_pos', 'manage_accounting', 'manage_events', 'manage_channels',
      'manage_attendance', 'manage_payroll', 'manage_settings',
      'admin_access', 'manage_roles', 'view_system_logs',
    ],
    settings: {
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
      maxApprovalAmount: 999999,
    },
    hierarchy: 10,
  },
  manager: {
    name: 'Manager',
    description: 'Department management with limited admin access',
    permissions: [
      'view_dashboard', 'manage_bookings', 'manage_reservations', 'manage_rooms',
      'manage_guests', 'manage_housekeeping', 'manage_restaurant', 'manage_pos',
      'manage_events', 'manage_channels', 'manage_staff', 'manage_attendance',
    ],
    settings: {
      canManageStaff: true,
      canViewReports: true,
      canManageBookings: true,
      canCreateUsers: false,
      canAssignRoles: false,
      canManageSettings: false,
      canAccessSettings: false,
      canManageRoles: false,
      canViewAllStaff: true,
      canEditStaffProfiles: true,
      canDeactivateStaff: false,
      maxApprovalAmount: 10000,
    },
    hierarchy: 7,
  },
  frontdesk: {
    name: 'Front Desk',
    description: 'Guest services and booking management',
    permissions: [
      'view_dashboard', 'manage_bookings', 'manage_reservations',
      'manage_rooms', 'manage_guests',
    ],
    settings: {
      canManageStaff: false,
      canViewReports: false,
      canManageBookings: true,
      canCreateUsers: false,
      canAssignRoles: false,
      canManageSettings: false,
      canAccessSettings: false,
      canManageRoles: false,
      canViewAllStaff: false,
      canEditStaffProfiles: false,
      canDeactivateStaff: false,
      maxApprovalAmount: 1000,
    },
    hierarchy: 3,
  },
  housekeeping: {
    name: 'Housekeeping',
    description: 'Room maintenance and cleaning operations',
    permissions: [
      'view_dashboard', 'manage_housekeeping',
    ],
    settings: {
      canManageStaff: false,
      canViewReports: false,
      canManageBookings: false,
      canCreateUsers: false,
      canAssignRoles: false,
      canManageSettings: false,
      canAccessSettings: false,
      canManageRoles: false,
      canViewAllStaff: false,
      canEditStaffProfiles: false,
      canDeactivateStaff: false,
      maxApprovalAmount: 500,
    },
    hierarchy: 2,
  },
  restaurant: {
    name: 'Restaurant Staff',
    description: 'Food service and restaurant operations',
    permissions: [
      'view_dashboard', 'manage_restaurant', 'manage_pos',
    ],
    settings: {
      canManageStaff: false,
      canViewReports: false,
      canManageBookings: false,
      canCreateUsers: false,
      canAssignRoles: false,
      canManageSettings: false,
      canAccessSettings: false,
      canManageRoles: false,
      canViewAllStaff: false,
      canEditStaffProfiles: false,
      canDeactivateStaff: false,
      maxApprovalAmount: 500,
    },
    hierarchy: 2,
  },
};

export default ROLE_TEMPLATES;
