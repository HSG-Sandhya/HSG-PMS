import React, { useState, useEffect, useMemo } from 'react';
import { Grid, Paper, Typography, Box, Card, CircularProgress, Chip, IconButton, Tooltip, Button, Stack } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { HotelOutlined, BookOnlineOutlined, EventAvailableOutlined, CurrencyRupeeOutlined, DashboardOutlined, TrendingUpOutlined, ArrowUpwardOutlined, PauseCircleOutlined, Celebration as CelebrationIcon, Restaurant as RestaurantIcon, Business as _BusinessOutlined, AnalyticsOutlined, LogoutOutlined, ShieldOutlined, FingerprintOutlined, ContentCopyOutlined, MailOutlineOutlined } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../../api';
import { styled } from '@mui/material/styles';
import StatsCard from '../../components/ui/StatsCard';
import { useSettings } from '../../contexts/SettingsContext';
import { currencySym, liveBilling } from '../../utils/billing';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import { _PermissionSection, _AdminDashboardCard, _RoleBasedGreeting } from '../../components/permissions/PermissionComponents';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {
  ScrollProgressBar,
  AmbientBackdrop,
  Marquee,
  DrawnUnderline,
  CountUp,
  greetingFor,
  ChartDefs,
  ChartGlobalFx,
} from './dashboardMotion';
import WaterDropAvatar from './dashboard/WaterDropAvatar';
import { formatRevenueData, genderDistribution } from './dashboard/dataTransforms';

// Memoized StatsCard for performance
const MemoizedStatsCard = React.memo(StatsCard);

