import { useState } from 'react';
import { Box, Container, Typography, useTheme } from '@mui/material';
import {
  AccessTime as AttendanceIcon,
  Payments as PayrollIcon,
} from '@mui/icons-material';
import StaffAttendanceCards from './StaffAttendanceCards';
import PayrollManagement from './PayrollManagement';
import { usePermissions } from '../contexts/PermissionContext';

const ACCENT = 'var(--app-primary)';

const TABS = [
  { id: 'attendance', label: 'Attendance', icon: AttendanceIcon, Component: StaffAttendanceCards, permissions: ['manage_attendance'] },
  { id: 'payroll', label: 'Payroll', icon: PayrollIcon, Component: PayrollManagement, permissions: ['manage_payroll', 'view_payroll'] },
];

const WorkforceManagement = ({ defaultTab = 'attendance' }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  // A role may hold payroll permissions without attendance ones (or the reverse),
  // so show only the tabs it can actually use and open the first of them.
  const { hasAnyPermission } = usePermissions();
  const tabs = TABS.filter((t) => hasAnyPermission(t.permissions));
  const [activeId, setActiveId] = useState(
    tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id,
  );

  const ActiveComponent = (tabs.find((t) => t.id === activeId) || tabs[0])?.Component;

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 3 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{
          mb: 3,
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
          backdropFilter: 'var(--app-blur)',
          WebkitBackdropFilter: 'var(--app-blur)',
          border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        }}>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--app-primary)'
            }}>
            Staff &amp; Payroll
          </Typography>
          <Typography variant="body1" sx={{
            color: "text.secondary"
          }}>
            Track attendance and run payroll from one place.
          </Typography>
        </Box>

        {/* Pill tab bar — pointless when the role can only use one of them */}
        {tabs.length > 1 && (
        <Box
          sx={{
            display: 'inline-flex',
            gap: 1,
            p: 1,
            mb: 3,
            borderRadius: 3,
            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeId === tab.id;
            return (
              <Box
                key={tab.id}
                component="button"
                type="button"
                onClick={() => setActiveId(tab.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 3,
                  py: 1.25,
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 2.5,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all .2s ease',
                  color: selected ? '#fff' : (isDarkMode ? 'rgba(226,232,240,0.85)' : 'rgba(71,85,105,0.95)'),
                  background: selected ? `linear-gradient(135deg, ${ACCENT} 0%, var(--app-primary) 100%)` : 'transparent',
                  boxShadow: selected ? '0 8px 20px -8px rgba(var(--app-primary-rgb),0.6)' : 'none',
                  '&:hover': {
                    background: selected
                      ? `linear-gradient(135deg, var(--app-primary) 0%, ${ACCENT} 100%)`
                      : (isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(var(--app-primary-rgb),0.08)'),
                    color: selected ? '#fff' : ACCENT,
                  },
                }}
              >
                <Icon sx={{ fontSize: 18 }} />
                {tab.label}
              </Box>
            );
          })}
        </Box>
        )}

        {/* Active tab content. Keep both mounted-on-demand via key so each
            component manages its own data fetching. */}
        <Box key={activeId}>
          {ActiveComponent && <ActiveComponent />}
        </Box>
      </Container>
    </Box>
  );
};

export default WorkforceManagement;
