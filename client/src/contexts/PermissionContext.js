import { createContext, useContext, useState, useEffect } from 'react';
import { LANDING_ROUTES } from '../config/routes';
import apiService from '../api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) {
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
          
          // Display label only — the real check is isAdmin() below.
          if (profile.isSystemAdmin) {
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
  }, [isAuthenticated]);

  // Permission helper functions
  // Matches the server's rule in middleware/staffAuthority.js and
  // controllers/adminStaffController.js: the admin guards grant access by role
  // Administrator status comes from the immutable `isSystemAdmin` flag or an
  // explicit admin grant — never from the role's display name. A substring
  // match on the name ('admin' || 'system') promoted anything a hotel called
  // "System Auditor" or "Assistant Administrator" to full access, and isAdmin()
  // bypasses every permission check in ProtectedRoute.
  //
  // Equivalent on current data: "Super Admin" is the only role holding these
  // permissions and was also the only substring match.
  const isAdmin = () =>
    Boolean(currentUser?.isSystemAdmin) ||
    userPermissions.includes('admin_access') ||
    userPermissions.includes('system_administration') ||
    userPermissions.includes('*');

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
    const found = LANDING_ROUTES.find((r) => hasAnyPermission(r.permissions));
    return found ? found.path : null;
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
