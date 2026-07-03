import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Grid,
  Chip,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Alert,
  useTheme,
  alpha,
  Snackbar,
} from '@mui/material';
import {
  CleaningServices as CleaningIcon,
  ConstructionOutlined as RepairIcon,
  Info as InfoIcon,
  Hotel as HotelIcon,
  KingBed as KingBedIcon,
  SingleBed as SingleBedIcon,
  Star as StarIcon,
  People as PeopleIcon,
  LocationOn as LocationOnIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import FormDialog, { FormSection } from '../../components/forms/FormDialog';
import { currencySym, liveRoomGstFraction } from '../../utils/billing';
import { amenityIcons, getStatusStyles } from './rooms/roomDisplay';
import { motion } from 'framer-motion';
import api from '../../api';
import { useHousekeeping } from '../../contexts/HousekeepingContext';
import { subscribeSettingsChange } from '../../components/settings/settingsEvents';
import CircularProgress from '@mui/material/CircularProgress';
import { useSettings } from '../../contexts/SettingsContext';

const Rooms = ({ _sidebarOpen }) => {
  const theme = useTheme();
  const componentIsMounted = useRef(true);
  const roomsRef = useRef([]);
  const { isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const { notifyHousekeeping } = useHousekeeping() || {};
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomCategories, setRoomCategories] = useState([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { settings } = useSettings();
  const isDarkMode = settings?.theme?.darkMode;
  const cardStyle = settings?.theme?.cardStyle || 'rounded';
  const accentColor = settings?.theme?.accentColor || '#F59E42';

  useEffect(() => {
    return () => {
      componentIsMounted.current = false;
    };
  }, []);

  const roomStatus = ['available', 'occupied', 'maintenance', 'cleaning'];

  // Amenity icons mapping
  // Resolve a room's category whether it was stored by categoryId, by id-as-type,
  // or by category name. Accepts a room object or a bare type string.
  const findRoomCategory = (roomOrType) => {
    if (!Array.isArray(roomCategories) || !roomOrType) return null;
    const room = typeof roomOrType === 'string' ? { type: roomOrType } : roomOrType;
    return (
      roomCategories.find(
        (c) =>
          (c.id || c._id) === room.categoryId ||
          (c.id || c._id) === room.type ||
          c.name === room.type,
      ) || null
    );
  };

  // Room type icon mapping function
  const getRoomTypeIcon = (type) => {
    // Find category to get max occupancy for better icon selection
    const category = findRoomCategory(type);
    const maxOccupancy = category?.maxOccupancy || 2;
    
    // Icon selection based on category type, price tier, and occupancy
    if (type?.includes('super_deluxe') || type?.includes('premium_plus')) {
      return <StarIcon />; // Premium icon for highest tiers
    } else if (type?.includes('executive') || type?.includes('premium') || maxOccupancy >= 4) {
      return <HotelIcon />; // Hotel icon for executive/premium
    } else if (type?.includes('deluxe') || type?.includes('ac')) {
      return <KingBedIcon />; // King bed for deluxe/AC rooms
    } else if (type?.includes('standard') || type?.includes('economic')) {
      return <SingleBedIcon />; // Single bed for standard/economic
    } else {
      return <HotelIcon />; // Default fallback
    }
  };

  // Add showSnackbar function
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleShowDetails = (room) => {
    setSelectedRoom(room);
    setDetailsOpen(true);
  };


  const handleCloseDetails = () => {
    setDetailsOpen(false);
  };

  // Add this function to check if a room is currently booked
  // A room is occupied only when a guest is physically checked in (not merely
  // reserved). bookingStatus tracks the reservation; checkedIn tracks presence.
  const isRoomBooked = useCallback(
    (roomId) => {
      const list = Array.isArray(bookings) ? bookings : [];

      // booking.roomId may be a populated object ({ _id, ... }) or a raw id
      // string depending on the endpoint — normalise before comparing.
      const bookingRoomId = (b) =>
        (b.roomId && typeof b.roomId === 'object') ? String(b.roomId._id) : String(b.roomId);

      return list.some(
        (booking) =>
          bookingRoomId(booking) === String(roomId) &&
          booking.checkedIn === true &&
          booking.bookingStatus !== 'Completed' &&
          booking.bookingStatus !== 'Cancelled' &&
          booking.bookingStatus !== 'Rejected',
      );
    },
    [bookings],
  );

  // Fetch room categories from settings
  const fetchRoomCategories = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return;
    }
    
    try {
      // Use the authenticated api service
      const response = await api.get('/settings/room-categories');
      
      // The API returns { success: true, data: { categories: [...] }, message: "..." }
      if (response.data && response.data.success) {
        const categories = response.data.data?.categories || [];
        
        // If no categories exist, initialize them
        if (!Array.isArray(categories) || categories.length === 0) {
          try {
            const initResponse = await api.post('/settings/room-categories/initialize');
            if (initResponse.data && initResponse.data.success) {
              const initializedCategories = initResponse.data.data?.categories || [];
              const activeCategories = initializedCategories.filter(cat => cat.isActive !== false).map(cat => ({
                id: cat._id || cat.id,
                name: cat.name,
                description: cat.description || '',
                basePrice: cat.basePrice || 0,
                maxOccupancy: cat.maxOccupancy || 2,
                amenities: cat.amenities || [],
              }));
              setRoomCategories(activeCategories);
              showSnackbar(`Initialized ${activeCategories.length} room categories`, 'success');
              return;
            }
          } catch (initError) {
            console.error('Error initializing room categories:', initError);
          }
        }
        
        // Ensure we always have an array and handle proper structure
        if (Array.isArray(categories)) {
          // Filter only active categories and ensure they have proper structure
          const activeCategories = categories.filter(cat => cat.isActive !== false).map(cat => ({
            id: cat._id || cat.id,
            name: cat.name,
            description: cat.description || '',
            basePrice: cat.basePrice || 0,
            maxOccupancy: cat.maxOccupancy || 2,
            amenities: cat.amenities || [],
          }));
          
          setRoomCategories(activeCategories);
          showSnackbar(`Loaded ${activeCategories.length} room categories`, 'info');
        } else {
          console.warn('Room categories response is not an array:', categories);
          setRoomCategories([]);
          showSnackbar('No room categories found', 'warning');
        }
      } else {
        console.warn('Invalid room categories API response structure:', response.data);
        setRoomCategories([]);
        showSnackbar('Invalid room categories response', 'warning');
      }
    } catch (error) {
      console.error('Error fetching room categories:', {
        message: error.message,
        status: error.response?.status,
      });
      showSnackbar('Failed to fetch room categories from settings', 'error');
      // Set empty array instead of fallback to encourage proper setup
      setRoomCategories([]);
    }
  }, [showSnackbar, isAuthenticated]);

  // Update fetchRooms to avoid continuous API calls
  const fetchRooms = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.rooms.getAll();

      // Create a copy of rooms to avoid modifying the response directly
      const updatedRooms = [...response.data];

      // Set the rooms state with our data
      setRooms(updatedRooms);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      showSnackbar('Failed to fetch rooms', 'error');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnackbar]);

  const fetchBookings = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return;
    }
    
    try {
      const response = await api.bookings.getAll();
      // The /bookings endpoint wraps its payload in { success, data, message }.
      // Unwrap to the array so isRoomBooked can iterate it.
      const list = Array.isArray(response.data)
        ? response.data
        : (response.data?.data || []);
      setBookings(list);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    }
  }, [isAuthenticated]);

  // Reconcile each room's status against its current bookings — bidirectionally.
  //
  //  • A room with a confirmed booking covering today  → should be 'occupied'.
  //  • A room marked 'occupied' but with NO current booking → was left stale
  //    (the stay ended, was cancelled, checked out, or the booking deleted)
  //    and is reset to 'available'.
  //  • 'cleaning' and 'maintenance' are deliberate manual states — never
  //    auto-overridden here; staff clear those from the room's own actions.
  useEffect(() => {
    // Need rooms loaded; bookings may legitimately be empty (then every
    // 'occupied' room is stale and should free up).
    if (rooms.length === 0) return;

    const desiredStatusFor = (room) => {
      const booked = isRoomBooked(room._id);
      if (booked) return 'occupied';
      // Not currently booked: only correct a stale 'occupied'. Leave
      // available / cleaning / maintenance untouched.
      if (room.status === 'occupied') return 'available';
      return room.status; // no change
    };

    const roomsToUpdate = rooms.filter((room) => desiredStatusFor(room) !== room.status);
    if (roomsToUpdate.length === 0) return;

    roomsToUpdate.forEach((room) => {
      const next = desiredStatusFor(room);
      api.rooms
        .update(room._id, { status: next, isAvailable: next === 'available' })
        .catch((err) => console.error(`Failed to sync room ${room._id} status:`, err));
    });

    // Reflect locally right away to avoid a flicker.
    setRooms((prevRooms) =>
      prevRooms.map((room) => {
        const next = desiredStatusFor(room);
        return next !== room.status ? { ...room, status: next } : room;
      }),
    );
  }, [rooms, bookings, isRoomBooked]);

  // Helper function to match room type to category ID for filtering
  const matchRoomTypeToCategory = useCallback((roomType, categoryId) => {
    if (!roomType || !categoryId) {return false;}
    
    // Find the category by ID
    const category = roomCategories.find(cat => cat.id === categoryId);
    if (!category) {return false;}
    
    // Direct match with category ID
    if (roomType === categoryId) {return true;}
    
    // Match with category name (handle both old and new naming conventions)
    const categoryName = category.name;
    
    // Normalize both strings for comparison (handle spelling variations)
    const normalizeString = (str) => {
      return str.toLowerCase()
        .replace(/[\s\-_]+/g, ' ') // normalize spaces, hyphens, underscores
        .replace(/economy/g, 'economic') // handle Economy vs Economic variation
        .replace(/economic/g, 'economic') // ensure consistency
        .replace(/\s+room$/i, '') // remove "room" suffix if present
        .trim();
    };
    
    const normalizedRoomType = normalizeString(roomType);
    const normalizedCategoryName = normalizeString(categoryName);
    
    // Check if room type matches category name (normalized, without "Room" suffix)
    return normalizedRoomType === normalizedCategoryName;
  }, [roomCategories]);

  useEffect(() => {
    let result = rooms;

    if (searchQuery) {
      result = result.filter((room) =>
        room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter((room) => matchRoomTypeToCategory(room.type, typeFilter));
    }

    if (statusFilter !== 'all') {
      result = result.filter((room) => room.status === statusFilter);
    }

    setFilteredRooms(result);
  }, [rooms, searchQuery, typeFilter, statusFilter, roomCategories, matchRoomTypeToCategory]);

  // Keep only this useEffect to fetch both rooms and bookings
  useEffect(() => {
    // Initial fetch
    fetchRoomCategories();
    fetchRooms();
    fetchBookings();

    // Set up a refresh interval with a longer time
    const intervalId = setInterval(() => {
      fetchRooms();
      fetchBookings();
    }, 300000); // Refresh every 5 minutes instead of every minute

    // Reflect category/room changes made in Settings → Room categories.
    const unsubscribe = subscribeSettingsChange(['roomCategories', 'rooms'], (section) => {
      if (section === 'rooms') {
        fetchRooms();
      } else {
        fetchRoomCategories();
        fetchRooms();
      }
    });

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [fetchRoomCategories, fetchRooms, fetchBookings, isAuthenticated]);

  // Add this effect to update the ref when rooms change
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Add this effect to handle booking events and room management updates
  useEffect(() => {
    const handleBookingEvent = (event) => {
      const { roomId, action, isBooked } = event.detail;

      if (action === 'booking_created' || action === 'booking_updated') {
        updateRoomStatus(roomId, isBooked);
      } else if (action === 'checkout_completed') {
        updateRoomStatus(roomId, false, true);
      }
    };

    const handleRoomDataUpdate = (event) => {
      const { action, roomId, newStatus } = event.detail;
      
      if (action === 'create' || action === 'update' || action === 'delete') {
        // Refresh all room data when rooms are created, updated, or deleted
        fetchRooms();
        // Also refresh room categories in case room types changed
        fetchRoomCategories();
      } else if (action === 'statusUpdate') {
        // Update specific room status without full refresh
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room._id === roomId ? { ...room, status: newStatus } : room
          )
        );
      }
    };

    const updateRoomStatus = (roomId, isBooked, isCheckout = false) => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room._id === roomId) {
            let newStatus = room.status;

            if (isCheckout) {
              newStatus = 'cleaning';
            } else if (isBooked) {
              newStatus = 'occupied';
            } else if (room.status === 'occupied') {
              newStatus = 'available';
            }

            return { ...room, status: newStatus };
          }
          return room;
        }),
      );
    };

    const dispatchBookingEvent = (roomId, action) => {
      const event = new CustomEvent('bookingEvent', {
        detail: { roomId, action },
      });
      window.dispatchEvent(event);
    };

    window.addEventListener('bookingEvent', handleBookingEvent);
    window.addEventListener('roomDataUpdated', handleRoomDataUpdate);

    // Add the functions to the window object
    if (!window.hotelManagement) {
      window.hotelManagement = {};
    }
    window.hotelManagement.updateRoomStatus = updateRoomStatus;
    window.hotelManagement.dispatchBookingEvent = dispatchBookingEvent;

    return () => {
      window.removeEventListener('bookingEvent', handleBookingEvent);
      window.removeEventListener('roomDataUpdated', handleRoomDataUpdate);
      
      // Clean up when component unmounts
      if (window.hotelManagement) {
        delete window.hotelManagement.updateRoomStatus;
        delete window.hotelManagement.dispatchBookingEvent;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMaintenanceToggle = async (roomId, currentStatus) => {
    try {
      const newStatus =
        currentStatus === 'maintenance' ? 'available' : 'maintenance';
      await api.rooms.update(roomId, { status: newStatus });
      showSnackbar(
        `Room ${newStatus === 'maintenance' ? 'marked for maintenance' : 'marked as available'}`,
      );
      fetchRooms();

      if (newStatus === 'maintenance' && notifyHousekeeping) {
        const room = rooms.find((r) => r._id === roomId);
        notifyHousekeeping({
          type: 'maintenance',
          roomId: room?._id, // Add roomId
          roomNumber: room?.roomNumber,
          message: `Room ${room?.roomNumber} requires maintenance`,
        });
      }
    } catch (error) {
      console.error('Error updating room status:', error);
      showSnackbar('Failed to update room status', 'error');
    }
  };

  const getRoomTypeLabel = (type) => {
    // Find the category from the fetched room categories
    const category = findRoomCategory(type);
    if (category) {
      // Return the category name as-is (no longer adding "Room" suffix)
      return category.name;
    }
    
    // If category not found, return formatted type as fallback without "Room" suffix
    if (type) {
      const formattedType = type.charAt(0).toUpperCase() + type.slice(1).replace(/[_-]/g, ' ');
      return formattedType;
    }
    
    return 'Unknown Type';
  };

  const handleCleaningToggle = async (roomId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'cleaning' ? 'available' : 'cleaning';
      await api.rooms.update(roomId, { status: newStatus });
      showSnackbar(
        `Room ${newStatus === 'cleaning' ? 'marked for cleaning' : 'marked as available'}`,
      );
      fetchRooms();

      if (newStatus === 'cleaning' && notifyHousekeeping) {
        const room = rooms.find((r) => r._id === roomId);
        notifyHousekeeping({
          type: 'cleaning',
          roomId: room?._id, // Add roomId
          roomNumber: room?.roomNumber,
          message: `Room ${room?.roomNumber} requires cleaning`,
        });
      }
    } catch (error) {
      console.error('Error updating room status:', error);
      showSnackbar('Failed to update room status', 'error');
    }
  };

  // Add this function for visible status styles
  // Enhanced room card component.
  //
  // Memoised so the component IDENTITY is stable across renders. Previously a
  // fresh `React.memo(...)` was built on every render of Rooms, so React saw a
  // brand-new component type each time and UNMOUNTED + remounted every card.
  // That replayed each card's mount entrance animation on each of the several
  // re-renders that fire while the page loads (loading → rooms → bookings →
  // status reconcile → filter), which is the flicker seen when opening the page.
  // Now it's rebuilt only when the values its closures depend on actually change.
  const RoomCard = useMemo(() => React.memo(function RoomCard({ room }) {
    // Single source of truth: a room's price/occupancy/amenities come from its
    // category (defined in Settings → Room categories). The room's own stored
    // values are only a fallback for rooms whose category no longer exists.
    const category = findRoomCategory(room);
    const displayPrice = category?.basePrice ?? room.pricePerNight ?? 0;
    const displayAmenities = (category?.amenities?.length ? category.amenities : room.amenities) || [];
    const displayOccupancy = category?.maxOccupancy
      ?? (typeof room.capacity === 'object' ? room.capacity?.adults : room.capacity)
      ?? 2;
    return (
      // No mount entrance / `layout` animation here. Each card is a
      // backdrop-filter glass surface; animating opacity/transform on dozens of
      // them at once — while the sidebar's glass paper slides and the page
      // fades in on navigation — forces Chrome to re-rasterize every blurred
      // layer each frame, which is the flicker seen when opening this page.
      // Hover stays (one card at a time, no navigation overlap).
      <motion.div
        whileHover={{ scale: 1.03, y: -4 }}
        style={{ willChange: 'transform' }}
      >
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius:
              cardStyle === 'rounded'
                ? '24px'
                : cardStyle === 'square'
                  ? '0px'
                  : '24px',
            overflow: 'hidden',
            background: isDarkMode
              ? 'rgba(35,39,47,0.85)'
              : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            boxShadow:
              '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            position: 'relative',
            fontFamily: settings?.theme?.fontFamily,
            fontSize: settings?.theme?.fontSize,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <CardContent
            sx={{
              p: 3.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              height: '100%',
              position: 'relative',
            }}
          >
            {/* Status badge, top right */}
            <Chip
              label={
                room.status
                  ? room.status.charAt(0).toUpperCase() + room.status.slice(1)
                  : 'Available'
              }
              size="small"
              sx={{
                ...getStatusStyles(room.status || 'available'),
                position: 'absolute',
                top: 16,
                right: 16,
                textTransform: 'capitalize',
                fontWeight: 'bold',
                fontSize: '0.95em',
                letterSpacing: 0.2,
                zIndex: 2,
                opacity: 0.92,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            {/* Room number */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: isDarkMode
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(35,39,47,0.95)',
                fontFamily: settings?.theme?.fontFamily,
                fontSize: (settings?.theme?.fontSize || 20) + 12,
                mb: 1,
                mt: 2,
                letterSpacing: 1.5,
                textShadow: isDarkMode
                  ? '0 2px 8px rgba(0,0,0,0.18)'
                  : '0 2px 8px rgba(var(--app-primary-rgb),0.08)',
              }}
            >
              {room.roomNumber}
            </Typography>
            {/* Room type/title */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              {getRoomTypeIcon(room.type)}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: accentColor,
                  fontFamily: settings?.theme?.fontFamily,
                  fontSize: settings?.theme?.fontSize,
                  opacity: 0.9,
                  ml: 1,
                }}
              >
                {getRoomTypeLabel(room.type)}
              </Typography>
            </Box>
            {/* Price */}
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: isDarkMode ? accentColor : 'primary.main',
                background: isDarkMode
                  ? undefined
                  : 'linear-gradient(45deg, #2196F3, #21CBF3)',
                backgroundClip: isDarkMode ? undefined : 'text',
                textFillColor: isDarkMode ? undefined : 'transparent',
                mb: 1,
              }}
            >
              {currencySym()}
              {/* Category base price + configured GST (single source of truth) */}
              {(displayPrice * (1 + liveRoomGstFraction())).toFixed(2)}{' '}
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                /night
              </Typography>
            </Typography>
            {/* Floor & Capacity */}
            <Box
              sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOnIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Floor {room.floor}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PeopleIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {displayOccupancy} {displayOccupancy === 1 ? 'guest' : 'guests'}
                </Typography>
              </Box>
            </Box>
            {/* Amenities Preview (from category) */}
            {displayAmenities.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5, fontWeight: 500 }}
                >
                  Amenities:
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    justifyContent: 'center',
                  }}
                >
                  {displayAmenities.slice(0, 3).map((amenity, index) => (
                    <Chip
                      key={index}
                      icon={amenityIcons[amenity] || <StarIcon />}
                      label={amenity}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, opacity: 0.85 }}
                    />
                  ))}
                  {displayAmenities.length > 3 && (
                    <Chip
                      label={`+${displayAmenities.length - 3} more`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, opacity: 0.7 }}
                    />
                  )}
                </Box>
              </Box>
            )}
            {/* Action Buttons (hover only, CSS transition, staggered) */}
            <Box
              className="room-action-buttons"
              sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 2,
                mt: 2,
                zIndex: 10,
                position: 'relative',
                // No pointer events or opacity by default, handled per-child
              }}
            >
              {[
                // Array of button configs for mapping
                {
                  key: 'details',
                  tooltip: 'Room Details',
                  onClick: () => handleShowDetails(room),
                  icon: <InfoIcon fontSize="small" />,
                  color: 'primary.main',
                  bg: 'rgba(33, 150, 243, 0.08)',
                },
                {
                  key: 'maint',
                  tooltip:
                    room.status === 'maintenance'
                      ? 'Mark as Available'
                      : 'Mark for Maintenance',
                  onClick: () =>
                    handleMaintenanceToggle(room._id || room.id, room.status),
                  icon: <RepairIcon fontSize="small" />,
                  color: 'warning.main',
                  bg: 'rgba(255, 152, 0, 0.08)',
                },
                {
                  key: 'clean',
                  tooltip:
                    room.status === 'cleaning'
                      ? 'Mark as Available'
                      : 'Mark for Cleaning',
                  onClick: () =>
                    handleCleaningToggle(room._id || room.id, room.status),
                  icon: <CleaningIcon fontSize="small" />,
                  color: 'info.main',
                  bg: 'rgba(3, 169, 244, 0.08)',
                },
              ].map((btn, i) => (
                <Tooltip title={btn.tooltip} arrow key={btn.key}>
                  <IconButton
                    size="small"
                    onClick={btn.onClick}
                    sx={{
                      color: btn.color,
                      background: btn.bg,
                      opacity: 0,
                      pointerEvents: 'none',
                      transform: 'translateY(12px)',
                      transition: `opacity 0.38s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms, transform 0.38s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms`,
                      '.MuiCardContent-root:hover &': {
                        opacity: 1,
                        pointerEvents: 'auto',
                        transform: 'translateY(0)',
                      },
                    }}
                  >
                    {btn.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    );
  // Closures read roomCategories (price/amenities/icons), the dark-mode flag,
  // card shape, accent colour and the font tokens — rebuild only when those
  // change. The handlers it also closes over only call stable setState / memoised
  // fetchers, so a slightly stale capture of them is safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [roomCategories, isDarkMode, cardStyle, accentColor, settings?.theme?.fontFamily, settings?.theme?.fontSize]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <Box>
        {/* Page glass surface is provided by PageLayout — no per-page wrapper. */}
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 4,
              p: 3,
              borderRadius: 4,
              background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
              backdropFilter: 'var(--app-blur)',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              boxShadow:
                '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <HotelIcon
                sx={{ fontSize: 42, color: accentColor, fontWeight: 300 }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily:
                      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontWeight: 600,
                    letterSpacing: '-0.5px',
                    color: isDarkMode ? '#f3f4f6' : '#23272f',
                    lineHeight: 1.2,
                  }}
                >
                  Room Management
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily:
                      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#888',
                    letterSpacing: '0.2px',
                    fontWeight: 500,
                  }}
                >
                  Manage and monitor all hotel rooms
                </Typography>
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* Room Categories Configuration Alert */}
        {!loading && roomCategories.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3,
                borderRadius: 3,
                background: alpha(theme.palette.info.main, 0.1),
                border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                '& .MuiAlert-icon': {
                  color: theme.palette.info.main,
                },
              }}
              action={
                <Button 
                  color="info" 
                  size="small" 
                  onClick={() => window.location.href = '/settings'}
                  sx={{ fontWeight: 600 }}
                >
                  Go to Settings
                </Button>
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                No room categories configured. Please set up room categories in Settings → Room Management to enable proper room filtering and display.
              </Typography>
            </Alert>
          </motion.div>
        )}

        {/* Filter Section */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Box
            sx={{
              mb: 4,
              p: 2.5,
              background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
              backdropFilter: 'var(--app-blur)',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              borderRadius: 3,
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Search by Room Number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{ mr: 1, display: 'flex', alignItems: 'center' }}
                      >
                        <SearchIcon color="action" />
                      </Box>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Filter by Type</InputLabel>
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    label="Filter by Type"
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#ffffff',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                          borderRadius: 2,
                          border: '2px solid #e0e0e0',
                          opacity: 1,
                          '& .MuiMenuItem-root': {
                            backgroundColor: '#ffffff',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                            },
                            '&.Mui-selected': {
                              backgroundColor: '#e3f2fd',
                              '&:hover': {
                                backgroundColor: '#bbdefb',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    {Array.isArray(roomCategories) && roomCategories.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                          No room categories available. Please configure in Settings.
                        </Typography>
                      </MenuItem>
                    ) : (
                      Array.isArray(roomCategories) && roomCategories.map((category) => {
                        const displayName = category.name 
                          ? category.name
                          : `${(category.id || category._id || '').charAt(0).toUpperCase() + (category.id || category._id || '').slice(1).replace(/[_-]/g, ' ')}`;
                        
                        return (
                          <MenuItem key={category.id || category._id} value={category.id || category._id}>
                            {displayName}
                          </MenuItem>
                        );
                      })
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Filter by Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Filter by Status"
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#ffffff',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                          borderRadius: 2,
                          border: '2px solid #e0e0e0',
                          opacity: 1,
                          '& .MuiMenuItem-root': {
                            backgroundColor: '#ffffff',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                            },
                            '&.Mui-selected': {
                              backgroundColor: '#e3f2fd',
                              '&:hover': {
                                backgroundColor: '#bbdefb',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    {roomStatus.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="text"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  }}
                  sx={{ height: '100%' }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Box>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <CircularProgress size={60} sx={{ color: 'white' }} />
              </motion.div>
              <Typography
                variant="h6"
                sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.8)' }}
              >
                Loading rooms...
              </Typography>
            </Box>
          </motion.div>
        )}

        {/* Rooms Grid */}
        {!loading && (
          // Plain grid — no opacity/translate crossfade here. The whole page
          // already fades in once via PageTransition; an extra animation on the
          // container wrapping every glass card just re-rasterized their blur
          // each frame (compounding the navigation flicker). Filtering now
          // updates instantly.
          <Grid container spacing={3}>
            {filteredRooms.map((room) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                key={room._id || room.id}
              >
                <RoomCard room={room} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Empty State */}
        {!loading && filteredRooms.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '40vh',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  repeatType: 'loop',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.8)' }}
                >
                  No rooms found.
                </Typography>
              </motion.div>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Room Details Dialog */}
      <FormDialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        icon={<HotelIcon />}
        eyebrow="Inventory"
        title="Room Details"
        hideCancel
        submitLabel="Close"
        extraActions={(
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', pl: 0.5 }}>
            Rooms are created &amp; edited in Settings → Room categories.
          </Typography>
        )}
      >
          {selectedRoom ? (
            <FormSection>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Room {selectedRoom.roomNumber}
                  </Typography>
                  <Chip
                    label={selectedRoom.status}
                    size="small"
                    sx={{
                      ...getStatusStyles(selectedRoom.status),
                      textTransform: 'capitalize',
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                  <Typography
                    variant="h6"
                    color="primary"
                    sx={{ fontWeight: 'bold' }}
                  >
                    {currencySym()}{(() => {
                      // Price comes from the room's category (single source of truth).
                      const category = findRoomCategory(selectedRoom);
                      const base = category?.basePrice ?? selectedRoom.pricePerNight ?? 0;
                      return (base * (1 + liveRoomGstFraction())).toFixed(2);
                    })()}
                    <Typography
                      variant="body2"
                      component="span"
                      color="text.secondary"
                    >
                      {' '}
                      /night
                    </Typography>
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{ fontWeight: 'medium' }}
                  >
                    {getRoomTypeLabel(selectedRoom.type)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedRoom.description}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon />
                    <Typography>
                      {(() => {
                        const category = findRoomCategory(selectedRoom);
                        const max = category?.maxOccupancy
                          ?? (selectedRoom.capacity?.adults !== undefined
                            ? selectedRoom.capacity.adults
                            : selectedRoom.capacity)
                          ?? 2;
                        return `${max} ${max === 1 ? 'guest' : 'guests'}`;
                      })()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon />
                    <Typography>Floor {selectedRoom.floor}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography
                    variant="subtitle1"
                    sx={{ mt: 2, mb: 1, fontWeight: 'medium' }}
                  >
                    Amenities
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {(() => {
                      const category = findRoomCategory(selectedRoom);
                      const list = (category?.amenities?.length ? category.amenities : selectedRoom.amenities) || [];
                      return list.map((amenity) => (
                        <Chip
                          key={amenity}
                          label={amenity}
                          variant="outlined"
                          icon={amenityIcons[amenity]}
                        />
                      ));
                    })()}
                  </Box>
                </Grid>
              </Grid>
            </FormSection>
          ) : (
            <Typography>No room selected.</Typography>
          )}
      </FormDialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </motion.div>
  );
};

export default Rooms;
