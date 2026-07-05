import React, { useState, useEffect, useCallback } from 'react';
import { FormControlLabel, Switch, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link, useLocation } from 'react-router-dom';
import {
  Dashboard,
  Hotel,
  Person,
  BookOnline,
  CleaningServices,
} from '@mui/icons-material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { Drawer, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LogoutButton from '../../pages/Auth/LogoutButton';
import ChangePasswordButton from '../ChangePasswordButton';
import { useSettings } from '../../contexts/SettingsContext';
import { usePermissions } from '../../contexts/PermissionContext';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { useAuth } from '../../contexts/AuthContext';

// Link with motion props (whileHover / whileTap) for the animated sub-tabs.
const MotionLink = motion.create(Link);

// Up-to-3-letter initials from the hotel name, used when no logo is uploaded.
const hotelInitials = (name) =>
  (name || 'Hotel')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'H';

// Shared style for the initials placeholder that fills the logo frame.
const initialsBoxStyle = (fontSize) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.92), rgba(var(--app-primary-rgb),0.6))',
  color: '#fff',
  fontWeight: 800,
  fontSize,
  letterSpacing: '0.5px',
});

// Accordion animation for the collapsible sub-nav. Height and opacity are
// timed separately (so content fades in just after the panel has room) and the
// sub-tabs stagger in/out for a smooth reveal.
const subNavVariants = {
  open: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.34, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.28, ease: 'easeOut', delay: 0.05 },
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.28, ease: [0.4, 0, 0.2, 1], delay: 0.04 },
      opacity: { duration: 0.16, ease: 'easeIn' },
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

const subItemVariants = {
  open: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  collapsed: { opacity: 0, x: -10, transition: { duration: 0.18, ease: 'easeIn' } },
};

