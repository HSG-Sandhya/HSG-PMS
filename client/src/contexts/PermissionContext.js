import { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

// Gated pages in sidebar order, with the permissions that open each one. Used to
// pick where a user lands when they can't see the page they asked for. Keep in
// step with the routes in App.js and the menu in components/layout/Sidebar.js.
const LANDING_ROUTES = [
  ['/dashboard', ['view_dashboard']],
  ['/bookings', ['manage_bookings']],
  ['/reservations', ['manage_reservations']],
  ['/rooms', ['manage_rooms']],
  ['/guests', ['manage_guests']],
  ['/accounting', ['manage_accounting']],
  ['/staffs', ['manage_staff', 'view_staff', 'create_staff']],
  ['/workforce', ['manage_attendance', 'manage_payroll', 'view_payroll']],
  ['/housekeeping', ['manage_housekeeping']],
  ['/restaurant', ['manage_restaurant']],
  ['/pos', ['manage_pos']],
  ['/banquet-hall', ['manage_events']],
  ['/channels', ['manage_channels']],
  ['/settings', ['manage_settings']],
];

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated || !token) {
        setCurrentUser(null);
        setUserRole(null);
        setUserPermissions([]);
        setLoading(false);
        return;
      }

      try {
        const res = await apiService.auth.profile();

        if (res.data.success) {
          const profile = res.data.data;
          setCurrentUser(profile);
          
          // Extract role name properly
          let roleName = profile.role?.name || profile.roleName || 'user';
          
          // Special handling for admin users to normalize role
          if (profile.isSystemAdmin || roleName?.toLowerCase().includes('admin')) {
            roleName = 'admin';
          }
          
          setUserRole(roleName);

          // ✅ Permission handling
          if (
            profile.isSystemAdmin ||
            roleName?.toLowerCase() === 'admin' ||
            roleName?.toLowerCase() === 'system administrator'
          ) {
            setUserPermissions(['*']); // full access
          } else if (Array.isArray(profile.role?.permissions)) {
            setUserPermissions(profile.role.permissions);
          } else if (Array.isArray(profile.permissions)) {
            setUserPermissions(profile.permissions);
          } else {
            setUserPermissions([]);
          }
        } else {
          setUserPermissions([]);
        }
      } catch (err) {
        setUserPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated, token]);

  // Permission helper functions
  // Matches the server's rule in middleware/staffAuthority.js and
  // controllers/adminStaffController.js: the admin guards grant access by role
  // NAME, so any admin-named role is an administrator. An exact 'admin' match
  // was wrong — the real roles are "Super Admin" and "System Administrator",
  // so the UI hid admin-only controls from the very accounts that hold them
  // while the server allowed the calls.
  const isAdmin = () => {
    const name = userRole?.toLowerCase() || '';
    return name.includes('admin') || name.includes('system') || userPermissions.includes('*');
  };
  
  const isManager = () => {
    return userRole?.toLowerCase() === 'manager' || isAdmin();
  };

  // Approving payroll releases money, so it sits above the rest of the payroll
  // screen: managers generate and print, administrators and the owner approve.
  // Mirrors canApprovePayroll() in server/controllers/payrollController.js —
  // deliberately identity-based, because every role with payroll access was
  // granted the `approve_payroll` permission and so it cannot discriminate.
  // Keep the two in step: the server is the enforcement, this only hides the UI.
  const canApprovePayroll = () => {
    return isAdmin() || userRole?.toLowerCase() === 'owner';
  };
  
  const hasPermission = (permission) => {
    if (!permission) { return true; }
    if (userPermissions.includes('*')) { return true; }
    return userPermissions.includes(permission);
  };
  
  const hasAnyPermission = (permissions) => {
    if (!permissions || !permissions.length) { return true; }
    if (userPermissions.includes('*')) { return true; }
    return permissions.some(p => userPermissions.includes(p));
  };
  
  const hasAllPermissions = (permissions) => {
    if (!permissions || !permissions.length) { return true; }
    if (userPermissions.includes('*')) { return true; }
    return permissions.every(p => userPermissions.includes(p));
  };
  
  const hasRole = (role) => {
    if (!role) { return true; }
    return userRole?.toLowerCase() === role.toLowerCase();
  };

  // First page this user is actually allowed to open, in sidebar order. Login
  // always lands on /dashboard, but a role can be granted (say) only payroll —
  // without this it would be redirected from /dashboard back to /dashboard.
  const landingPath = () => {
    if (isAdmin()) { return '/dashboard'; }
    const found = LANDING_ROUTES.find(([, perms]) => hasAnyPermission(perms));
    return found ? found[0] : null;
  };
  
  const hasAnyRole = (roles) => {
    if (!roles || !roles.length) { return true; }
    return roles.some(r => userRole?.toLowerCase() === r.toLowerCase());
  };

  return (
    <PermissionContext.Provider
      value={{
        currentUser,
        userRole,
        userPermissions,
        loading,
        isAdmin,
        isManager,
        canApprovePayroll,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        hasAnyRole,
        landingPath,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
