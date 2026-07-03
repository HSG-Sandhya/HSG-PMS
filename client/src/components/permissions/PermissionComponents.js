import { Button, IconButton, MenuItem, Box, Typography } from '@mui/material';
import { usePermissions } from '../../contexts/PermissionContext';

// Permission-based Button
export const PermissionButton = ({ 
  permission, 
  permissions, 
  role, 
  roles, 
  requireAll = false,
  disabled = false,
  children,
  ...props 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else if (role) {
    hasAccess = hasRole(role);
  } else if (roles) {
    hasAccess = hasAnyRole(roles);
  } else {
    hasAccess = true; // Default to true if no permission specified
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <Button disabled={disabled} {...props}>
      {children}
    </Button>
  );
};

// Permission-based IconButton
export const PermissionIconButton = ({ 
  permission, 
  permissions, 
  role, 
  roles, 
  requireAll = false,
  disabled = false,
  children,
  ...props 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else if (role) {
    hasAccess = hasRole(role);
  } else if (roles) {
    hasAccess = hasAnyRole(roles);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <IconButton disabled={disabled} {...props}>
      {children}
    </IconButton>
  );
};

// Permission-based MenuItem
export const PermissionMenuItem = ({ 
  permission, 
  permissions, 
  role, 
  roles, 
  requireAll = false,
  disabled = false,
  children,
  ...props 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else if (role) {
    hasAccess = hasRole(role);
  } else if (roles) {
    hasAccess = hasAnyRole(roles);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <MenuItem disabled={disabled} {...props}>
      {children}
    </MenuItem>
  );
};

// Permission-based Section/Box
export const PermissionSection = ({ 
  permission, 
  permissions, 
  role, 
  roles, 
  requireAll = false,
  fallback = null,
  children,
  ...props 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else if (role) {
    hasAccess = hasRole(role);
  } else if (roles) {
    hasAccess = hasAnyRole(roles);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return fallback;
  }

  return (
    <Box {...props}>
      {children}
    </Box>
  );
};

// Admin Dashboard Card
export const AdminDashboardCard = ({ children, ...props }) => {
  const { isAdmin } = usePermissions();
  
  if (!isAdmin()) {
    return (
      <Box {...props}>
        <Typography variant="h6" color="text.secondary" align="center">
          Admin Access Required
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Contact your administrator for access to this section.
        </Typography>
      </Box>
    );
  }

  return (
    <Box {...props}>
      {children}
    </Box>
  );
};

// Role-based greeting
export const RoleBasedGreeting = () => {
  const { currentUser, userRole, isAdmin, isManager } = usePermissions();
  
  const getGreeting = () => {
    if (isAdmin()) {
      return `Welcome back, Administrator ${currentUser?.name || ''}`;
    } else if (isManager()) {
      return `Welcome back, Manager ${currentUser?.name || ''}`;
    } else if (userRole) {
      return `Welcome back, ${userRole} ${currentUser?.name || ''}`;
    }
    return `Welcome back, ${currentUser?.name || 'User'}`;
  };

  return (
    <Typography variant="h6" color="primary">
      {getGreeting()}
    </Typography>
  );
};

// Permission indicator
export const PermissionIndicator = ({ permission, showLabel = true }) => {
  const { hasPermission } = usePermissions();
  const hasAccess = hasPermission(permission);
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: hasAccess ? 'success.main' : 'error.main',
        }}
      />
      {showLabel && (
        <Typography variant="caption" color={hasAccess ? 'success.main' : 'error.main'}>
          {hasAccess ? 'Allowed' : 'Restricted'}
        </Typography>
      )}
    </Box>
  );
};

// Admin Only wrapper component
export const AdminOnly = ({ children, fallback = null }) => {
  const { isAdmin } = usePermissions();
  
  if (!isAdmin()) {
    return fallback;
  }
  
  return children;
};

// Manager and Above wrapper component
export const ManagerAndAbove = ({ children, fallback = null }) => {
  const { isAdmin, isManager } = usePermissions();
  
  if (!isAdmin() && !isManager()) {
    return fallback;
  }
  
  return children;
};

const PermissionComponents = {
  PermissionButton,
  PermissionIconButton,
  PermissionMenuItem,
  PermissionSection,
  AdminDashboardCard,
  RoleBasedGreeting,
  PermissionIndicator,
  AdminOnly,
  ManagerAndAbove,
};

export default PermissionComponents;