import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  _Paper, 
  Grid, 
  CircularProgress,
  Tooltip,
  IconButton,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import { format, addDays, startOfDay, differenceInDays, parseISO } from 'date-fns';
import PageLayout from '../../components/layout/PageLayout';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HotelIcon from '@mui/icons-material/Hotel';
import RefreshIcon from '@mui/icons-material/Refresh';

const Reservations = () => {
  const theme = useTheme();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [daysToShow, setDaysToShow] = useState(14); // Show 2 weeks by default
  
  // Generate array of dates to display
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.bookings.getAll();
      // Ensure response.data is an array with defensive handling
      const bookingsArray = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBookings(bookingsArray);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching bookings:', error);
      setBookings([]); // Set empty array on error
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.rooms.getAll();
      // Ensure response.data is an array with defensive handling
      const roomsArray = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const roomsData = roomsArray.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
      setRooms(roomsData);
      

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching rooms:', error);
      setRooms([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, [fetchBookings, fetchRooms]);

  // Listen for booking and housekeeping events from other components
  useEffect(() => {
    const handleBookingEvent = (event) => {
      const { action } = event.detail;
      if (action === 'booking_created' || action === 'booking_updated' || action === 'booking_deleted' || action === 'booking_completed') {
        // Refresh both bookings and rooms data when booking events occur
        fetchBookings();
        fetchRooms();
      }
    };

    const handleHousekeepingEvent = (event) => {
      const { action } = event.detail;
      if (action === 'task_completed' || action === 'room_status_updated') {
        // Refresh rooms data when housekeeping tasks are completed
        fetchRooms();
      }
    };

    window.addEventListener('bookingEvent', handleBookingEvent);
    window.addEventListener('housekeepingEvent', handleHousekeepingEvent);

    return () => {
      window.removeEventListener('bookingEvent', handleBookingEvent);
      window.removeEventListener('housekeepingEvent', handleHousekeepingEvent);
    };
  }, [fetchBookings, fetchRooms]);

  const handlePreviousPeriod = () => {
    setStartDate(addDays(startDate, -daysToShow));
  };

  const handleNextPeriod = () => {
    setStartDate(addDays(startDate, daysToShow));
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Calculate booking position and width
  const getBookingStyle = (booking) => {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    
    // Calculate how many days from the start date this booking begins
    const startOffset = Math.max(0, differenceInDays(checkIn, startDate));
    
    // Calculate total duration visible in our current view
    const visibleDuration = Math.min(
      differenceInDays(checkOut, checkIn) + 1,
      daysToShow - startOffset,
    );
    
    // Base style
    const baseStyle = {
      position: 'absolute',
      left: `${(startOffset / daysToShow) * 100}%`,
      width: `${(visibleDuration / daysToShow) * 100}%`,
      height: '70%',
      top: '15%',
      px: 1,
      backgroundColor: getStatusColor(booking.bookingStatus).bgColor || '#4caf50',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      color: '#fff',
      fontWeight: 600,
      fontSize: '0.72rem',
      letterSpacing: '0.01em',
      boxShadow: '0 4px 12px -4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
      cursor: 'pointer',
      zIndex: 1,
      border: '1px solid rgba(255,255,255,0.25)',
      transition: 'transform .15s ease, box-shadow .15s ease, filter .15s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 22px -6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
        filter: 'brightness(1.06)',
        zIndex: 3,
      },
    };
    
    // Add special styling for checked out bookings
    if (booking.bookingStatus === 'Checked Out' || booking.bookingStatus === 'Checkout' || booking.bookingStatus === 'Completed') {
      baseStyle.opacity = 0.7;
      baseStyle.border = '2px dashed rgba(255,255,255,0.5)';
      // Make it clear this room is now available
      baseStyle.width = '50%'; // Show only half the original width
      baseStyle.backgroundColor = '#9e9e9e'; // Gray color to indicate completed
    }
    
    return baseStyle;
  };

  // Filter bookings to only show active ones for room status determination
  const getActiveBookingsForRoom = (roomId) => {
    // Ensure bookings is always an array
    const bookingsArray = Array.isArray(bookings) ? bookings : [];
    return bookingsArray.filter(booking => {
      // Handle both populated and non-populated roomId
      const bookingRoomId = booking.roomId?._id || booking.roomId;
      const isRoomMatch = bookingRoomId === roomId;
      const isActiveStatus = !['Checked Out', 'Checkout', 'Completed', 'Cancelled'].includes(booking.bookingStatus);
      
      // Additional date-based filtering to ensure booking is actually current
      if (isRoomMatch && isActiveStatus) {
        const today = new Date();
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        
        // Set time to start/end of day for proper comparison
        today.setHours(0, 0, 0, 0);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(23, 59, 59, 999);
        
        // Booking is active if today is between check-in and check-out dates
        return checkIn <= today && checkOut >= today;
      }
      
      return isRoomMatch && isActiveStatus;
    });
  };

  // Get all bookings for a specific room (including completed ones for display)
  const getAllBookingsForRoom = (roomId) => {
    // Ensure bookings is always an array
    const bookingsArray = Array.isArray(bookings) ? bookings : [];
    return bookingsArray.filter(booking => {
      // Handle both populated and non-populated roomId
      const bookingRoomId = booking.roomId?._id || booking.roomId;
      return bookingRoomId === roomId;
    });
  };


  // Update the getStatusColor function to handle all possible booking statuses
  const getStatusColor = (status) => {
    switch (status) {
    case 'Confirmed':
      return { bgColor: '#4caf50', color: '#fff' };
    case 'Pending':
      return { bgColor: '#ff9800', color: '#fff' };
    case 'Cancelled':
      return { bgColor: '#f44336', color: '#fff' };
    case 'Completed':
      return { bgColor: '#2196f3', color: '#fff' };
    case 'Checked Out':
      return { bgColor: '#2196f3', color: '#fff' };
    case 'Checkout':
      return { bgColor: '#2196f3', color: '#fff' };
    default:
      return { bgColor: '#9e9e9e', color: '#fff' };
    }
  };

  return (
    <PageLayout>
      {/* Header Section */}
      <Box sx={{
        flexWrap: 'wrap',
        gap: 2,
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
        }}>
          <CalendarMonthIcon sx={{ 
            fontSize: 42,
            color: '#23272f',
            fontWeight: 300,
          }} />
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
          }}>
            <Typography variant="h4" sx={{
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              letterSpacing: '-0.5px',
              color: 'var(--app-primary)',
              lineHeight: 1.2,
            }}>
              Room Reservations
            </Typography>
            <Typography variant="caption" sx={{
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.2px',
              fontWeight: 500,
            }}>
              Calendar View
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Date range pill */}
          <Box
            sx={{
              px: 1.75,
              py: 0.9,
              borderRadius: 999,
              background: 'rgba(var(--app-primary-rgb), 0.12)',
              color: 'var(--app-primary)',
              border: '1px solid rgba(var(--app-primary-rgb), 0.25)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              display: { xs: 'none', md: 'inline-flex' },
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CalendarMonthIcon sx={{ fontSize: 16 }} />
            {format(startDate, 'd MMM')} — {format(addDays(startDate, daysToShow - 1), 'd MMM yyyy')}
          </Box>

          {/* Range toggle — segmented pill */}
          <Box
            sx={{
              display: 'inline-flex',
              p: 0.5,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            }}
          >
            {[
              { label: 'Week',    value: 7 },
              { label: '2 Weeks', value: 14 },
              { label: 'Month',   value: 30 },
            ].map((opt) => {
              const selected = daysToShow === opt.value;
              return (
                <Box
                  key={opt.value}
                  component="button"
                  type="button"
                  onClick={() => setDaysToShow(opt.value)}
                  sx={{
                    px: 1.75,
                    py: 0.6,
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: selected ? '#fff' : 'text.secondary',
                    background: selected ? 'var(--app-primary)' : 'transparent',
                    boxShadow: selected ? '0 6px 14px -6px rgba(var(--app-primary-rgb), 0.55)' : 'none',
                    transition: 'all .15s ease',
                    '&:hover': {
                      background: selected ? 'var(--app-primary)' : 'rgba(var(--app-primary-rgb), 0.08)',
                    },
                  }}
                >
                  {opt.label}
                </Box>
              );
            })}
          </Box>

          {/* Nav arrows + refresh as icon pill */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              p: 0.4,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            }}
          >
            <Tooltip title="Previous">
              <IconButton size="small" onClick={handlePreviousPeriod} sx={{ color: 'text.secondary' }}>
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box
              component="button"
              type="button"
              onClick={() => setStartDate(startOfDay(new Date()))}
              sx={{
                px: 1.5,
                py: 0.4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--app-primary)',
                borderRadius: 999,
                '&:hover': { background: 'rgba(var(--app-primary-rgb), 0.1)' },
              }}
            >
              Today
            </Box>
            <Tooltip title="Next">
              <IconButton size="small" onClick={handleNextPeriod} sx={{ color: 'text.secondary' }}>
                <NavigateNextIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Tooltip title="Refresh">
            <IconButton
              onClick={() => { fetchBookings(); fetchRooms(); }}
              sx={{
                background: 'var(--app-primary)',
                color: '#fff',
                boxShadow: '0 6px 14px -6px rgba(var(--app-primary-rgb), 0.55)',
                '&:hover': { background: 'var(--app-primary)', filter: 'brightness(1.08)' },
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{
          background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          minHeight: '80vh',
          p: { xs: 2, md: 6 },
          borderRadius: 4,
          width: '100%',
          color: '#23272f',
        }}>
          <Box sx={{ width: '100%' }}>
            {/* Header with dates */}
            <Grid
              container
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 3))',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)',
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                overflow: 'hidden',
                mb: 1.5,
              }}
            >
              {/* Room column header */}
              <Grid
                sx={{
                  borderRight: `1px solid ${theme.palette.divider}`,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
                size={2}>
                <HotelIcon sx={{ fontSize: 18, color: 'var(--app-primary)' }} />
                <Typography sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}>
                  Rooms
                </Typography>
              </Grid>

              {/* Date headers */}
              <Grid size={10}>
                <Grid container>
                  {dates.map((date, index) => {
                    const today = isToday(date);
                    const weekend = isWeekend(date);
                    return (
                      <Grid
                        key={index}
                        sx={{
                          width: `${100 / daysToShow}%`,
                          p: 1,
                          textAlign: 'center',
                          borderRight: index < dates.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          bgcolor: today
                            ? 'rgba(var(--app-primary-rgb), 0.15)'
                            : (weekend ? 'rgba(0,0,0,0.025)' : 'transparent'),
                        }}>
                        <Typography sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: today ? 'var(--app-primary)' : 'text.secondary',
                        }}>
                          {format(date, 'EEE')}
                        </Typography>
                        <Typography sx={{
                          fontSize: today ? 20 : 18,
                          fontWeight: 800,
                          color: today ? 'var(--app-primary)' : 'text.primary',
                          lineHeight: 1.1,
                          mt: 0.25,
                        }}>
                          {format(date, 'dd')}
                        </Typography>
                        <Typography sx={{
                          fontSize: 9.5,
                          color: 'text.secondary',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          mt: 0.25,
                        }}>
                          {format(date, 'MMM')}
                        </Typography>
                        {today && (
                          <Box sx={{
                            width: 6,
                            height: 6,
                            mx: 'auto',
                            mt: 0.5,
                            borderRadius: '50%',
                            bgcolor: 'var(--app-primary)',
                            boxShadow: '0 0 6px var(--app-primary)',
                          }} />
                        )}
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            </Grid>
            
            {/* Room rows */}
            {rooms.map((room) => {
              // Check if room has any active bookings and use actual room status
              const activeBookings = getActiveBookingsForRoom(room._id);
              const allRoomBookings = getAllBookingsForRoom(room._id);
              
              // Determine room status with improved logic
              let roomStatus = room.status || 'available';
              
              // Trust the database status first, but validate against bookings for consistency
              // Only override if there's a clear mismatch and the room status is 'available' or 'occupied'
              if (activeBookings.length > 0 && roomStatus === 'available') {
                // If there are active bookings but room shows available, it should be occupied
                roomStatus = 'occupied';
              }
              
              // Don't automatically change status if room is in 'cleaning' or 'maintenance'
              // These statuses should only be changed manually or by housekeeping system
              if (activeBookings.length === 0 && roomStatus === 'occupied') {
                // If no active bookings and room is occupied, it should be available
                // But we'll keep this as a visual indicator rather than forcing a change
                // The backend/housekeeping system should handle the actual status updates
              }
              
              // Helper function to get room status color
              const getStatusColor = (status) => {
                switch (status) {
                case 'available':
                  return 'success';
                case 'occupied':
                  return 'error';
                case 'cleaning':
                  return 'info';
                case 'maintenance':
                  return 'warning';
                default:
                  return 'default';
                }
              };
              
              return (
                <Grid
                  container
                  key={room._id}
                  sx={{
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    transition: 'background-color .15s ease',
                    '&:hover': { background: 'rgba(var(--app-primary-rgb), 0.04)' },
                  }}
                >
                  {/* Room info */}
                  <Grid
                    sx={{
                      p: 1.5,
                      borderRight: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                    size={2}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(var(--app-primary-rgb), 0.1)',
                        color: 'var(--app-primary)',
                        fontWeight: 800,
                        fontSize: 13,
                        letterSpacing: '-0.01em',
                        flexShrink: 0,
                        border: '1px solid rgba(var(--app-primary-rgb), 0.18)',
                      }}
                    >
                      {room.roomNumber}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>
                        {room.roomType || room.type}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }} noWrap>
                        {currencySym()}{(room.pricePerNight || 0).toLocaleString('en-IN')}/night
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        useFlexGap
                        sx={{
                          alignItems: "center",
                          flexWrap: "wrap",
                          mt: 0.5
                        }}>
                        <Chip
                          label={roomStatus}
                          size="small"
                          color={getStatusColor(roomStatus)}
                          sx={{
                            height: 18,
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            '& .MuiChip-label': { px: 0.85 },
                          }}
                        />
                        {activeBookings.length === 0 && room.status === 'occupied' && (
                          <Tooltip title="No active bookings but marked occupied">
                            <Chip label="Check" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: 9, '& .MuiChip-label': { px: 0.85 } }} />
                          </Tooltip>
                        )}
                        {activeBookings.length > 0 && (
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>
                            · {activeBookings.length} active
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Grid>
                  {/* Calendar cells */}
                  <Grid size={10}>
                    <Box sx={{
                      display: 'flex',
                      height: '72px',
                      position: 'relative',
                    }}>
                      {/* Date cells */}
                      {dates.map((date, index) => (
                        <Box
                          key={index}
                          sx={{
                            width: `${100 / daysToShow}%`,
                            height: '100%',
                            borderRight: index < dates.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                            bgcolor: isToday(date)
                              ? 'rgba(var(--app-primary-rgb), 0.08)'
                              : (isWeekend(date) ? 'rgba(0,0,0,0.025)' : 'transparent'),
                          }}
                        />
                      ))}
                    
                      {/* Bookings for this room */}
                      {allRoomBookings.map(booking => {
                        const checkIn = new Date(booking.checkIn);
                        const checkOut = new Date(booking.checkOut);
                        
                        // Skip if booking is completely outside our date range
                        if (checkOut < startDate || checkIn > addDays(startDate, daysToShow - 1)) {
                          return null;
                        }
                        
                        return (
                          // Update the booking tooltip to show payment status more prominently
                          <Tooltip 
                            key={booking._id}
                            title={
                              <Box>
                                <Typography variant="subtitle2">{booking.guestName}</Typography>
                                <Typography variant="body2">
                                  {format(parseISO(booking.checkIn), 'dd MMM')} - {format(parseISO(booking.checkOut), 'dd MMM')}
                                </Typography>
                                <Typography variant="body2">
                                  Status: {booking.bookingStatus}
                                  {booking.paymentStatus === 'Paid' && ' (Paid)'}
                                </Typography>
                                <Typography variant="body2">Payment: {booking.paymentStatus}</Typography>
                                <Typography variant="body2">{currencySym()}{booking.totalAmount}</Typography>
                              </Box>
                            }
                          >
                            <Box 
                              sx={{
                                ...getBookingStyle(booking),
                                // Add a special border for paid bookings
                                ...(booking.paymentStatus === 'Paid' && {
                                  border: '2px solid #4caf50',
                                  boxShadow: '0 0 5px #4caf50',
                                }),
                              }}
                              onClick={() => window.location.href = `/bookings?id=${booking._id}`}
                            >
                              {booking.guestName}
                              {booking.paymentStatus === 'Paid' && ' ✓'}
                              {(booking.bookingStatus === 'Checked Out' || booking.bookingStatus === 'Checkout') && ' 🔚'}
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Grid>
                </Grid>
              );
            })}
          </Box>
        </Box>
      )}
    </PageLayout>
  );
};

export default Reservations;