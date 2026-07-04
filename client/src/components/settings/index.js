import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Container,
  Snackbar,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Hotel as HotelIcon,
  MeetingRoom as RoomIcon,
  Groups as DeptIcon,
  AdminPanelSettings as RolesIcon,
  Receipt as InvoiceIcon,
  Badge as StaffIcon,
  Palette as PaletteIcon,
  Payments as PaymentsIcon,
  WhatsApp as WhatsAppIcon,
  RequestQuote as BillingIcon,
  Tune as OperationsIcon,
} from '@mui/icons-material';
import HotelProfileSection from './sections/HotelProfileSection';
import RoomCategoriesSection from './sections/RoomCategoriesSection';
import DepartmentsSection from './sections/DepartmentsSection';
import UserSecuritySection from './sections/UserSecuritySection';
import InvoiceTemplateSection from './sections/InvoiceTemplateSection';
import StaffSection from './sections/StaffSection';
import ThemeSection from './sections/ThemeSection';
import PaymentGatewaySection from './sections/PaymentGatewaySection';
import GuestWelcomeSection from './sections/GuestWelcomeSection';
import BillingSection from './sections/BillingSection';
import OperationsSection from './sections/OperationsSection';

const ACCENT = 'var(--app-primary)';

const SECTIONS = [
  {
    id: 'hotel',
    title: 'Hotel profile',
    description: 'Name, logo, address, contact, business numbers',
    icon: HotelIcon,
    Component: HotelProfileSection,
  },
  {
    id: 'rooms',
    title: 'Room categories',
    description: 'Templates for room creation',
    icon: RoomIcon,
    Component: RoomCategoriesSection,
  },
  {
    id: 'staff',
    title: 'Staff',
    description: 'Team members & account creation',
    icon: StaffIcon,
    Component: StaffSection,
  },
  {
    id: 'departments',
    title: 'Departments',
    description: 'Organisational units',
    icon: DeptIcon,
    Component: DepartmentsSection,
  },
  {
    id: 'roles',
    title: 'User & Security',
    description: 'Role-based access, user permissions, activity logs, audit trail & data backup',
    icon: RolesIcon,
    Component: UserSecuritySection,
  },
  {
    id: 'invoice',
    title: 'Invoice template',
    description: 'Template used for generated invoices',
    icon: InvoiceIcon,
    Component: InvoiceTemplateSection,
  },
  {
    id: 'billing',
    title: 'Billing & Tariff',
    description: 'GST rates, breakfast charge, default check-in/out times, invoice prefix, currency & discount cap',
    icon: BillingIcon,
    Component: BillingSection,
  },
  {
    id: 'operations',
    title: 'Operations',
    description: 'Housekeeping, payroll & accounting workflow defaults',
    icon: OperationsIcon,
    Component: OperationsSection,
  },
  {
    id: 'payment',
    title: 'Payment gateway',
    description: 'Razorpay credentials & live-mode toggle',
    icon: PaymentsIcon,
    Component: PaymentGatewaySection,
  },
  {
    id: 'guest-welcome',
    title: 'Guest Welcome',
    description: 'WiFi password & food-menu link sent to guests on check-in via WhatsApp',
    icon: WhatsAppIcon,
    Component: GuestWelcomeSection,
  },
  {
    id: 'theme',
    title: 'Appearance',
    description: 'Colours, dark mode, typography & corner radius — applied app-wide',
    icon: PaletteIcon,
    Component: ThemeSection,
  },
];

const Settings = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const notify = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];
  const ActiveComponent = active.Component;
  const ActiveIcon = active.icon;

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        {/* Page header */}
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
            System settings
          </Typography>
          <Typography variant="body1" sx={{
            color: "text.secondary"
          }}>
            Configure how your hotel runs. Changes apply immediately across the app.
          </Typography>
        </Box>

        {/* Horizontal pill tab bar */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            p: 1,
            mb: 3,
            borderRadius: 3,
            overflowX: 'auto',
            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            '&::-webkit-scrollbar': { height: 6 },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 },
          }}
        >
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const selected = activeId === section.id;
            return (
              <Box
                key={section.id}
                component="button"
                type="button"
                onClick={() => setActiveId(section.id)}
                title={section.description}
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2.25,
                  py: 1.25,
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 2.5,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  transition: 'all .2s ease',
                  color: selected ? '#fff' : (isDarkMode ? 'rgba(226,232,240,0.85)' : 'rgba(71,85,105,0.95)'),
                  background: selected
                    ? `linear-gradient(135deg, ${ACCENT} 0%, var(--app-primary) 100%)`
                    : 'transparent',
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
                {section.title}
              </Box>
            );
          })}
        </Box>

        {/* Active section header */}
        <Box
          sx={{
            mb: 2.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5
          }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))',
              color: ACCENT,
            }}
          >
            <ActiveIcon />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2
              }}>
              {active.title}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              {active.description}
            </Typography>
          </Box>
        </Box>

        {/* Active section content */}
        <Box
          sx={{
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
          }}
        >
          <ActiveComponent onNotify={notify} />
        </Box>
      </Container>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
