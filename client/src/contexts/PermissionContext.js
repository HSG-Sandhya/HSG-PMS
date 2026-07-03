import { createContext, useContext, useState, useEffect } from 'react';
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
  const isAdmin = () => {
    return userRole?.toLowerCase() === 'admin' || userPermissions.includes('*');
  };
  
  const isManager = () => {
    return userRole?.toLowerCase() === 'manager' || isAdmin();
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
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
