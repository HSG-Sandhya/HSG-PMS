// ───────────────────────────────────────────────────────────────────────────
// The permission catalogue, mirrored from server/config/permissions.js.
//
// WHY A MIRROR: the route table has to know which permissions open a page
// before any API call has been made, so it cannot fetch this. A server test
// (test/uiPermissions.test.js) asserts the two files are identical, so a
// permission added on one side and not the other fails the build rather than
// quietly locking someone out of a page.
//
// WHY IT EXISTS AT ALL: routes.js used to hand-list a single `manage_*`
// permission per page. That is the WRITE permission, so any role granted only
// the read or partial ones was bounced out of a page its own permissions said
// it could use — a Room Attendant holding view_housekeeping_tasks and
// update_room_status could not open /housekeeping at all. Deriving each route
// from its catalogue group means the two can no longer disagree.
// ───────────────────────────────────────────────────────────────────────────

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
  { name: 'media', permissions: ['manage_media'] },
  { name: 'admin', permissions: ['admin_access', 'manage_roles', 'view_system_logs', 'view_backups', 'manage_backups', 'system_administration'] },
];

export const ALL_PERMISSIONS = PERMISSION_CATALOG.flatMap((g) => g.permissions);

/**
 * Every permission in a catalogue group — i.e. everyone with any business on
 * that page. Throws on an unknown group so a typo fails loudly at import time
 * rather than silently producing a page nobody can open.
 */
export const groupPermissions = (...names) =>
  names.flatMap((name) => {
    const group = PERMISSION_CATALOG.find((g) => g.name === name);
    if (!group) throw new Error(`Unknown permission group "${name}"`);
    return group.permissions;
  });
