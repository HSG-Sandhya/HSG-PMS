// Canonical catalog of assignable permission strings, grouped by feature area.
//
// This is the SINGLE SOURCE OF TRUTH consumed by every "available permissions"
// endpoint so the lists can't drift apart:
//   • GET /settings/permissions      → Settings → Roles UI (RolesSection)
//   • GET /admin/roles/permissions   → RoleDialog / AdminPanel
//   • GET /user-roles/permissions
//
// The leading `manage_*` string in each group is the one actually ENFORCED by
// the route guards — client `<ProtectedRoute requiredPermissions={[...]}>` in
// client/src/App.js, the server `requireManage('...')` middleware, and the
// Sidebar menu items (client/src/components/layout/Sidebar.js). If you add a
// new gated page, add its `manage_*` string here too, otherwise admins can
// never grant that page to a custom (non-system-admin) role.
export const PERMISSION_CATALOG = [
  { name: 'dashboard', permissions: ['view_dashboard'] },
  { name: 'bookings', permissions: ['manage_bookings', 'view_bookings', 'create_bookings', 'edit_bookings', 'cancel_bookings'] },
  { name: 'reservations', permissions: ['manage_reservations', 'view_reservations', 'create_reservations', 'edit_reservations'] },
  { name: 'rooms', permissions: ['manage_rooms', 'view_rooms', 'edit_room_status', 'assign_rooms'] },
  { name: 'guests', permissions: ['manage_guests', 'view_guests', 'create_guest_profiles', 'edit_guest_profiles'] },
  { name: 'staff', permissions: ['manage_staff', 'view_staff', 'create_staff', 'edit_staff', 'deactivate_staff'] },
  { name: 'housekeeping', permissions: ['manage_housekeeping', 'view_housekeeping_tasks', 'assign_housekeeping', 'update_room_status'] },
  { name: 'restaurant', permissions: ['manage_restaurant', 'view_restaurant_orders', 'create_restaurant_orders', 'manage_menu'] },
  { name: 'pos', permissions: ['manage_pos', 'process_payments', 'view_transactions', 'manage_inventory'] },
  { name: 'accounting', permissions: ['manage_accounting', 'manage_payments', 'view_financial_reports', 'process_refunds', 'manage_billing'] },
  { name: 'events', permissions: ['manage_events', 'view_events', 'create_events', 'edit_events'] },
  { name: 'channels', permissions: ['manage_channels', 'view_channel_bookings', 'sync_channels', 'manage_rates'] },
  { name: 'attendance', permissions: ['manage_attendance', 'view_attendance', 'mark_attendance', 'edit_attendance', 'delete_attendance', 'bulk_attendance_operations', 'view_attendance_reports', 'view_attendance_calendar', 'manage_staff_attendance'] },
  { name: 'payroll', permissions: ['manage_payroll', 'view_payroll', 'generate_payroll', 'approve_payroll', 'edit_payroll', 'delete_payroll', 'generate_payroll_pdf', 'download_payroll_pdf', 'process_payroll_payments', 'view_payroll_reports', 'view_payroll_summary'] },
  { name: 'settings', permissions: ['manage_settings', 'view_settings', 'edit_system_settings', 'manage_departments'] },
  { name: 'admin', permissions: ['admin_access', 'manage_roles', 'view_system_logs', 'manage_backups', 'system_administration'] },
];

// Flat list of every permission string (handy for "select all" / validation).
export const ALL_PERMISSIONS = PERMISSION_CATALOG.flatMap((g) => g.permissions);

export default PERMISSION_CATALOG;