const Sidebar = ({ open: propOpen, toggleSidebar: propToggleSidebar, mobile }) => {
  const { settings } = useSettings();
  const { hasPermission, isAdmin } = usePermissions();
  const { logout } = useAuth();
  const isDarkMode = settings?.theme?.darkMode;

  // If a (possibly stale-cached) logo URL fails to load, fall back to the
  // initials monogram instead of a broken image. Reset whenever the logo
  // changes so a fixed/updated logo gets a fresh chance to render.
  const logoSrc = settings?.hotelProfile?.logo || '';
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => { setLogoBroken(false); }, [logoSrc]);
  const showLogo = !!logoSrc && !logoBroken;
  
  // Handle the case where toggleSidebar is not a function
  const [internalOpen, setInternalOpen] = useState(propOpen || false);
  const [autoHide, setAutoHide] = useState(true);
  // Tracks which parent menus (with sub-items) the user has expanded/collapsed.
  // Undefined for a path → fall back to "open when that route is active".
  const [openMenus, setOpenMenus] = useState({});
  const location = useLocation();
  
  // Use internal state if prop toggle function is not provided
  const isOpen = typeof propToggleSidebar === 'function' ? propOpen : internalOpen;
  
  // Create a safe toggle function wrapped in useCallback
  const toggleSidebar = useCallback((value) => {
    if (typeof propToggleSidebar === 'function') {
      propToggleSidebar(value);
    } else {
      setInternalOpen(typeof value === 'boolean' ? value : !internalOpen);
    }
  }, [propToggleSidebar, internalOpen]);
  
  // Auto-hide functionality
  useEffect(() => {
    let timeoutId;
    
    const handleMouseLeave = () => {
      if (autoHide && isOpen) {
        timeoutId = setTimeout(() => {
          toggleSidebar(false);
        }, 2000); // Hide after 2 seconds of mouse leaving
      }
    };
    
    const handleMouseEnter = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    
    // Get the drawer paper element after component mounts
    const drawerPaper = document.querySelector('.MuiDrawer-paper');
    if (drawerPaper) {
      drawerPaper.addEventListener('mouseleave', handleMouseLeave);
      drawerPaper.addEventListener('mouseenter', handleMouseEnter);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (drawerPaper) {
        drawerPaper.removeEventListener('mouseleave', handleMouseLeave);
        drawerPaper.removeEventListener('mouseenter', handleMouseEnter);
      }
    };
  }, [autoHide, isOpen, toggleSidebar]);

  const menuItems = [
    { title: 'Dashboard', path: '/dashboard', icon: <Dashboard />, color: 'from-blue-400 to-blue-600', permission: 'view_dashboard' },
    { title: 'Bookings', path: '/bookings', icon: <BookOnline />, color: 'from-green-400 to-green-600', permission: 'manage_bookings',
      subItems: [
        { title: 'Active Bookings', path: '/bookings' },
        { title: 'Checked Out', path: '/bookings/checked-out' },
      ],
    },
    { title: 'Reservations', path: '/reservations', icon: <CalendarMonthIcon />, color: 'from-blue-400 to-blue-600', permission: 'manage_reservations' },
    { title: 'Rooms', path: '/rooms', icon: <Hotel />, color: 'from-purple-400 to-purple-600', permission: 'manage_rooms' },
    { title: 'Guests', path: '/guests', icon: <Person />, color: 'from-yellow-400 to-yellow-600', permission: 'manage_guests' },
    { title: 'Accounting', path: '/accounting', icon: <AccountBalanceWalletIcon />, color: 'from-emerald-400 to-emerald-600', permission: 'manage_accounting' },
    { title: 'Staff & Payroll', path: '/workforce', icon: <AccessTimeIcon />, color: 'from-cyan-400 to-cyan-600', permission: 'manage_attendance' },
    { title: 'Housekeeping', path: '/housekeeping', icon: <CleaningServices />, color: 'from-pink-400 to-pink-600', permission: 'manage_housekeeping' },
    { title: 'Restaurant', path: '/restaurant', icon: <RestaurantIcon />, color: 'from-red-400 to-red-600', permission: 'manage_restaurant' },
    { title: 'POS', path: '/pos', icon: <PointOfSaleIcon />, color: 'from-green-400 to-green-600', permission: 'manage_pos' },
    { title: 'Banquet Hall Booking', path: '/banquet-hall', icon: <CelebrationIcon />, color: 'from-indigo-400 to-indigo-600', permission: 'manage_events' },
    { title: 'Channel Manager', path: '/channels', icon: <CloudSyncIcon />, color: 'from-teal-400 to-teal-600', permission: 'manage_channels' },
  ];

  const isActive = (path) => {
    // For dashboard path
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    
    // Special handling for bookings to match '/bookings' and '/booking/*' routes
    if (path === '/bookings') {
      return location.pathname.startsWith('/booking') || location.pathname === '/bookings';
    }
    
    // For other paths, check exact match or if it's a sub-route
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Whether a parent menu's sub-nav is expanded. Once the user toggles it we
  // honour that choice; otherwise it auto-opens while the route is active.
  const isMenuOpen = (item) =>
    openMenus[item.path] !== undefined ? openMenus[item.path] : isActive(item.path);

  const toggleMenu = (item) => {
    setOpenMenus((prev) => ({ ...prev, [item.path]: !isMenuOpen(item) }));
  };

  // Clicking a parent row navigates and makes sure its sub-nav is open.
  const handleParentClick = (item) => {
    if (item.subItems) setOpenMenus((prev) => ({ ...prev, [item.path]: true }));
    toggleSidebar(false);
  };

  // Rotating chevron toggle placed at the end of a parent row. Stops the click
  // from following the link / closing the drawer so it only expands/collapses.
  const renderChevron = (item) => {
    if (!item.subItems) return null;
    return (
      <span
        role="button"
        tabIndex={-1}
        aria-label={`Toggle ${item.title} menu`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(item); }}
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px',
          borderRadius: '8px',
        }}
      >
        <ExpandMoreIcon
          style={{
            fontSize: 20,
            transform: isMenuOpen(item) ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </span>
    );
  };

  // Nested sub-navigation (e.g. Bookings → Active Bookings / Checked Out),
  // animated open/closed with framer-motion.
  const renderSubNav = (item) => {
    if (!item.subItems) return null;
    return (
      <AnimatePresence initial={false}>
        {isMenuOpen(item) && (
          <motion.div
            key="subnav"
            variants={subNavVariants}
            initial="collapsed"
            animate="open"
            exit="collapsed"
            style={{ overflow: 'hidden' }}
          >
            <ul style={{
              listStyle: 'none',
              margin: '4px 0 2px 16px',
              padding: '4px 0 4px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              borderLeft: isDarkMode
                ? '1.5px solid rgba(148,163,184,0.18)'
                : '1.5px solid rgba(15,23,42,0.08)',
            }}>
              {item.subItems.map((sub) => {
                const active = location.pathname === sub.path;
                return (
                  <motion.li key={sub.path} variants={subItemVariants}>
                    <MotionLink
                      to={sub.path}
                      onClick={() => toggleSidebar(false)}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontSize: '13.5px',
                        fontWeight: active ? 700 : 600,
                        color: active ? '#ffffff' : (isDarkMode ? '#e2e8f0' : '#334155'),
                        background: active
                          ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.95) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                          : (isDarkMode ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.6)'),
                        border: active
                          ? '1px solid rgba(var(--app-primary-rgb),0.5)'
                          : (isDarkMode ? '1px solid rgba(148,163,184,0.18)' : '1px solid rgba(255,255,255,0.7)'),
                        boxShadow: active
                          ? '0 8px 20px -8px rgba(var(--app-primary-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.25)'
                          : (isDarkMode
                            ? '0 4px 10px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
                            : '0 4px 10px -4px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.6)'),
                        backdropFilter: 'var(--app-blur)',
                        WebkitBackdropFilter: 'var(--app-blur)',
                        transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
                      }}
                    >
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: active ? '#ffffff' : 'var(--app-primary)',
                        boxShadow: active
                          ? '0 0 0 4px rgba(255,255,255,0.25)'
                          : '0 0 0 4px rgba(var(--app-primary-rgb),0.15)',
                      }} />
                      <span>{sub.title}</span>
                    </MotionLink>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Permission-based menu filtering
  const getAllowedMenuItems = () => {
    return menuItems.filter(item => {
      // Admin-only items (like Admin Panel) are only visible to admins
      if (item.adminOnly) {
        return isAdmin();
      }
      
      // Admin can see everything else
      if (isAdmin()) {
        return true;
      }
      
      // Check specific permission for the menu item
      return hasPermission(item.permission);
    });
  };
  const allowedMenuItems = getAllowedMenuItems();

  // Settings access - only for admin or users with settings permission
  const showSettings = isAdmin() || hasPermission('manage_settings');

  // Hamburger for mobile
  if (mobile) {
    return (
      <>
        <IconButton
          onClick={() => toggleSidebar(!isOpen)}
          sx={{
            position: 'fixed',
            left: '20px',
            top: '12px',
            zIndex: 1400,
            background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
            backdropFilter: 'var(--app-blur-strong)',
            WebkitBackdropFilter: 'var(--app-blur-strong)',
            border: '1.5px solid rgba(255,255,255,0.18)',
            color: isDarkMode ? '#f3f4f6' : '#23272f',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            width: '40px', height: '40px',
            // Force the round clip: without an explicit radius + overflow,
            // Chrome renders the backdrop-filter to the square border-box and
            // leaks a square halo past the circle's corners.
            borderRadius: '50%',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'transparent',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            },
          }}
        >
          {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
        <Drawer
          anchor="left"
          open={isOpen}
          onClose={() => toggleSidebar(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
              boxSizing: 'border-box',
              // Match the desktop drawer: honour the Glass effect fill slider so
              // "Solid" makes the sidebar opaque instead of staying see-through.
              background: isDarkMode
                ? 'rgba(20, 24, 32, calc(var(--app-surface-alpha, 0.05) * 3))'
                : 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
              backdropFilter: 'var(--app-blur-strong)',
              WebkitBackdropFilter: 'var(--app-blur-strong)',
              border: isDarkMode 
                ? '1px solid rgba(148,163,184,0.1)' 
                : '1px solid rgba(203,213,225,0.2)',
              padding: '1.5rem 1rem',
              position: 'fixed',
              overflowX: 'hidden',
              boxShadow: isDarkMode 
                ? '0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.1)' 
                : '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)',
              borderTopRightRadius: '20px',
              borderBottomRightRadius: '20px',
              margin: '12px 0',
              height: 'calc(100% - 24px)',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            },
          }}
        >
          {/* Hotel Profile Card */}
          {(() => {
            const hotelName = settings?.hotelProfile?.hotelName || settings?.hotelName || 'Hotel Sandhya Grand';
            const gstin = settings?.tax?.gstNumber || settings?.hotelProfile?.businessRegistration?.gstNumber;
            const starRating = settings?.starRating || settings?.hotelProfile?.classification?.starRating;
            const city = settings?.address?.city || settings?.hotelProfile?.address?.city;
            return (
              <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 16px 18px',
                marginTop: 0,
                marginBottom: '16px',
                borderRadius: '20px',
                background: isDarkMode
                  ? 'linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.5) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.3) 100%)',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.7)',
                boxShadow: isDarkMode
                  ? '0 12px 32px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 10px 28px -16px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)',
                overflow: 'hidden',
              }}>
                {/* Decorative top tint */}
                <div style={{
                  position: 'absolute',
                  inset: '0 0 auto 0',
                  height: '60px',
                  background: 'linear-gradient(180deg, rgba(var(--app-primary-rgb), 0.18), transparent)',
                  pointerEvents: 'none',
                }} />

                {/* Logo with gradient frame */}
                <div style={{
                  position: 'relative',
                  width: '78px',
                  height: '78px',
                  marginBottom: '14px',
                  borderRadius: '20px',
                  padding: '3px',
                  background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb), 0.55), rgba(var(--app-primary-rgb), 0.12))',
                  boxShadow: '0 10px 24px -10px rgba(var(--app-primary-rgb), 0.45)',
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {showLogo ? (
                      <img
                        src={logoSrc}
                        alt={hotelName}
                        onError={() => setLogoBroken(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={initialsBoxStyle('26px')}>{hotelInitials(hotelName)}</div>
                    )}
                  </div>
                </div>

                {/* Hotel name */}
                <h1 style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  textAlign: 'center',
                  color: isDarkMode ? '#f8fafc' : '#1e293b',
                  margin: '0 0 10px',
                  lineHeight: 1.3,
                  position: 'relative',
                }}>
                  {hotelName}
                </h1>

                {/* GSTIN chip */}
                {gstin && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.06)',
                    border: '1px solid',
                    borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)',
                    marginBottom: '10px',
                  }}>
                    <span style={{
                      fontSize: '8.5px',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      color: isDarkMode ? 'rgba(226,232,240,0.5)' : 'rgba(71,85,105,0.7)',
                    }}>
                      GST
                    </span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: isDarkMode ? '#e2e8f0' : '#1e293b',
                      letterSpacing: '0.02em',
                    }}>
                      {gstin}
                    </span>
                  </div>
                )}

                {/* Badge row — star rating + location */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  width: '100%',
                }}>
                  {starRating && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '3px 9px 3px 6px',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.22), rgba(251,191,36,0.08))',
                      border: '1px solid rgba(251,191,36,0.4)',
                      color: isDarkMode ? '#fbbf24' : '#b45309',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}>
                      {Array.from({ length: Math.min(5, Number(starRating) || 0) }).map((_, i) => (
                        <StarRoundedIcon key={i} style={{ fontSize: 11, color: '#f59e0b' }} />
                      ))}
                      {starRating}-Star
                    </span>
                  )}
                  {city && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '3px 10px 3px 6px',
                      borderRadius: '999px',
                      background: 'rgba(var(--app-primary-rgb), 0.14)',
                      border: '1px solid rgba(var(--app-primary-rgb), 0.3)',
                      color: 'var(--app-primary)',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}>
                      <LocationOnIcon style={{ fontSize: 12 }} />
                      {city}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
          {/* Navigation Menu */}
          <nav style={{ flex: 1 }}>
            <ul style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {allowedMenuItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px 20px',
                      borderRadius: '18px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      fontSize: '15px',
                      fontWeight: '600',
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: isActive(item.path) 
                        ? isDarkMode
                          ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.9) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                          : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : 'var(--app-glass-sheen), var(--app-glass-fill)',
                      color: isActive(item.path) 
                        ? '#ffffff' 
                        : isDarkMode ? '#e2e8f0' : '#475569',
                      boxShadow: isActive(item.path) 
                        ? isDarkMode
                          ? '0 12px 28px -6px rgba(var(--app-primary-rgb),0.4), 0 6px 16px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                          : '0 12px 28px -6px rgba(var(--app-primary-rgb),0.35), 0 6px 16px -3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)'
                        : isDarkMode
                          ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                          : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
                      border: isActive(item.path)
                        ? isDarkMode
                          ? '1px solid rgba(var(--app-primary-rgb),0.3)'
                          : '1px solid rgba(var(--app-primary-rgb),0.2)'
                        : isDarkMode
                          ? '1px solid rgba(148,163,184,0.15)'
                          : '1px solid rgba(203,213,225,0.25)',
                      backdropFilter: 'var(--app-blur)',
                      WebkitBackdropFilter: 'var(--app-blur)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = isActive(item.path) 
                        ? isDarkMode
                          ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                          : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : isDarkMode
                          ? 'rgba(var(--app-primary-rgb),0.15)'
                          : 'rgba(var(--app-primary-rgb),0.08)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = isActive(item.path)
                        ? isDarkMode
                          ? '0 16px 32px -6px rgba(var(--app-primary-rgb),0.5), 0 8px 20px -3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)'
                          : '0 16px 32px -6px rgba(var(--app-primary-rgb),0.4), 0 8px 20px -3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)'
                        : isDarkMode
                          ? '0 10px 24px -4px rgba(0,0,0,0.25), 0 5px 12px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))'
                          : '0 10px 24px -4px rgba(0,0,0,0.15), 0 5px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = isActive(item.path) 
                        ? isDarkMode
                          ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.9) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                          : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : isDarkMode
                          ? 'rgba(30, 41, 59, 0.3)'
                          : 'rgba(255, 255, 255, 0.4)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = isActive(item.path) 
                        ? isDarkMode
                          ? '0 12px 28px -6px rgba(var(--app-primary-rgb),0.4), 0 6px 16px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                          : '0 12px 28px -6px rgba(var(--app-primary-rgb),0.35), 0 6px 16px -3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)'
                        : isDarkMode
                          ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                          : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)';
                    }}
                    onClick={() => handleParentClick(item)}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    {renderChevron(item)}
                  </Link>
                  {renderSubNav(item)}
                </li>
              ))}
            </ul>
          </nav>
          <div style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <ChangePasswordButton variant="icon" />
            <LogoutButton />
          </div>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <IconButton
        onClick={() => toggleSidebar(!isOpen)}
        sx={{
          position: 'fixed',
          left: isOpen ? '300px' : '20px',  
          top: '12px',                     
          zIndex: 1300,
          background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          color: isDarkMode ? '#f3f4f6' : '#23272f',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          width: '40px', height: '40px',
          // Force the round clip: without an explicit radius + overflow,
          // Chrome renders the backdrop-filter to the square border-box and
          // leaks a square halo past the circle's corners.
          borderRadius: '50%',
          overflow: 'hidden',
          // Ride along with the drawer: same duration/curve, and only `left`
          // — animating `all` on a backdrop-filter button repaints its blur
          // every frame of the slide.
          transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
          '&:hover': {
            background: 'transparent',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          },
        }}
      >
        {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
      <Drawer
        variant="permanent"
        sx={{
          width: isOpen ? 340 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 340,
            boxSizing: 'border-box',
            transform: isOpen ? 'translateX(0)' : 'translateX(-340px)',
            // Transition transform only — `all` also animates backdrop-filter
            // and shadows, which repaint every frame. will-change keeps the
            // glass panel on its own compositor layer while it slides.
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
            // Respond to the Appearance → Glass effect fill slider so dragging it
            // to "Solid" makes the whole sidebar shell opaque, like every other
            // strong surface (stat cards, page panels). Fixed `transparent` here
            // left the panel see-through no matter the setting.
            background: isDarkMode
              ? 'rgba(20, 24, 32, calc(var(--app-surface-alpha, 0.05) * 3))'
              : 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
            backdropFilter: 'var(--app-blur-strong)',
            WebkitBackdropFilter: 'var(--app-blur-strong)',
            border: isDarkMode 
              ? '1px solid rgba(148,163,184,0.1)' 
              : '1px solid rgba(203,213,225,0.2)',
            padding: '1.5rem 1rem',
            position: 'fixed',
            overflowX: 'hidden',
            boxShadow: isDarkMode 
              ? '0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.1)' 
              : '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)',
            borderTopRightRadius: '20px',
            borderBottomRightRadius: '20px',
            margin: '12px 0',
            height: 'calc(100% - 24px)',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        }}
        slotProps={{
          paper: {
            sx: {
              fontFamily: settings?.theme?.fontFamily || '"Inter", system-ui, sans-serif',
              fontSize: settings?.theme?.fontSize,
              color: isDarkMode ? '#f8fafc' : '#1e293b',
              // No transition here — it would override the paper's 0.6s
              // transform transition above and double-animate the slide.
            },
          }
        }}
      >
        {/* Hotel Profile Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 12px 18px',
          marginTop: 0,
          marginBottom: '20px',
          background: isDarkMode 
            ? 'rgba(255, 255, 255, 0.02)' 
            : 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
          borderRadius: '20px',
          boxShadow: isDarkMode
            ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
            : '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
          border: isDarkMode 
            ? '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))' 
            : '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)'
        }}>
          
          {/* Hotel Logo */}
          <div style={{
            width: '44px',
            height: '44px',
            marginBottom: '8px',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: isDarkMode
              ? '0 8px 16px -4px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.1)'
              : '0 8px 16px -4px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            background: 'rgba(255,255,255,0.9)',
            border: isDarkMode 
              ? '2px solid rgba(148,163,184,0.1)'
              : '2px solid rgba(203,213,225,0.2)'
          }}>
            {showLogo ? (
              <img
                src={logoSrc}
                alt={settings?.hotelProfile?.hotelName || settings?.hotelName || 'Hotel Sandhya Grand Logo'}
                onError={() => setLogoBroken(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '10px'
                }}
              />
            ) : (
              <div style={initialsBoxStyle('16px')}>
                {hotelInitials(settings?.hotelProfile?.hotelName || settings?.hotelName)}
              </div>
            )}
          </div>

          {/* Hotel Name */}
          <h1 style={{
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            width: '100%',
            color: isDarkMode ? '#f8fafc' : '#1e293b',
            marginBottom: '4px',
            lineHeight: '1.2'
          }}>
            {settings?.hotelProfile?.hotelName || settings?.hotelName || 'Hotel Sandhya Grand'}
          </h1>
          
          {/* Business Information - GST, Star Rating, and Additional Info */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {/* GST Number - Primary Business Info */}
            {(settings?.tax?.gstNumber || settings?.hotelProfile?.businessRegistration?.gstNumber) && (
              <p style={{
                fontSize: '12px',
                fontWeight: '600',
                textAlign: 'center',
                color: isDarkMode ? '#e5e7eb' : '#374151'
              }}>
                GSTIN: {settings?.tax?.gstNumber || settings?.hotelProfile?.businessRegistration?.gstNumber}
              </p>
            )}
            
            {/* Star Rating or Hotel Type */}
            <p style={{
              fontSize: '10px',
              fontWeight: '500',
              textAlign: 'center',
              color: isDarkMode ? '#d1d5db' : '#4b5563'
            }}>
              {settings?.starRating ? `⭐ ${settings.starRating} Star Hotel` : 
                settings?.hotelProfile?.classification?.starRating ? `⭐ ${settings.hotelProfile.classification.starRating} Star Hotel` : 'Premium Hotel'}
            </p>
            
            {/* Additional Info — plain centered caption, no background */}
            {(settings?.address?.city || settings?.hotelProfile?.address?.city || settings?.contact?.phone || settings?.hotelProfile?.contactNumber) && (
              <p style={{
                fontSize: '9px',
                textAlign: 'center',
                color: isDarkMode ? '#94a3b8' : '#64748b',
                marginTop: '2px',
                marginBottom: 0,
              }}>
                {(settings?.address?.city || settings?.hotelProfile?.address?.city) && (settings?.contact?.phone || settings?.hotelProfile?.contactNumber)
                  ? `${settings?.address?.city || settings?.hotelProfile?.address?.city} • ${settings?.contact?.phone || settings?.hotelProfile?.contactNumber}`
                  : (settings?.address?.city || settings?.hotelProfile?.address?.city) || (settings?.contact?.phone || settings?.hotelProfile?.contactNumber) || ''}
              </p>
            )}
          </div>
        </div>


        {/* Navigation Menu */}
        <nav style={{ flex: 1 }}>
          <ul style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {allowedMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px 20px',
                    borderRadius: '18px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: '15px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                    background: isActive(item.path) 
                      ? isDarkMode
                        ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.9) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                      : isDarkMode
                        ? 'rgba(30, 41, 59, 0.3)'
                        : 'rgba(255, 255, 255, 0.4)',
                    color: isActive(item.path) 
                      ? '#ffffff' 
                      : isDarkMode ? '#e2e8f0' : '#475569',
                    boxShadow: isActive(item.path) 
                      ? isDarkMode
                        ? '0 12px 28px -6px rgba(var(--app-primary-rgb),0.4), 0 6px 16px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : '0 12px 28px -6px rgba(var(--app-primary-rgb),0.35), 0 6px 16px -3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)'
                      : isDarkMode
                        ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                        : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
                    border: isActive(item.path)
                      ? isDarkMode
                        ? '1px solid rgba(var(--app-primary-rgb),0.3)'
                        : '1px solid rgba(var(--app-primary-rgb),0.2)'
                      : isDarkMode
                        ? '1px solid rgba(148,163,184,0.15)'
                        : '1px solid rgba(203,213,225,0.25)',
                    backdropFilter: 'var(--app-blur)',
                    WebkitBackdropFilter: 'var(--app-blur)'
                  }}
                  onMouseEnter={(e) => {
                    const link = e.currentTarget;
                    const span = link.querySelector('span');
                    
                    link.style.background = isActive(item.path) 
                      ? isDarkMode
                        ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                      : isDarkMode
                        ? 'rgba(var(--app-primary-rgb),0.15)'
                        : 'rgba(var(--app-primary-rgb),0.08)';
                    link.style.transform = 'translateY(-2px)';
                    link.style.boxShadow = isActive(item.path)
                      ? isDarkMode
                        ? '0 16px 32px -6px rgba(var(--app-primary-rgb),0.5), 0 8px 20px -3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)'
                        : '0 16px 32px -6px rgba(var(--app-primary-rgb),0.4), 0 8px 20px -3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)'
                      : isDarkMode
                        ? '0 10px 24px -4px rgba(0,0,0,0.25), 0 5px 12px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))'
                        : '0 10px 24px -4px rgba(0,0,0,0.15), 0 5px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)';
                    
                    if (span) {
                      span.style.background = 'none';
                      span.style.padding = '0';
                      span.style.border = 'none';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const link = e.currentTarget;
                    const span = link.querySelector('span');
                    
                    link.style.background = isActive(item.path) 
                      ? isDarkMode
                        ? 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.9) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                        : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),1) 0%, rgba(var(--app-primary-rgb),1) 100%)'
                      : isDarkMode
                        ? 'rgba(30, 41, 59, 0.3)'
                        : 'rgba(255, 255, 255, 0.4)';
                    link.style.transform = 'translateY(0)';
                    link.style.boxShadow = isActive(item.path) 
                      ? isDarkMode
                        ? '0 12px 28px -6px rgba(var(--app-primary-rgb),0.4), 0 6px 16px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : '0 12px 28px -6px rgba(var(--app-primary-rgb),0.35), 0 6px 16px -3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)'
                      : isDarkMode
                        ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                        : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)';
                    
                    if (span) {
                      span.style.background = 'none';
                      span.style.padding = '0';
                      span.style.border = 'none';
                    }
                  }}
                  onClick={() => handleParentClick(item)}
                >
                    {item.icon}
                    <span style={{ background: 'none', padding: 0, border: 'none' }}>{item.title}</span>
                    {renderChevron(item)}
                </Link>
                {renderSubNav(item)}
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div style={{
          borderTop: isDarkMode 
            ? '1px solid rgba(148,163,184,0.15)' 
            : '1px solid rgba(203,213,225,0.2)',
          paddingTop: '20px',
          marginTop: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {showSettings && (
            <Link
              to="/settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 20px',
                borderRadius: '18px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: '600',
                width: '100%',
                boxSizing: 'border-box',
                color: isDarkMode ? '#e2e8f0' : '#475569',
                transform: 'translateY(0)',
                background: isDarkMode
                  ? 'rgba(30, 41, 59, 0.3)'
                  : 'rgba(255, 255, 255, 0.4)',
                boxShadow: isDarkMode
                  ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                  : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
                border: isDarkMode
                  ? '1px solid rgba(148,163,184,0.15)'
                  : '1px solid rgba(203,213,225,0.25)',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)'
              }}
              onMouseEnter={(e) => {
                const link = e.currentTarget;
                const span = link.querySelector('span');
                
                link.style.background = isDarkMode 
                  ? 'rgba(var(--app-primary-rgb),0.15)' 
                  : 'rgba(var(--app-primary-rgb),0.08)';
                link.style.transform = 'translateY(-2px)';
                link.style.boxShadow = isDarkMode
                  ? '0 10px 24px -4px rgba(0,0,0,0.25), 0 5px 12px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))'
                  : '0 10px 24px -4px rgba(0,0,0,0.15), 0 5px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)';
                
                if (span) {
                  span.style.background = 'none';
                  span.style.padding = '0';
                  span.style.border = 'none';
                }
              }}
              onMouseLeave={(e) => {
                const link = e.currentTarget;
                const span = link.querySelector('span');
                
                link.style.background = isDarkMode
                  ? 'rgba(30, 41, 59, 0.3)'
                  : 'rgba(255, 255, 255, 0.4)';
                link.style.transform = 'translateY(0)';
                link.style.boxShadow = isDarkMode
                  ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                  : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)';
                
                if (span) {
                  span.style.background = 'none';
                  span.style.padding = '0';
                  span.style.border = 'none';
                }
              }}
            >
              <SettingsIcon />
              <span style={{ background: 'none', padding: 0, border: 'none' }}>Settings</span>
            </Link>
          )}
          <ChangePasswordButton variant="row" isDarkMode={isDarkMode} />
          <div
            role="button"
            tabIndex={0}
            onClick={logout}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && logout()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 20px',
              borderRadius: '18px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '15px',
              fontWeight: '600',
              background: isDarkMode
                ? 'rgba(127, 29, 29, 0.3)'
                : 'rgba(254, 226, 226, 0.4)',
              boxShadow: isDarkMode
                ? '0 6px 16px -4px rgba(248,113,113,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                : '0 6px 16px -4px rgba(239,68,68,0.15), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
              border: isDarkMode
                ? '1px solid rgba(248,113,113,0.2)'
                : '1px solid rgba(239,68,68,0.2)',
              backdropFilter: 'var(--app-blur)',
              WebkitBackdropFilter: 'var(--app-blur)',
              cursor: 'pointer',
              color: isDarkMode ? '#fca5a5' : '#dc2626',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              const div = e.currentTarget;
              const span = div.querySelector('span');
              
              div.style.background = isDarkMode 
                ? 'rgba(248,113,113,0.15)' 
                : 'rgba(239,68,68,0.08)';
              div.style.color = isDarkMode ? '#fecaca' : '#b91c1c';
              div.style.transform = 'translateY(-2px)';
              div.style.boxShadow = isDarkMode
                ? '0 10px 24px -4px rgba(248,113,113,0.25), 0 5px 12px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))'
                : '0 10px 24px -4px rgba(239,68,68,0.2), 0 5px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)';
              
              if (span) {
                span.style.background = 'none';
                span.style.padding = '0';
                span.style.border = 'none';
              }
            }}
            onMouseLeave={(e) => {
              const div = e.currentTarget;
              const span = div.querySelector('span');
              
              div.style.background = isDarkMode
                ? 'rgba(127, 29, 29, 0.3)'
                : 'rgba(254, 226, 226, 0.4)';
              div.style.color = isDarkMode ? '#fca5a5' : '#dc2626';
              div.style.transform = 'translateY(0)';
              div.style.boxShadow = isDarkMode
                ? '0 6px 16px -4px rgba(248,113,113,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
                : '0 6px 16px -4px rgba(239,68,68,0.15), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)';
              
              if (span) {
                span.style.background = 'none';
                span.style.padding = '0';
                span.style.border = 'none';
              }
            }}
          >
            <LogoutButton variant="icon" color="error" />
            <span style={{ background: 'none', padding: 0, border: 'none' }}>Logout</span>
          </div>
          
          {/* Auto-hide toggle */}
          {isOpen && (
            <div style={{ padding: '8px 16px', marginTop: '8px' }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={autoHide} 
                    onChange={(e) => setAutoHide(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)', 
                    }}
                  >
                    Auto-hide sidebar
                  </Typography>
                }
              />
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
};

export default Sidebar;