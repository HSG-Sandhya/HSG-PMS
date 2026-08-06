import { Navigate, useLocation } from 'react-router-dom';
import { Box, Button, CircularProgress, Alert, Stack } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';

// Shown instead of a redirect when there is nowhere to send the user — a role
// with no page permissions at all, or one denied the only page it can reach.
// Redirecting in that situation just loops.
const NoAccess = ({ onLogout }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 3 }}>
    <Stack spacing={2} sx={{ maxWidth: 460 }}>
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Your role doesn&apos;t have access to this page. Ask an administrator to grant the
        permissions you need.
      </Alert>
      <Button variant="outlined" onClick={onLogout} sx={{ alignSelf: 'flex-start' }}>
        Sign out
      </Button>
    </Stack>
  </Box>
);

const ProtectedRoute = ({ children, allowedRoles, requiredPermissions }) => {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const { userRole, loading: permLoading, hasPermission, isAdmin, landingPath } = usePermissions();
  const location = useLocation();

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

  // Send a denied user to the first page their role CAN open. Falling back to a
  // fixed path would loop for anyone who lacks that page (login lands everyone
  // on /dashboard, which not every role may view).
  const bounce = () => {
    const target = landingPath?.();
    if (!target || target === location.pathname) {
      return <NoAccess onLogout={logout} />;
    }
    return <Navigate to={target} replace />;
  };

  // Permission-based access control (primary method)
  if (requiredPermissions && requiredPermissions.length > 0) {
    // Admin users have access to everything
    if (isAdmin()) {
      return children;
    }

    // Any one of the listed permissions opens the page. Pages are usually gated
    // on a single `manage_*` string, but some accept a granular alternative
    // (e.g. Staff: 'manage_staff' OR 'view_staff' OR 'create_staff').
    const allowed = requiredPermissions.some(permission => hasPermission(permission));

    if (!allowed) {
      return bounce();
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
      return bounce();
    }
  }

  return children;
};

export default ProtectedRoute;
