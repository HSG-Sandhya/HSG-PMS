import { lazy } from 'react';
import Dashboard from '@mui/icons-material/Dashboard';
import BookOnline from '@mui/icons-material/BookOnline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import Hotel from '@mui/icons-material/Hotel';
import Person from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CleaningServices from '@mui/icons-material/CleaningServices';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CloudSyncIcon from '@mui/icons-material/CloudSync';

/**
 * THE route table. One entry per protected page, and the only place that says
 * which permissions open it.
 *
 * This previously lived in three hand-synchronised lists — the <ProtectedRoute>
 * blocks in App.js, the `menuItems` array in Sidebar.js, and LANDING_ROUTES in
 * PermissionContext.js, whose comment asked future editors to keep all three in
 * step. Adding a page meant remembering all three; forgetting the third gave a
 * user a visible nav row that bounced them straight back out.
 *
 * Entry shape:
 *   path         route path (also the sidebar link target)
 *   permissions  ANY ONE of these opens the page. Matches how both
 *                ProtectedRoute (`.some()`) and the Sidebar already behaved;
 *                system admins bypass the check entirely.
 *   Component    lazily-loaded page component
 *   props        static props for that component (e.g. which tab to open)
 *   nav          present => a top-level sidebar row. Omit for routes that are
 *                reachable by link but have no nav entry of their own.
 *   landing      true => may be chosen as a role's landing page. ARRAY ORDER
 *                decides preference, so keep the list in priority order.
 *
 * The server remains authoritative: this only decides what the UI offers, never
 * what the API allows.
 */
export const ROUTES = [
  {
    path: '/dashboard',
    permissions: ['view_dashboard'],
    Component: lazy(() => import('../pages/reports/Dashboard')),
    nav: { title: 'Dashboard', icon: Dashboard, color: 'from-blue-400 to-blue-600' },
    landing: true,
  },
  {
    path: '/bookings',
    permissions: ['manage_bookings'],
    Component: lazy(() => import('../pages/operations/Bookings')),
    props: { view: 'active' },
    nav: {
      title: 'Bookings',
      icon: BookOnline,
      color: 'from-green-400 to-green-600',
      subItems: [
        { title: 'Active Bookings', path: '/bookings' },
        { title: 'Checked Out', path: '/bookings/checked-out' },
      ],
    },
    landing: true,
  },
  {
    // Reached through the Bookings sub-nav, so no nav row of its own.
    path: '/bookings/checked-out',
    permissions: ['manage_bookings'],
    Component: lazy(() => import('../pages/operations/Bookings')),
    props: { view: 'checkedout' },
  },
  {
    path: '/reservations',
    permissions: ['manage_reservations'],
    Component: lazy(() => import('../pages/management/Reservations')),
    nav: { title: 'Reservations', icon: CalendarMonthIcon, color: 'from-blue-400 to-blue-600' },
    landing: true,
  },
  {
    path: '/rooms',
    permissions: ['manage_rooms'],
    Component: lazy(() => import('../pages/management/Rooms')),
    nav: { title: 'Rooms', icon: Hotel, color: 'from-purple-400 to-purple-600' },
    landing: true,
  },
  {
    path: '/guests',
    permissions: ['manage_guests'],
    Component: lazy(() => import('../pages/management/Guests')),
    nav: { title: 'Guests', icon: Person, color: 'from-yellow-400 to-yellow-600' },
    landing: true,
  },
  {
    path: '/accounting',
    permissions: ['manage_accounting'],
    Component: lazy(() => import('../pages/management/Accounting')),
    nav: { title: 'Accounting', icon: AccountBalanceWalletIcon, color: 'from-emerald-400 to-emerald-600' },
    landing: true,
  },
  {
    // Staff management is reached through Settings → Staff, so it has no nav
    // row. The route still exists for direct links.
    path: '/staffs',
    permissions: ['manage_staff', 'view_staff', 'create_staff'],
    Component: lazy(() => import('../pages/management/Staff')),
    landing: true,
  },
  {
    // Attendance and payroll share one workspace, so either side's permission
    // opens it.
    path: '/workforce',
    permissions: ['manage_attendance', 'manage_payroll', 'view_payroll'],
    Component: lazy(() => import('../components/WorkforceManagement')),
    props: { defaultTab: 'attendance' },
    nav: { title: 'Staff & Payroll', icon: AccessTimeIcon, color: 'from-cyan-400 to-cyan-600' },
    landing: true,
  },
  {
    path: '/housekeeping',
    permissions: ['manage_housekeeping'],
    Component: lazy(() => import('../pages/operations/Housekeepings')),
    nav: { title: 'Housekeeping', icon: CleaningServices, color: 'from-pink-400 to-pink-600' },
    landing: true,
  },
  {
    path: '/restaurant',
    permissions: ['manage_restaurant'],
    Component: lazy(() => import('../pages/operations/Restaurant')),
    nav: { title: 'Restaurant', icon: RestaurantIcon, color: 'from-red-400 to-red-600' },
    landing: true,
  },
  {
    path: '/pos',
    permissions: ['manage_pos'],
    Component: lazy(() => import('../pages/operations/POS')),
    nav: { title: 'POS', icon: PointOfSaleIcon, color: 'from-green-400 to-green-600' },
    landing: true,
  },
  {
    path: '/banquet-hall',
    permissions: ['manage_events'],
    Component: lazy(() => import('../pages/management/BanquetHallBooking')),
    nav: { title: 'Banquet Hall Booking', icon: CelebrationIcon, color: 'from-indigo-400 to-indigo-600' },
    landing: true,
  },
  {
    path: '/channels',
    permissions: ['manage_channels'],
    Component: lazy(() => import('../pages/management/ChannelManager')),
    nav: { title: 'Channel Manager', icon: CloudSyncIcon, color: 'from-teal-400 to-teal-600' },
    landing: true,
  },
  {
    // The sidebar renders Settings in its own footer section, not as a nav row.
    path: '/settings',
    permissions: ['manage_settings'],
    Component: lazy(() => import('../components/settings')),
    landing: true,
  },

  // ── Routes with no nav row and no landing eligibility ────────────────────
  {
    path: '/admin',
    permissions: ['admin_access'],
    Component: lazy(() => import('../components/AdminPanel')),
  },
  {
    // Backward-compatible deep links that open a specific Workforce tab.
    path: '/staff-attendance',
    permissions: ['manage_attendance'],
    Component: lazy(() => import('../components/WorkforceManagement')),
    props: { defaultTab: 'attendance' },
  },
  {
    path: '/payroll',
    permissions: ['manage_payroll', 'view_payroll'],
    Component: lazy(() => import('../components/WorkforceManagement')),
    props: { defaultTab: 'payroll' },
  },
];

/** Sidebar rows, in display order. */
export const NAV_ROUTES = ROUTES.filter((r) => r.nav);

/** Landing candidates, in preference order — first one the role can open wins. */
export const LANDING_ROUTES = ROUTES.filter((r) => r.landing);

export default ROUTES;
