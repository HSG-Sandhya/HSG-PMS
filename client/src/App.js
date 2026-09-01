import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { HousekeepingProvider } from './contexts/HousekeepingContext';
import { PermissionProvider } from './contexts/PermissionContext';

// Theme Provider
import AppThemeProvider from './components/layout/AppThemeProvider';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import ROUTES from './config/routes';
import PageLayout from './components/layout/PageLayout';

// Auth Components
import ProtectedRoute from './pages/Auth/ProtectedRoute';
import Login from './pages/Auth/Login';


// Auth Validator Component
import AuthValidator from './components/common/AuthValidator';
import AutoCacheManager from './components/common/AutoCacheManager';

// Live pop-up alert for new website bookings (Socket.IO)
import BookingNotifications from './pages/Website/BookingNotifications';

// Pages are loaded on demand. Bundling all of them into the entry chunk made it
// ~3 MB, which every user had to download in full before the LOGIN screen could
// render — on a weak connection that regularly timed out. Each page is now its
// own chunk, fetched when its route is first opened.
// Shown while a page chunk downloads.
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

// Debug Components
// Removed debug components for production cleanup

// Main Layout Component
const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isMobile = useMediaQuery('(max-width: 767px)'); // Tailwind md breakpoint

  const toggleSidebar = React.useCallback((value) => {
    setSidebarOpen((prev) => (typeof value === 'boolean' ? value : !prev));
  }, []);

  // Clone children and inject sidebarOpen prop.
  // Memoised: cloning produces new element identities, so without this every
  // MainLayout render (each sidebar toggle, each viewport-breakpoint check)
  // handed the routed page a brand-new element tree and forced it to re-render.
  const childrenWithSidebar = React.useMemo(
    () => React.Children.map(children, child =>
      React.isValidElement(child)
        ? React.cloneElement(child, { sidebarOpen })
        : child,
    ),
    [children, sidebarOpen],
  );

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row'
    }}>
      {/* Sidebar: only one instance, responsive */}
      {!isMobile && (
        <div
          style={{
            display: isMobile ? 'none' : 'block',
            // Same duration/easing as the drawer's transform so the reserved
            // width and the sliding panel move in lockstep (desync reads as
            // flicker along the glass edge).
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            // No background here — it was painting a rectangular column behind
            // the floating glass sidebar. This div only reserves layout width.
            background: 'transparent',
            height: '100vh',
            boxSizing: 'border-box',
            width: sidebarOpen ? 320 : 0
          }}
        >
          <Sidebar open={sidebarOpen} toggleSidebar={toggleSidebar} />
        </div>
      )}
      {isMobile && (
        <Sidebar open={sidebarOpen} toggleSidebar={toggleSidebar} mobile />
      )}
      {/* Main Content */}
      <div style={{
        flex: 1,
        minWidth: 0,
        width: '100%',
        overflowX: 'hidden',
        padding: isMobile ? '8px' : '24px',
        boxSizing: 'border-box'
      }}>
        {childrenWithSidebar}
      </div>
    </div>
  );
};

// App Component
const App = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <SettingsProvider>
            <AppThemeProvider>
              <AutoCacheManager>
                <PermissionProvider>
                  <HousekeepingProvider>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                  
                    {/* Protected routes are generated from the single route
                        table in config/routes.js, which also drives the sidebar
                        and the landing-page choice. Add a page there, not here. */}
                    {ROUTES.map(({ path, permissions, Component, props }) => (
                      <Route
                        key={path}
                        path={path}
                        element={
                          <ProtectedRoute requiredPermissions={permissions}>
                            <MainLayout>
                              <PageLayout>
                                <Component {...(props || {})} />
                              </PageLayout>
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                    ))}

                    {/* Default route - always redirect to login */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    {/* Catch all route - redirect to login */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                  </Suspense>

                  {/* Auth Validator - monitors token validity */}
                  <AuthValidator />
                  
                  {/* Booking Notifications Component - rendered globally */}
                  <BookingNotifications />
                  
                </HousekeepingProvider>
                </PermissionProvider>
              </AutoCacheManager>
            </AppThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </LocalizationProvider>
    </Router>
  );
};

export default App;
