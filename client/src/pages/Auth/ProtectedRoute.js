import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';

const ProtectedRoute = ({ children, allowedRoles, requiredPermissions }) => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { userRole, loading: permLoading, hasPermission, isAdmin } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Permission-based access control (primary method)
  if (requiredPermissions && requiredPermissions.length > 0) {
    // Admin users have access to everything
    if (isAdmin()) {
      return children;
    }
    
    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => hasPermission(permission));
    
    if (!hasAllPermissions) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Legacy role-based access control (fallback)
  if (allowedRoles && allowedRoles.length > 0) {
    const actualRole = userRole || user?.role?.name || 'user';
    
    let hasAccess = false;
    
    // Check if user role matches any of the allowed roles
    if (allowedRoles.includes(actualRole)) {
      hasAccess = true;
    }
    
    // Special handling for admin users
    if (isAdmin() && allowedRoles.includes('admin')) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
