import { useCallback, useState } from 'react';
import { Box, Typography, Alert, Snackbar } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import StaffSection from '../../components/settings/sections/StaffSection';

// Staff management page. Reuses the same section the Settings screen renders, so
// a role granted Staff permissions gets the full add/edit/deactivate UI without
// needing `manage_settings` (which used to be the only door to it). The section
// hides whichever actions the role isn't allowed to perform.
const Staff = () => {
  const { isAuthenticated } = useAuth();
  const { hasAnyPermission } = usePermissions();
  const [toast, setToast] = useState(null);

  // Stable identity — StaffSection's data loader depends on this callback, so a
  // fresh function each render would re-fetch in a loop.
  const notify = useCallback(
    (message, severity = 'info') => setToast({ message, severity }),
    [],
  );

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}>
        <Alert severity="warning">Please log in to access staff management.</Alert>
      </Box>
    );
  }

  // Read-only = can browse the roster but change nothing. A create-only role is
  // the opposite case and gets no banner — StaffSection shows the add flow.
  const readOnly = hasAnyPermission(['manage_staff', 'view_staff'])
    && !hasAnyPermission(['manage_staff', 'create_staff', 'edit_staff']);

  return (
    <Box sx={{ p: 3, minHeight: '100vh', background: 'transparent' }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 700,
          color: 'var(--app-primary)',
          mb: 3,
        }}
      >
        Staff
      </Typography>
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have view-only access to staff records.
        </Alert>
      )}
      <StaffSection onNotify={notify} />
      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};

export default Staff;
