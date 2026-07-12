import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { CssBaseline } from '@mui/material';
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
import PageLayout from './components/layout/PageLayout';

// Auth Components
import ProtectedRoute from './pages/Auth/ProtectedRoute';
import Login from './pages/Auth/Login';


// Main Dashboard Components
import Dashboard from './pages/reports/Dashboard';

// Auth Validator Component
import AuthValidator from './components/common/AuthValidator';
import AutoCacheManager from './components/common/AutoCacheManager';
import Bookings from './pages/operations/Bookings';
import Reservations from './pages/management/Reservations';
import Rooms from './pages/management/Rooms';
import Guests from './pages/management/Guests';
import Accounting from './pages/management/Accounting';
import Staff from './pages/management/Staff';
import Housekeepings from './pages/operations/Housekeepings';
import Restaurant from './pages/operations/Restaurant';
import BanquetHallBooking from './pages/management/BanquetHallBooking';
import POS from './pages/operations/POS';
import SettingsOptimized from './components/settings';
import ChannelManager from './pages/management/ChannelManager';
import AdminPanel from './components/AdminPanel';

// Staff Management Components
import WorkforceManagement from './components/WorkforceManagement';

// Live pop-up alert for new website bookings (Socket.IO)
import BookingNotifications from './pages/Website/BookingNotifications';

// Debug Components
// Removed debug components for production cleanup

// Main Layout Component
const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isMobile = useMediaQuery('(max-width: 767px)'); // Tailwind md breakpoint

  const toggleSidebar = (value) => {
    setSidebarOpen(typeof value === 'boolean' ? value : !sidebarOpen);
  };

  // Clone children and inject sidebarOpen prop
  const childrenWithSidebar = React.Children.map(children, child =>
    React.isValidElement(child)
      ? React.cloneElement(child, { sidebarOpen })
      : child,
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
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                  
                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute requiredPermissions={['view_dashboard']}>
                        <MainLayout>
                          <PageLayout>
                            <Dashboard />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings" element={
                      <ProtectedRoute requiredPermissions={['manage_bookings']}>
                        <MainLayout>
                          <PageLayout>
                            <Bookings view="active" />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/checked-out" element={
                      <ProtectedRoute requiredPermissions={['manage_bookings']}>
                        <MainLayout>
                          <PageLayout>
                            <Bookings view="checkedout" />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/reservations" element={
                      <ProtectedRoute requiredPermissions={['manage_reservations']}>
                        <MainLayout>
                          <PageLayout>
                            <Reservations />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/rooms" element={
                      <ProtectedRoute requiredPermissions={['manage_rooms']}>
                        <MainLayout>
                          <PageLayout>
                            <Rooms />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/guests" element={
                      <ProtectedRoute requiredPermissions={['manage_guests']}>
                        <MainLayout>
                          <PageLayout>
                            <Guests />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/accounting" element={
                      <ProtectedRoute requiredPermissions={['manage_accounting']}>
                        <MainLayout>
                          <PageLayout>
                            <Accounting />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staffs" element={
                      <ProtectedRoute requiredPermissions={['manage_staff']}>
                        <MainLayout>
                          <PageLayout>
                            <Staff />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    {/* Removed staff-attendance and payroll routes */}
                    <Route path="/housekeeping" element={
                      <ProtectedRoute requiredPermissions={['manage_housekeeping']}>
                        <MainLayout>
                          <PageLayout>
                            <Housekeepings />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/restaurant" element={
                      <ProtectedRoute requiredPermissions={['manage_restaurant']}>
                        <MainLayout>
                          <PageLayout>
                            <Restaurant />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/banquet-hall" element={
                      <ProtectedRoute requiredPermissions={['manage_events']}>
                        <MainLayout>
                          <PageLayout>
                            <BanquetHallBooking />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/pos" element={
                      <ProtectedRoute requiredPermissions={['manage_pos']}>
                        <MainLayout>
                          <PageLayout>
                            <POS />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute requiredPermissions={['manage_settings']}>
                        <MainLayout>
                          <PageLayout>
                            <SettingsOptimized />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/channels" element={
                      <ProtectedRoute requiredPermissions={['manage_channels']}>
                        <MainLayout>
                          <PageLayout>
                            <ChannelManager />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                      <ProtectedRoute requiredPermissions={['admin_access']}>
                        <MainLayout>
                          <PageLayout>
                            <AdminPanel />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    {/* Combined Staff & Payroll workspace (one sidebar tab) */}
                    <Route path="/workforce" element={
                      <ProtectedRoute requiredPermissions={['manage_attendance']}>
                        <MainLayout>
                          <PageLayout>
                            <WorkforceManagement defaultTab="attendance" />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    {/* Backward-compatible deep links open the right tab */}
                    <Route path="/staff-attendance" element={
                      <ProtectedRoute requiredPermissions={['manage_attendance']}>
                        <MainLayout>
                          <PageLayout>
                            <WorkforceManagement defaultTab="attendance" />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/payroll" element={
                      <ProtectedRoute requiredPermissions={['manage_payroll']}>
                        <MainLayout>
                          <PageLayout>
                            <WorkforceManagement defaultTab="payroll" />
                          </PageLayout>
                        </MainLayout>
                      </ProtectedRoute>
                    } />

                    {/* Default route - always redirect to login */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    {/* Catch all route - redirect to login */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                
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