const Dashboard = () => {
  const settingsContext = useSettings();
  const { user, logout } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const handleUserChipClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleLogout = () => {
    handleMenuClose();
    logout();
  };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState({
    occupiedRooms: 0,
    totalRooms: 0,
    occupancyRate: 0,
    totalBookings: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    totalGuests: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    pendingBookings: 0,
    completedBookings: 0,
    todayBookings: 0,
    todayRevenue: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [bookingData, setBookingData] = useState([]);
  const [roomTypeData, setRoomTypeData] = useState([]);
  const [occupancyData, setOccupancyData] = useState({
    occupiedRooms: 0,
    availableRooms: 0,
    occupancyRate: 0,
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLiveData, setIsLiveData] = useState(true);
  const [guestList, setGuestList] = useState([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [banquetData, setBanquetData] = useState({
    total: 0,
    today: 0,
    month: 0,
    year: 0,
    byStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
    revenue: { total: 0, today: 0, month: 0 },
    eventTypes: [],
  });
  const [restaurantSalesData, setRestaurantSalesData] = useState({
    total: 0,
    today: 0,
    month: 0,
    year: 0,
    byType: [],
    monthlyChart: [],
  });
  const [restaurantExpensesData, setRestaurantExpensesData] = useState({
    total: 0,
    today: 0,
    month: 0,
    year: 0,
    categories: [],
    monthlyChart: [],
  });
  const [restaurantStatsData, setRestaurantStatsData] = useState({
    totalOrders: 0,
    todayOrders: 0,
    monthlyOrders: 0,
    byStatus: { pending: 0, inProgress: 0, completed: 0, cancelled: 0 },
    averageOrderValue: 0,
    byType: [],
  });

  const [occupancyHistoryData, setOccupancyHistoryData] = useState([]);

  // Processed data for better performance
  const processedRevenueData = useMemo(() => formatRevenueData(revenueData), [revenueData]);

  // Fetch guests when Guests tab is active
  useEffect(() => {
    if (activeTab === 'guests') {
      setGuestLoading(true);
      api.guests.getAll()
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          setGuestList(list);
        })
        .catch(() => setGuestList([]))
        .finally(() => setGuestLoading(false));
    }
  }, [activeTab]);

  // Gender distribution for chart
  const guestGenderData = React.useMemo(() => genderDistribution(guestList), [guestList]);

  useEffect(() => {
    let isMounted = true;
    let refreshInterval;
    
    // One retry only. The client-side 15s timeout fires while the server request
    // is still running (server timeout is 30s), so each retry adds a *concurrent*
    // duplicate load on the DB. On a burst-throttled Atlas tier that snowballs
    // (slow → timeout → retry → slower). With server-side caching in front, a
    // transient miss is cheap to retry once and pointless to retry more.
    const fetchWithTimeout = async (apiCall, retries = 1) => {
      let lastError;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await Promise.race([
            apiCall(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), 15000),
            ),
          ]);

          return response;
        } catch (error) {
          lastError = error;

          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }
        }
      }

      throw lastError;
    };
    
    const fetchDashboardData = async () => {
      if (!isMounted) {return;}
      
      setLoading(true);
      setError(null);
      
      try {
        // Check if api.dashboard exists
        if (!api.dashboard) {
          setError('Dashboard API not available');
          return;
        }

        // Fire every dashboard endpoint in one parallel batch. getSummary used
        // to be awaited on its own first, which serialized one extra round-trip
        // ahead of the rest for no reason — it has no dependency on the others.
        const [summarySettled, revenueRes, bookingsRes, roomTypesRes, occupancyRes, banquetRes, restaurantSalesRes, restaurantExpensesRes, restaurantStatsRes, todayRevenueRes, occupancyHistoryRes] = await Promise.allSettled([
          fetchWithTimeout(() => api.dashboard.getSummary()),
          fetchWithTimeout(() => api.dashboard.getMonthlyRevenue()),
          fetchWithTimeout(() => api.dashboard.getReservationsMonthly()),
          fetchWithTimeout(() => api.dashboard.getRoomTypes()),
          fetchWithTimeout(() => api.dashboard.getOccupancyRate()),
          fetchWithTimeout(() => api.dashboard.getBanquetBookings()),
          fetchWithTimeout(() => api.dashboard.getRestaurantSales()),
          fetchWithTimeout(() => api.dashboard.getRestaurantExpenses()),
          fetchWithTimeout(() => api.dashboard.getRestaurantStats()),
          fetchWithTimeout(() => api.dashboard.getTodayRevenue()),
          fetchWithTimeout(() => api.dashboard.getOccupancyHistory())
        ]);

        // Extract successful responses
        const getValueOrDefault = (result, defaultValue = null) => {
          return result.status === 'fulfilled' ? result.value : { data: defaultValue };
        };
        
        if (isMounted) {
          const summaryData = getValueOrDefault(summarySettled, null).data;
          const enhancedSummary = {
            ...summaryData,
            todayBookings: Number(summaryData?.todayBookings) || 0,
            todayRevenue: Number(getValueOrDefault(todayRevenueRes, { total: 0 }).data?.total || 0),
            totalRooms: Number(summaryData?.totalRooms) || 0,
            occupiedRooms: Number(summaryData?.occupiedRooms) || 0,
            totalBookings: Number(summaryData?.totalBookings) || 0,
            totalGuests: Number(summaryData?.totalGuests) || 0,
            totalRevenue: Number(summaryData?.totalRevenue) || 0,
            pendingPayments: Number(summaryData?.pendingPayments) || 0,
            todayCheckIns: Number(summaryData?.todayCheckIns) || 0,
            todayCheckOuts: Number(summaryData?.todayCheckOuts) || 0,
            pendingBookings: Number(summaryData?.pendingBookings) || 0,
            confirmedBookings: Number(summaryData?.confirmedBookings) || 0,
            completedBookings: Number(summaryData?.completedBookings) || 0,
            occupancyRate: Number(summaryData?.occupancyRate) || 0,
          };
          
          setSummary(enhancedSummary);
          setRevenueData(getValueOrDefault(revenueRes, []).data || []);
          setBookingData(getValueOrDefault(bookingsRes, []).data || []);
          setRoomTypeData(getValueOrDefault(roomTypesRes, []).data || []);
          setOccupancyData(getValueOrDefault(occupancyRes, {}).data || {});
          setBanquetData(getValueOrDefault(banquetRes, {}).data || {});
          setRestaurantSalesData(getValueOrDefault(restaurantSalesRes, {}).data || {});
          setRestaurantExpensesData(getValueOrDefault(restaurantExpensesRes, {}).data || {});
          setRestaurantStatsData(getValueOrDefault(restaurantStatsRes, {}).data || {});
          setOccupancyHistoryData(getValueOrDefault(occupancyHistoryRes, []).data || []);
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message || 'Failed to load data');
        }
      } finally {
        if (isMounted) {setLoading(false);}
      }
    };

    fetchDashboardData();
    
    if (isLiveData) {
      refreshInterval = setInterval(() => {
        if (isMounted) {
          fetchDashboardData();
        }
      }, 30000);
    }
    
    return () => {
      isMounted = false;
      if (refreshInterval) {clearInterval(refreshInterval);}
    };
  }, [isLiveData]);

  if (!settingsContext) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh"
        }}>
        <CircularProgress size={60} thickness={4} color="primary" />
      </Box>
    );
  }
  
  const { _toggleDarkMode, getCurrentThemeMode } = settingsContext;
  const settings = settingsContext.settings;
  
  const darkMode = getCurrentThemeMode ? getCurrentThemeMode() === 'dark' : false;
  const cardStyle = settings?.theme?.cardStyle || 'rounded';
  const fontFamily = settings?.theme?.fontFamily;
  const fontSize = settings?.theme?.fontSize;

  // Color/style variables
  const glassBg = darkMode
    ? 'rgba(40, 40, 40, 0.85)'
    : 'rgba(255, 255, 255, 0.85)';
  const glassBorder = darkMode
    ? '1.5px solid rgba(80, 80, 80, 0.18)'
    : '1.5px solid rgba(220, 220, 220, 0.18)';
  const glassShadow = darkMode
    ? '0 8px 32px 0 rgba(0,0,0,0.25)'
    : '0 8px 32px 0 rgba(0,0,0,0.07)';
  const textColor = darkMode ? '#f3f4f6' : '#23272f';
  const subTextColor = darkMode ? '#bdbdbd' : '#888';

  // Today's Activity Card style
  const _activityCardBg = darkMode ? 'rgba(30,30,35,0.82)' : 'rgba(255,255,255,0.78)';
  const _activityCardBorder = darkMode ? '1.5px solid rgba(80,80,80,0.22)' : '1.5px solid rgba(220,220,220,0.16)';
  const _activityCardShadow = darkMode ? '0 8px 40px 0 rgba(0,0,0,0.38)' : '0 8px 40px 0 rgba(0,0,0,0.13)';
  const _activityIconColor = darkMode ? '#bdbdbd' : '#444';

  // Add ActivityCard styled component with all cardStyle options
  const ActivityCard = styled(Box)(({ _theme }) => {
    let style = {
      background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
      border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      borderRadius: '24px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: 160,
      padding: '24px 16px',
      boxSizing: 'border-box',
      backdropFilter: 'var(--app-blur)',
      WebkitBackdropFilter: 'var(--app-blur)',
      transition: 'box-shadow 0.22s, transform 0.18s, background 0.22s',
      cursor: 'pointer',
      '&:hover': {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 32px rgba(var(--app-primary-rgb), 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        transform: 'scale(1.045)',
        background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      },
    };
    if (cardStyle === 'glass') {
      style = {
        ...style,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        border: '1px solid rgba(var(--app-primary-rgb),0.08)',
        boxShadow: '0 4px 24px rgba(31,38,135,0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        backdropFilter: 'var(--app-blur)',
        borderRadius: '24px',
      };
    }
    return style;
  });

  // Move styled components here so they have access to the above variables
  const GlassCard = styled(Card)(({ _theme }) => {
    let style = {
      background: glassBg,
      backdropFilter: 'var(--app-blur-strong)',
      borderRadius: cardStyle === 'rounded' ? '32px' : cardStyle === 'square' ? '0px' : cardStyle === 'gradient' ? '32px' : '32px',
      border: glassBorder,
      boxShadow: cardStyle === 'shadow' ? (darkMode ? '0 8px 40px 0 rgba(0,0,0,0.38)' : '0 8px 40px 0 rgba(0,0,0,0.13)') : 'none',
      overflow: 'visible',
      position: 'relative',
      fontFamily,
      fontSize,
      transition: 'background 0.5s, box-shadow 0.5s, border 0.5s',
    };
    if (cardStyle === 'glass') {
      style = {
        ...style,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        border: '1.5px solid rgba(var(--app-primary-rgb),0.18)',
        boxShadow: '0 8px 32px 0 rgba(31,38,135,0.10)',
        backdropFilter: 'var(--app-blur-strong)',
        borderRadius: '8px',
      };
    }
    return style;
  });

  const GlassPaper = styled(Paper)(({ _theme }) => ({
    background: glassBg,
    backdropFilter: 'var(--app-blur-strong)',
    borderRadius: '32px',
    border: glassBorder,
    boxShadow: glassShadow,
    overflow: 'visible',
    fontFamily: 'Nunito, Quicksand, Rubik, Arial, sans-serif',
    transition: 'background 0.5s, box-shadow 0.5s, border 0.5s',
  }));

  const StatsChip = styled(Chip, {
    shouldForwardProp: (prop) => prop !== 'isPositive',
  })(({ _isPositive }) => ({
    borderRadius: '999px',
    fontWeight: 700,
    fontFamily: 'Nunito, Quicksand, Rubik, Arial, sans-serif',
    backgroundColor: darkMode ? 'rgba(80,80,80,0.10)' : 'rgba(220,220,220,0.10)',
    color: subTextColor,
    fontSize: '1rem',
    letterSpacing: '0.02em',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    '& .MuiChip-icon': {
      color: subTextColor,
      fontSize: '1.2em',
    },
    '& .MuiChip-label': {
      padding: '0 18px',
      fontWeight: 700,
    },
  }));

  // Performance Metrics Card style (Room Occupied, Revenue Growth, etc.)
  const PerfCard = styled(Box)(({ _theme }) => {
    let style = {
      background: darkMode ? 'rgba(30,30,35,0.78)' : 'rgba(255,255,255,0.74)',
      border: darkMode ? '1.5px solid rgba(80,80,80,0.18)' : '1.5px solid rgba(220,220,220,0.13)',
      borderRadius: cardStyle === 'rounded' ? '24px' : cardStyle === 'square' ? '0px' : cardStyle === 'gradient' ? '24px' : '24px',
      boxShadow: cardStyle === 'shadow' ? (darkMode ? '0 8px 40px 0 rgba(0,0,0,0.32)' : '0 8px 40px 0 rgba(0,0,0,0.10)') : 'none',
      backdropFilter: 'var(--app-blur)',
      WebkitBackdropFilter: 'var(--app-blur)',
      transition: 'box-shadow 0.22s, transform 0.18s, background 0.22s',
      padding: 24,
      height: '100%',
      fontFamily,
      fontSize,
    };
    if (cardStyle === 'glass') {
      style = {
        ...style,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        border: '1.5px solid rgba(var(--app-primary-rgb),0.18)',
        boxShadow: '0 8px 32px 0 rgba(31,38,135,0.10)',
        backdropFilter: 'var(--app-blur-strong)',
        borderRadius: '8px',
      };
    }
    return style;
  });

  // Add a style for nav tabs (upper tabs like Room Booking, etc.)
  const NavTab = styled(Box)(({ _theme }) => ({
    borderRadius: '18px',
    padding: '10px 22px',
    fontWeight: 600,
    fontSize: 16,
    background: 'rgba(255,255,255,0.18)',
    color: textColor,
    cursor: 'pointer',
    transition: 'box-shadow 0.18s, transform 0.16s, background 0.18s',
    boxShadow: 'none',
    '&:hover': {
      background: darkMode ? 'rgba(40,40,40,0.13)' : 'rgba(220,220,220,0.18)',
      boxShadow: darkMode ? '0 4px 18px 0 rgba(0,0,0,0.18)' : '0 4px 18px 0 rgba(0,0,0,0.08)',
      transform: 'scale(1.06)',
    },
  }));

  // Toggle live data updates
  const toggleLiveData = () => {
    setIsLiveData(prev => !prev);
  };

  // Colors for charts with more vibrant palette
  const COLORS = ['var(--app-primary)', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E'];

  // Format currency
  const formatCurrency = (amount) => {
    // Ensure amount is a valid number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return `${currencySym()}0`;
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: liveBilling().currencyCode,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  // Format date for last updated timestamp
  const formatLastUpdated = (date) => {
    if (!date) {return '';}
    
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  };

  // Glassmorphism style for all containers
  const glassStyle = {
    background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
    backdropFilter: 'var(--app-blur-strong)',
    WebkitBackdropFilter: 'var(--app-blur-strong)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  };

  if (loading && !summary.totalRooms) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh"
        }}>
        <CircularProgress size={60} thickness={4} color="primary" />
      </Box>
    );
  }

  if (error && !summary.totalRooms) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh"
        }}>
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load dashboard data
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <>
      {/* Scroll progress ribbon — sits above everything */}
      <ScrollProgressBar />
      {/* Ambient gradient orb field behind the entire dashboard */}
      <AmbientBackdrop />
      {/* Reusable SVG gradients & filters for every recharts chart */}
      <ChartDefs />
      {/* Global recharts hover / tooltip / dot animations — tooltip adapts to theme */}
      <ChartGlobalFx darkMode={darkMode} />
      {/* Main glassy content wrapper */}
      <Box sx={{
        minHeight: '100vh',
        p: { xs: 2, sm: 3, md: 4 },
        position: 'relative',
        zIndex: 1,
        '@media (max-width: 600px)': {
          padding: '12px !important',
        },
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Header Section */}
          <Box sx={{
          flexWrap: 'wrap',
          gap: 2,
          WebkitBackdropFilter: 'var(--app-blur)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 4, 
            p: 3, 
            borderRadius: 4,
            background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            backdropFilter: 'var(--app-blur)',
            border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              minWidth: 0,
              flex: 1,
            }}>
              <motion.div
                initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.7 } }}
                style={{ display: 'inline-flex' }}
              >
                <AnalyticsOutlined sx={{
                  fontSize: 46,
                  color: 'var(--app-primary)',
                  filter: 'drop-shadow(0 4px 16px rgba(139, 92, 246, 0.45))',
                }} />
              </motion.div>
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Typography variant="overline" sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: subTextColor,
                    letterSpacing: '0.3em',
                    fontWeight: 600,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}>
                    — {greetingFor()}{user ? `, ${(user?.username || user?.name || user?.email || 'team').split('@')[0]}` : ''}
                  </Typography>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.75, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Typography variant="h4" sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '-0.8px',
                    lineHeight: 1.1,
                    backgroundImage: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary) 55%, var(--app-primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    Hotel Dashboard
                  </Typography>
                </motion.div>
                <DrawnUnderline width={120} delay={0.45} />

                {/* Inline live mini-KPI pills with count-up */}
                <Box
                  sx={{
                    mt: 1.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  {[
                    {
                      label: 'Occupied',
                      value: summary.occupiedRooms || 0,
                      color: 'var(--app-primary)',
                      delay: 0.55,
                    },
                    {
                      label: 'Today',
                      value: (summary.todayCheckIns || 0) + (summary.todayCheckOuts || 0),
                      color: '#10B981',
                      delay: 0.65,
                    },
                    {
                      label: 'Pending',
                      value: summary.pendingBookings || 0,
                      color: '#F59E0B',
                      delay: 0.75,
                    },
                  ].map((kpi) => (
                    <motion.div
                      key={kpi.label}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileHover={{ y: -2, scale: 1.04 }}
                      transition={{ duration: 0.55, delay: kpi.delay, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 0.75,
                          px: 1.25,
                          py: 0.5,
                          borderRadius: '999px',
                          background: `${kpi.color}1a`,
                          border: `1px solid ${kpi.color}55`,
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color, boxShadow: `0 0 8px ${kpi.color}` }} />
                        <span style={{ opacity: 0.75, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.15em' }}>{kpi.label}</span>
                        <Box component="span" sx={{ fontWeight: 800, color: kpi.color, fontSize: 14 }}>
                          <CountUp value={kpi.value} />
                        </Box>
                      </Box>
                    </motion.div>
                  ))}
                </Box>
              </Box>
            </Box>
              
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>              
              {/* Enhanced Live Data Toggle */}
              <Chip 
                icon={isLiveData ? 
                  <TrendingUpOutlined sx={{ color: '#10B981' }} /> : 
                  <PauseCircleOutlined sx={{ color: '#F59E0B' }} />
                }
                label={isLiveData ? 'Live Data' : 'Paused Updates'}
                onClick={toggleLiveData}
                sx={{ 
                  borderRadius: '12px', 
                  fontWeight: 600,
                  backgroundColor: isLiveData ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: isLiveData ? '#10B981' : '#F59E0B',
                  border: `1px solid ${isLiveData ? '#10B981' : '#F59E0B'}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    backgroundColor: isLiveData ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  },
                }} 
              />
              
              {/* Enhanced Last Updated with Tooltip */}
              {lastUpdated && (
                <Tooltip title={new Date(lastUpdated).toLocaleString()}>
                  <Typography variant="caption" sx={{ color: subTextColor, fontWeight: 500 }}>
                    Updated: {formatLastUpdated(lastUpdated)}
                  </Typography>
                </Tooltip>
              )}
              
              {user && (
                <>
                  <WaterDropAvatar
                    letter={(user?.username || user?.name || user?.email || '?')[0]?.toUpperCase() || '?'}
                    size={40}
                    onClick={handleUserChipClick}
                  />
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 1.25,
                          minWidth: 300,
                          overflow: 'visible',
                          borderRadius: 3,
                          p: 0,
                          background: 'rgba(15, 23, 42, 0.92)',
                          backdropFilter: 'var(--app-blur-strong)',
                          WebkitBackdropFilter: 'var(--app-blur-strong)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          boxShadow: '0 24px 56px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--app-primary-rgb), 0.22)',
                          color: '#fff',
                        },
                      },
                    }}
                  >
                    {/* Hero — gradient backdrop + avatar + identity */}
                    <Box
                      sx={{
                        position: 'relative',
                        textAlign: 'center',
                        pt: 4,
                        pb: 2.5,
                        px: 3,
                        background:
                          'linear-gradient(135deg, rgba(var(--app-primary-rgb), 0.45) 0%, rgba(var(--app-primary-rgb), 0.12) 60%, transparent 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 12,
                          right: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1.1,
                          py: 0.35,
                          borderRadius: 999,
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#34d399',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                        Online
                      </Box>

                      <Box sx={{ display: 'inline-flex' }}>
                        <WaterDropAvatar
                          letter={(user?.username || user?.name || user?.email || '?')[0]?.toUpperCase() || '?'}
                          size={64}
                        />
                      </Box>

                      <Typography
                        sx={{
                          mt: 1.5,
                          fontSize: 18,
                          fontWeight: 700,
                          letterSpacing: '-0.01em',
                          color: '#fff',
                          lineHeight: 1.2,
                        }}
                      >
                        {(user?.username || user?.name || user?.email || 'User')}
                      </Typography>

                      <Box
                        sx={{
                          mt: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.6,
                          px: 1.25,
                          py: 0.4,
                          borderRadius: 999,
                          background: 'rgba(var(--app-primary-rgb), 0.22)',
                          border: '1px solid rgba(var(--app-primary-rgb), 0.45)',
                          color: 'rgba(255,255,255,0.95)',
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        <ShieldOutlined sx={{ fontSize: 12 }} />
                        {(user.role?.name || user.role || 'Guest')}
                      </Box>

                      {user?.email && (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            alignItems: "center",
                            justifyContent: "center",
                            mt: 1.5,
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 12
                          }}>
                          <MailOutlineOutlined sx={{ fontSize: 14 }} />
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {user.email}
                          </Box>
                        </Stack>
                      )}
                    </Box>

                    {/* ID row with copy button */}
                    <Box
                      sx={{
                        px: 2.25,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <FingerprintOutlined sx={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                          User ID
                        </Box>
                        <Box
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            color: 'rgba(255,255,255,0.85)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mt: 0.25,
                          }}
                        >
                          {(user?._id || user?.id || 'N/A')}
                        </Box>
                      </Box>
                      <Tooltip title="Copy ID">
                        <IconButton
                          size="small"
                          onClick={() => {
                            const id = user?._id || user?.id;
                            if (id && navigator.clipboard) navigator.clipboard.writeText(String(id));
                          }}
                          sx={{
                            color: 'rgba(255,255,255,0.55)',
                            '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          <ContentCopyOutlined sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <MenuItem
                      onClick={handleLogout}
                      sx={{
                        m: 1.25,
                        borderRadius: 2,
                        color: '#fca5a5',
                        fontWeight: 600,
                        fontSize: 13,
                        py: 1.25,
                        px: 1.75,
                        border: '1px solid rgba(248, 113, 113, 0.18)',
                        '&:hover': {
                          background: 'rgba(248, 113, 113, 0.12)',
                          color: '#fff',
                          borderColor: 'rgba(248, 113, 113, 0.5)',
                        },
                      }}
                    >
                      <LogoutOutlined sx={{ mr: 1.25, fontSize: 18 }} />
                      Sign out
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          </Box>
        </motion.div>

        {/* Animated marquee strip — quick-stats ticker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 28, borderRadius: 14, overflow: 'hidden' }}
        >
          <Marquee
            darkMode={darkMode}
            speed={40}
            items={[
              `${summary.totalRooms || 0} Rooms`,
              `${summary.occupiedRooms || 0} Occupied`,
              `${summary.todayCheckIns || 0} Check-ins today`,
              `${summary.todayCheckOuts || 0} Check-outs today`,
              `${summary.pendingBookings || 0} Pending bookings`,
              `${summary.confirmedBookings || 0} Confirmed`,
              `Occupancy ${summary.occupancyRate || 0}%`,
              'Live · Realtime updates',
              'Sandhya Grand · Munger · Bihar',
            ]}
          />
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <GlassCard sx={{ 
            p: 3, 
            mb: 4, 
            borderRadius: 4,
            background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            backdropFilter: 'var(--app-blur)',
            border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          }}>
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              flexWrap: 'wrap', 
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {[
                { key: 'overview', label: 'Overview', icon: <DashboardOutlined sx={{ fontSize: 20 }} />, color: 'var(--app-primary)', permission: 'view_dashboard' },
                { key: 'revenue', label: 'Revenue', icon: <CurrencyRupeeOutlined sx={{ fontSize: 20 }} />, color: '#EC4899', permission: 'manage_payments' },
                { key: 'bookings', label: 'Bookings', icon: <BookOnlineOutlined sx={{ fontSize: 20 }} />, color: '#10B981', permission: 'manage_bookings' },
                { key: 'rooms', label: 'Rooms', icon: <HotelOutlined sx={{ fontSize: 20 }} />, color: '#8B5CF6', permission: 'manage_rooms' },
                { key: 'guests', label: 'Guests', icon: <EventAvailableOutlined sx={{ fontSize: 20 }} />, color: '#F59E0B', permission: 'manage_guests' },
                { key: 'banquet', label: 'Banquet', icon: <CelebrationIcon sx={{ fontSize: 20 }} />, color: '#A855F7', permission: 'manage_events' },
                { key: 'restaurant', label: 'Restaurant', icon: <RestaurantIcon sx={{ fontSize: 20 }} />, color: '#EF4444', permission: 'manage_restaurant' },
              ].filter(tab => {
                // Always show overview tab for authenticated users
                if (tab.key === 'overview') return true;
                // For other tabs, check permissions
                return isAdmin() || hasPermission(tab.permission);
              }).map((tab) => (
                <NavTab
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    background: activeTab === tab.key 
                      ? (darkMode ? `${tab.color}15` : `${tab.color}10`)
                      : 'transparent',
                    color: activeTab === tab.key ? tab.color : textColor,
                    boxShadow: activeTab === tab.key 
                      ? `0 4px 20px ${tab.color}20` 
                      : 'none',
                    transform: activeTab === tab.key ? 'scale(1.02)' : 'scale(1)',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontWeight: 500,
                    letterSpacing: '0.2px',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </NavTab>
              ))}
            </Box>
          </GlassCard>
        </motion.div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <Box sx={{ mb: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {/* KPI Cards - Full Width Grid */}
              <Box sx={{ mb: 5 }}>
                <Typography variant="h5" sx={{ 
                  fontWeight: '700', 
                  color: textColor, 
                  mb: 3, 
                  display: 'flex', 
                  alignItems: 'center',
                  '&::before': { 
                    content: '""', 
                    display: 'inline-block', 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, var(--app-primary) 0%, #8B5CF6 100%)', 
                    marginRight: '12px', 
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)', 
                  }, 
                }}>
                  Key Performance Indicators
                </Typography>
                <Box sx={{ mb: 2, ml: '24px' }}>
                  <DrawnUnderline width={96} delay={0.2} />
                </Box>
                <Grid container spacing={4} sx={{ height: 'auto' }}>
                  {/* Rooms Card - Show for all authenticated users */}
                  <Grid
                    sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                    size={{
                      xs: 12,
                      sm: 6,
                      lg: 3
                    }}>
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <MemoizedStatsCard
                        title="Rooms Occupied"
                        value={`${summary.occupiedRooms || 0}/${summary.totalRooms || 0}`}
                        subtext={`Occupancy Rate: ${summary.occupancyRate || 0}%`}
                        icon={<HotelOutlined />}
                        bgGradient="linear-gradient(135deg, var(--app-primary) 0%, #8B5CF6 100%)"
                        trend={summary.occupancyRate > 50 ? 'up' : summary.occupancyRate > 20 ? 'neutral' : 'down'}
                        trendValue={`${summary.occupancyRate || 0}%`}
                        delay={0.15 * 0}
                        isLoading={loading}
                        hasError={error && !summary.totalRooms}
                      />
                    </Box>
                  </Grid>
                  
                  {/* Bookings Card - Show for all authenticated users */}
                  <Grid
                    sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                    size={{
                      xs: 12,
                      sm: 6,
                      lg: 3
                    }}>
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <MemoizedStatsCard
                        title="Total Bookings"
                        value={summary.totalBookings || 0}
                        subtext={`Pending: ${summary.pendingBookings || 0} | Confirmed: ${summary.confirmedBookings || 0}`}
                        icon={<BookOnlineOutlined />}
                        bgGradient="linear-gradient(135deg, #10B981 0%, #34D399 100%)"
                        trend={summary.confirmedBookings > summary.pendingBookings ? 'up' : 'neutral'}
                        trendValue={`${summary.confirmedBookings || 0} active`}
                        delay={0.15 * 1}
                        isLoading={loading}
                        hasError={error && !summary.totalBookings}
                      />
                    </Box>
                  </Grid>
                  
                  {/* Activity Card - Show for all authenticated users */}
                  <Grid
                    sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                    size={{
                      xs: 12,
                      sm: 6,
                      lg: 3
                    }}>
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <MemoizedStatsCard
                        title="Today's Activity"
                        value={`${(summary.todayCheckIns || 0) + (summary.todayCheckOuts || 0)}`}
                        subtext={`Check-ins: ${summary.todayCheckIns || 0} | Check-outs: ${summary.todayCheckOuts || 0}`}
                        icon={<EventAvailableOutlined />}
                        bgGradient="linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)"
                        trend={summary.todayCheckIns > 0 || summary.todayCheckOuts > 0 ? 'up' : 'neutral'}
                        trendValue="Today"
                        delay={0.15 * 2}
                        isLoading={loading}
                        hasError={error}
                      />
                    </Box>
                  </Grid>
                  
                  {/* Revenue Card - Show if user has manage_payments permission */}
                  {hasPermission('manage_payments') && (
                    <Grid
                      sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                      size={{
                        xs: 12,
                        sm: 6,
                        lg: 3
                      }}>
                      <Box sx={{ width: '100%', height: '100%' }}>
                        <MemoizedStatsCard
                          title="Total Revenue"
                          value={formatCurrency(summary.totalRevenue)}
                          subtext={`Pending: ${formatCurrency(Math.abs(summary.pendingPayments || 0))}`}
                          icon={<CurrencyRupeeOutlined />}
                          bgGradient="linear-gradient(135deg, #EC4899 0%, #F472B6 100%)"
                          trend={summary.totalRevenue > 0 ? 'up' : 'neutral'}
                          trendValue={summary.totalRevenue > 0 ? 'Active' : 'No Revenue'}
                          delay={0.15 * 3}
                          isLoading={loading}
                          hasError={error && !summary.totalRevenue}
                        />
                      </Box>
                    </Grid>
                  )}

                  {/* Banquet Card - Show if user can manage events */}
                  {(isAdmin() || hasPermission('manage_events')) && (
                    <Grid
                      sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                      size={{
                        xs: 12,
                        sm: 6,
                        lg: 3
                      }}>
                      <Box sx={{ width: '100%', height: '100%' }}>
                        <MemoizedStatsCard
                          title="Banquet Events"
                          value={banquetData.total || 0}
                          subtext={`Confirmed: ${banquetData.byStatus?.confirmed || 0} | Pending: ${banquetData.byStatus?.pending || 0}`}
                          icon={<CelebrationIcon />}
                          bgGradient="linear-gradient(135deg, #A855F7 0%, #C084FC 100%)"
                          trend={(banquetData.today || 0) > 0 ? 'up' : 'neutral'}
                          trendValue={`${banquetData.today || 0} today`}
                          delay={0.15 * 4}
                          isLoading={loading}
                          hasError={error}
                        />
                      </Box>
                    </Grid>
                  )}

                  {/* Restaurant Card - Show if user can manage restaurant */}
                  {(isAdmin() || hasPermission('manage_restaurant')) && (
                    <Grid
                      sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                      size={{
                        xs: 12,
                        sm: 6,
                        lg: 3
                      }}>
                      <Box sx={{ width: '100%', height: '100%' }}>
                        <MemoizedStatsCard
                          title="Restaurant Orders"
                          value={restaurantStatsData.totalOrders || 0}
                          subtext={`Today: ${restaurantStatsData.todayOrders || 0} | Completed: ${restaurantStatsData.byStatus?.completed || 0}`}
                          icon={<RestaurantIcon />}
                          bgGradient="linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
                          trend={(restaurantStatsData.todayOrders || 0) > 0 ? 'up' : 'neutral'}
                          trendValue={`${restaurantStatsData.todayOrders || 0} today`}
                          delay={0.15 * 5}
                          isLoading={loading}
                          hasError={error}
                        />
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Today's Activity - Improved Grid */}
              <Box sx={{ mb: 5 }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 3, 
                }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: '700', 
                    color: textColor, 
                    display: 'flex', 
                    alignItems: 'center',
                    '&::before': { 
                      content: '""', 
                      display: 'inline-block', 
                      width: '14px', 
                      height: '14px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 
                      marginRight: '12px', 
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)', 
                    }, 
                  }}>
                    Today&apos;s Activity
                  </Typography>
                  <Chip 
                    label="Live Updates" 
                    color="success" 
                    size="small"
                    sx={{ 
                      borderRadius: '12px', 
                      fontWeight: 600, 
                      backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                      color: '#10B981', 
                      border: '1px solid #10B981', 
                    }} 
                  />
                </Box>
                <Grid container spacing={4}>
                  {[
                    { icon: <EventAvailableOutlined />, value: summary.todayCheckIns || 0, label: 'Check-ins Today' },
                    { icon: <EventAvailableOutlined />, value: summary.todayCheckOuts || 0, label: 'Check-outs Today' },
                    { icon: <BookOnlineOutlined />, value: summary.todayBookings || 0, label: 'New Bookings' },
                    { icon: <CurrencyRupeeOutlined />, value: formatCurrency(summary.todayRevenue || 0), label: 'Today Revenue' },
                    { icon: <CelebrationIcon />, value: banquetData.today || 0, label: 'Banquet Events' },
                    { icon: <RestaurantIcon />, value: restaurantStatsData.todayOrders || 0, label: 'Restaurant Orders' },
                  ].map((item, index) => (
                    <Grid
                      key={index}
                      sx={{ display: 'flex', height: 280, minHeight: 280, maxHeight: 280 }}
                      size={{
                        xs: 12,
                        sm: 6,
                        lg: 3
                      }}>
                      <Box sx={{ width: '100%', height: '100%' }}>
                        <ActivityCard>
                          <Box sx={{ color: 'rgba(68,68,68,0.9)', fontSize: 32, mb: 1 }}>
                            {item.icon}
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'rgba(35,39,47,0.95)' }}>
                            {item.value || 0}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8, fontWeight: 500, textAlign: 'center', color: 'rgba(136,136,136,0.8)' }}>
                            {item.label}
                          </Typography>
                        </ActivityCard>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Performance Metrics - Full Width */}
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 3, 
                }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: '700', 
                    color: textColor, 
                    display: 'flex', 
                    alignItems: 'center',
                    '&::before': { 
                      content: '""', 
                      display: 'inline-block', 
                      width: '14px', 
                      height: '14px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
                      marginRight: '12px', 
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)', 
                    }, 
                  }}>
                    Performance Metrics
                  </Typography>
                  <Typography variant="caption" sx={{ color: subTextColor, fontWeight: 500 }}>
                    Last 6 months
                  </Typography>
                </Box>
                <Grid container spacing={4}>
                  <Grid
                    size={{
                      xs: 12,
                      lg: 6
                    }}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    >
                      <Box sx={{
                        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
                        backdropFilter: 'var(--app-blur-strong)',
                        WebkitBackdropFilter: 'var(--app-blur-strong)',
                        border: '1px solid rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                        borderRadius: '24px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 40px rgba(var(--app-primary-rgb), 0.05), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                        p: 4,
                        height: '100%',
                        minHeight: 380,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        },
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 700, 
                            color: textColor,
                            display: 'flex',
                            alignItems: 'center',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            '&::before': { 
                              content: '""', 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
                              marginRight: '12px', 
                              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)', 
                            },
                          }}>
                            Occupancy Rate Trend
                          </Typography>
                          <StatsChip 
                            label={`Current: ${summary.occupancyRate || 0}%`}
                            size="small"
                            sx={{
                              background: 'rgba(79, 172, 254, 0.1)',
                              color: '#4facfe',
                              border: '1px solid rgba(79, 172, 254, 0.2)',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Box sx={{ height: 280, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={occupancyHistoryData}>
                              <defs>
                                <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8}/>
                                  <stop offset="50%" stopColor="#00f2fe" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#4facfe" stopOpacity={0.1}/>
                                </linearGradient>
                                <filter id="glow">
                                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                  <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                              </defs>
                              <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke="rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))" 
                                horizontal={true}
                                vertical={false}
                              />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: textColor, fontSize: 12, fontWeight: 500 }}
                              />
                              <YAxis 
                                domain={[0, 100]} 
                                tickFormatter={(value) => `${value}%`}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: textColor, fontSize: 12, fontWeight: 500 }}
                              />
                              <RechartsTooltip 
                                formatter={(value) => [`${value}%`, 'Occupancy Rate']}
                                contentStyle={{ 
                                  background: 'rgba(255,255,255,0.95)', 
                                  backdropFilter: 'blur(20px)', 
                                  borderRadius: '16px', 
                                  border: '1px solid rgba(255,255,255,0.2)', 
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                  fontWeight: 600,
                                }}
                                labelStyle={{ color: '#333', fontWeight: 700 }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="rate" 
                                stroke="#4facfe" 
                                strokeWidth={3}
                                fill="url(#occupancyGradient)"
                                fillOpacity={1}
                                filter="url(#glow)"
                                dot={{ r: 0 }}
                                activeDot={{ 
                                  r: 8, 
                                  strokeWidth: 3, 
                                  stroke: '#4facfe',
                                  fill: '#fff',
                                  filter: 'drop-shadow(0 0 6px rgba(79, 172, 254, 0.6))'
                                }} 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </motion.div>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      lg: 6
                    }}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    >
                      <Box sx={{
                        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
                        backdropFilter: 'var(--app-blur-strong)',
                        WebkitBackdropFilter: 'var(--app-blur-strong)',
                        border: '1px solid rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                        borderRadius: '24px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 40px rgba(16, 185, 129, 0.05), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                        p: 4,
                        height: '100%',
                        minHeight: 380,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        },
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 700, 
                            color: textColor,
                            display: 'flex',
                            alignItems: 'center',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            '&::before': { 
                              content: '""', 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', 
                              marginRight: '12px', 
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)', 
                            },
                          }}>
                            Revenue Growth
                          </Typography>
                          <StatsChip 
                            icon={<ArrowUpwardOutlined fontSize="small" />}
                            label={formatCurrency(summary.totalRevenue || 0)}
                            size="small"
                            sx={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10B981',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Box sx={{ height: 280, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                              <defs>
                                <linearGradient id="revenueGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                  <stop offset="50%" stopColor="#34D399" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                                </linearGradient>
                                <filter id="revenueGlow">
                                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                  <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                              </defs>
                              <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke="rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))" 
                                horizontal={true}
                                vertical={false}
                              />
                              <XAxis 
                                dataKey="month" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: textColor, fontSize: 12, fontWeight: 500 }}
                              />
                              <YAxis 
                                tickFormatter={(value) => `${currencySym()}${value/1000}K`}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: textColor, fontSize: 12, fontWeight: 500 }}
                              />
                              <RechartsTooltip 
                                formatter={(value) => [formatCurrency(value), 'Revenue']}
                                contentStyle={{ 
                                  background: 'rgba(255,255,255,0.95)', 
                                  backdropFilter: 'blur(20px)', 
                                  borderRadius: '16px', 
                                  border: '1px solid rgba(255,255,255,0.2)', 
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                  fontWeight: 600,
                                }}
                                labelStyle={{ color: '#333', fontWeight: 700 }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#10B981" 
                                strokeWidth={3}
                                fill="url(#revenueGrowthGradient)"
                                fillOpacity={1}
                                filter="url(#revenueGlow)"
                                dot={{ r: 0 }}
                                activeDot={{ 
                                  r: 8, 
                                  strokeWidth: 3, 
                                  stroke: '#10B981',
                                  fill: '#fff',
                                  filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))'
                                }} 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </motion.div>
                  </Grid>
                </Grid>
              </Box>
            </motion.div>
          </Box>
        )}
        {activeTab === 'revenue' && (
          <Box sx={{
            mb: 10
          }}>
            {/* Revenue Tab: Only revenue-related charts and stats */}
            <Grid container spacing={4}>
              {/* Revenue Chart */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-primary) 0%, #8B5CF6 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Monthly Revenue
                      </Typography>
                      <StatsChip 
                        icon={<ArrowUpwardOutlined fontSize="small" />}
                        label={`Total: ${formatCurrency(summary.totalRevenue)}`}
                        isPositive={true}
                        size="small"
                      />
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={processedRevenueData}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--app-primary)" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="var(--app-primary)" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip 
                              formatter={(value) => formatCurrency(value)}
                              contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="var(--app-primary)" 
                              fillOpacity={1} 
                              fill="url(#colorRevenue)" 
                              strokeWidth={3} 
                              name="Revenue" 
                              activeDot={{ r: 6, strokeWidth: 2 }} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Payment Status */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #fa709a 0%, #f5576c 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Payment Status
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {formatCurrency(summary.totalRevenue || 0)} Total Revenue
                      </Typography>
                    </Box>
                    <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            animationDuration={1600}
                            animationEasing="ease-out"
                            animationBegin={250}
                            data={[
                              { name: 'Room Bookings', value: summary.revenueBreakdown?.roomBookings || 0 },
                              { name: 'Banquet', value: summary.revenueBreakdown?.banquet || 0 },
                              { name: 'Restaurant', value: summary.revenueBreakdown?.restaurant || 0 },
                              { name: 'Pending Payments', value: summary.pendingPayments || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            innerRadius={70}
                            paddingAngle={5}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Room Bookings', value: summary.revenueBreakdown?.roomBookings || 0 },
                              { name: 'Banquet', value: summary.revenueBreakdown?.banquet || 0 },
                              { name: 'Restaurant', value: summary.revenueBreakdown?.restaurant || 0 },
                              { name: 'Pending Payments', value: summary.pendingPayments || 0 },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value) => formatCurrency(value)}
                            contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                          />
                          <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center"
                            formatter={(value, entry) => {
                              const { payload } = entry;
                              return `${value}: ${formatCurrency(payload.value)}`;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Revenue Growth */}
              <Grid size={12}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.0 }}
                >
                  <PerfCard sx={{ ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Revenue Growth
                      </Typography>
                      <Typography variant="caption" sx={{ color: subTextColor }}>
                        Last 6 months
                      </Typography>
                    </Box>
                    <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(value) => `${currencySym()}${value/1000}K`} />
                          <RechartsTooltip 
                            formatter={(value) => [formatCurrency(value), 'Revenue']}
                            contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none' }}
                          />
                          <Bar
                            dataKey="revenue"
                            fill="url(#dashGradTeal)"
                            radius={[10, 10, 0, 0]}
                            animationDuration={1800}
                            animationEasing="ease-out"
                            animationBegin={150}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </PerfCard>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        )}
        {activeTab === 'bookings' && (
          <Box sx={{
            mb: 10
          }}>
            {/* Bookings Tab: Only booking-related charts and stats */}
            <Grid container spacing={4}>
              {/* Booking Statistics */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Booking Statistics
                      </Typography>
                      <StatsChip 
                        icon={<ArrowUpwardOutlined fontSize="small" />}
                        label={`Total: ${summary.totalBookings || 0} bookings`}
                        isPositive={true}
                        size="small"
                      />
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={bookingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RechartsTooltip 
                              contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                            />
                            <Legend />
                            <Bar
                              dataKey="bookings"
                              fill="url(#dashGradEmerald)"
                              name="Bookings"
                              radius={[10, 10, 0, 0]}
                              animationDuration={1800}
                              animationEasing="ease-out"
                              animationBegin={150}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Booking Status */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Booking Status
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {summary.confirmedBookings || 0} Active
                      </Typography>
                    </Box>
                    <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            animationDuration={1600}
                            animationEasing="ease-out"
                            animationBegin={250}
                            data={[
                              { name: 'Pending', value: summary.pendingBookings || 0 },
                              { name: 'Confirmed', value: summary.confirmedBookings || 0 },
                              { name: 'Completed', value: summary.completedBookings || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            innerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                            paddingAngle={5}
                          >
                            {[
                              { name: 'Pending', value: summary.pendingBookings || 0 },
                              { name: 'Confirmed', value: summary.confirmedBookings || 0 },
                              { name: 'Completed', value: summary.completedBookings || 0 },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value) => value}
                            contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                          />
                          <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center"
                            formatter={(value, entry) => {
                              const { payload } = entry;
                              return `${value}: ${payload.value}`;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </GlassPaper>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        )}
        {activeTab === 'rooms' && (
          <Box sx={{
            mb: 10
          }}>
            {/* Rooms Tab: Only room-related charts and stats */}
            <Grid container spacing={4}>
              {/* Room Occupancy */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Room Occupancy
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {occupancyData.occupancyRate}% Occupied
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              animationDuration={1600}
                              animationEasing="ease-out"
                              animationBegin={250}
                              data={[
                                { name: 'Occupied', value: occupancyData.occupiedRooms },
                                { name: 'Available', value: occupancyData.availableRooms },
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              innerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={5}
                            >
                              {[
                                { name: 'Occupied', value: occupancyData.occupiedRooms },
                                { name: 'Available', value: occupancyData.availableRooms },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value) => value}
                              contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              formatter={(value, entry) => {
                                const { payload } = entry;
                                return `${value}: ${payload.value}`;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Room Types */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Room Types
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {roomTypeData?.length || 0} Categories
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              animationDuration={1600}
                              animationEasing="ease-out"
                              animationBegin={250}
                              data={roomTypeData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              innerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={5}
                            >
                              {roomTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value) => value}
                              contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              formatter={(value, entry) => {
                                const { payload } = entry;
                                return `${value}: ${payload.value}`;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        )}
        {activeTab === 'guests' && hasPermission('manage_guests') && (
          <Box sx={{
            mb: 10
          }}>
            {/* Guests Tab: List and gender chart */}
            <Grid container spacing={4}>
              <Grid
                size={{
                  xs: 12,
                  md: 7
                }}>
                <GlassCard sx={{ p: 3, background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))', backdropFilter: 'var(--app-blur-strong)', WebkitBackdropFilter: 'var(--app-blur-strong)', border: '1.5px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
                  <Typography variant="h5" sx={{ fontWeight: '700', color: textColor, mb: 3, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-primary) 0%, #8B5CF6 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                    Recent Guests
                  </Typography>
                  {guestLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, ...glassStyle, borderRadius: 2 }}>
                      <CircularProgress />
                    </Box>
                  ) : guestList.length === 0 ? (
                    <Typography variant="body2" sx={{ color: subTextColor, ...glassStyle }}>
                      No guests found.
                    </Typography>
                  ) : (
                    <Box>
                      {guestList.slice(0, 8).map(guest => (
                        <Box key={guest._id} sx={{ mb: 2, p: 2, borderRadius: 2, ...glassStyle }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{guest.name}</Typography>
                          <Typography variant="body2" sx={{
                            color: "text.secondary"
                          }}>Phone: {guest.phone}</Typography>
                          <Typography variant="body2" sx={{
                            color: "text.secondary"
                          }}>Email: {guest.email || 'N/A'}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </GlassCard>
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  md: 5
                }}>
                <GlassCard sx={{ p: 3, height: '100%', ...glassStyle }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: textColor }}>Gender Distribution</Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        animationDuration={1600}
                        animationEasing="ease-out"
                        animationBegin={250}
                        data={guestGenderData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        innerRadius={50}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={5}
                        nameKey="name"
                      >
                        {guestGenderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={v => v} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                </GlassCard>
              </Grid>
            </Grid>
          </Box>
        )}
        {activeTab === 'banquet' && hasPermission('manage_events') && (
          <Box sx={{
            mb: 10
          }}>
            {/* Banquet Tab: Banquet bookings and revenue */}
            <Grid container spacing={4}>
              {/* Banquet Bookings Overview */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Banquet Bookings
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {banquetData?.total || 0} Total
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              animationDuration={1600}
                              animationEasing="ease-out"
                              animationBegin={250}
                              data={[
                                { name: 'Pending', value: banquetData.byStatus?.pending || 0 },
                                { name: 'Confirmed', value: banquetData.byStatus?.confirmed || 0 },
                                { name: 'Completed', value: banquetData.byStatus?.completed || 0 },
                                { name: 'Cancelled', value: banquetData.byStatus?.cancelled || 0 },
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              innerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={5}
                            >
                              {[
                                { name: 'Pending', value: banquetData.byStatus?.pending || 0 },
                                { name: 'Confirmed', value: banquetData.byStatus?.confirmed || 0 },
                                { name: 'Completed', value: banquetData.byStatus?.completed || 0 },
                                { name: 'Cancelled', value: banquetData.byStatus?.cancelled || 0 },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value) => value}
                              contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              formatter={(value, entry) => {
                                const { payload } = entry;
                                return `${value}: ${payload.value}`;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Banquet Revenue */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Banquet Revenue
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {formatCurrency(banquetData.revenue?.total || 0)} Total
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={[
                            { name: 'Today', revenue: banquetData.revenue?.today || 0 },
                            { name: 'This Month', revenue: banquetData.revenue?.month || 0 },
                            { name: 'Total', revenue: banquetData.revenue?.total || 0 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(value) => `${currencySym()}${value/1000}K`} />
                            <RechartsTooltip 
                              formatter={(value) => [formatCurrency(value), 'Revenue']}
                              contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none' }}
                            />
                            <Bar
                              dataKey="revenue"
                              fill="url(#dashGradEmerald)"
                              radius={[10, 10, 0, 0]}
                              animationDuration={1800}
                              animationEasing="ease-out"
                              animationBegin={150}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        )}
        {activeTab === 'restaurant' && hasPermission('manage_restaurant') && (
          <Box sx={{
            mb: 10
          }}>
            {/* Restaurant Tab: Sales, expenses, and stats */}
            <Grid container spacing={4}>
              {/* Restaurant Sales */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Restaurant Sales
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {formatCurrency(restaurantSalesData.total || 0)} Total
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={restaurantSalesData.monthlyChart || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `${currencySym()}${value/1000}K`} />
                            <RechartsTooltip 
                              formatter={(value) => [formatCurrency(value), 'Sales']}
                              contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none' }}
                            />
                            <Bar
                              dataKey="sales"
                              fill="url(#dashGradCrimson)"
                              radius={[10, 10, 0, 0]}
                              animationDuration={1800}
                              animationEasing="ease-out"
                              animationBegin={150}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Restaurant Expenses */}
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassPaper sx={{ p: 4, height: '100%', position: 'relative', ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Restaurant Expenses
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--app-primary)' }}>
                        {formatCurrency(restaurantExpensesData.total || 0)} Total
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "300px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              animationDuration={1600}
                              animationEasing="ease-out"
                              animationBegin={250}
                              data={restaurantExpensesData.categories || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              innerRadius={70}
                              fill="#8884d8"
                              dataKey="amount"
                              paddingAngle={5}
                              nameKey="name"
                            >
                              {(restaurantExpensesData.categories || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value) => [formatCurrency(value), 'Expenses']}
                              contentStyle={{ background: 'rgba(255,255,255,0.8)', borderRadius: '8px', border: 'none' }}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom" 
                              align="center"
                              formatter={(value, entry) => {
                                const { payload } = entry;
                                return `${value}: ${formatCurrency(payload.amount)}`;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </GlassPaper>
                </motion.div>
              </Grid>
              {/* Restaurant Stats */}
              <Grid size={12}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.0 }}
                >
                  <PerfCard sx={{ ...glassStyle }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: '700', color: textColor, display: 'flex', alignItems: 'center', '&::before': { content: '""', display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', marginRight: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' } }}>
                        Restaurant Statistics
                      </Typography>
                      <Typography variant="caption" sx={{ color: subTextColor }}>
                        Order Performance
                      </Typography>
                    </Box>
                    {loading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "200px"
                        }}>
                        <CircularProgress size={40} thickness={4} />
                      </Box>
                    ) : (
                      <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={[
                            { name: 'Total Orders', value: restaurantStatsData.totalOrders || 0 },
                            { name: 'Today Orders', value: restaurantStatsData.todayOrders || 0 },
                            { name: 'Monthly Orders', value: restaurantStatsData.monthlyOrders || 0 },
                            { name: 'Avg Order Value', value: restaurantStatsData.averageOrderValue || 0 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip 
                              formatter={(value, name) => [name === 'Avg Order Value' ? formatCurrency(value) : value, name]}
                              contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none' }}
                            />
                            <Bar
                              dataKey="value"
                              fill="url(#dashGradPrimary)"
                              radius={[10, 10, 0, 0]}
                              animationDuration={1800}
                              animationEasing="ease-out"
                              animationBegin={150}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </PerfCard>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    </>
  );
};

export default Dashboard;