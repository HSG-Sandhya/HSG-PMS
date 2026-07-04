import { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Grid,
  FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { differenceInDays, addDays } from 'date-fns';
import apiService from '../../api/index';
import { currencySym } from '../../utils/billing';

const WebsiteBookingForm = () => {
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [checkIn, setCheckIn] = useState(addDays(new Date(), 1));
  const [checkOut, setCheckOut] = useState(addDays(new Date(), 2));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [roomType, setRoomType] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  // Room types
  const roomTypes = [
    { id: 'standard', name: 'Standard Room', price: 2500 },
    { id: 'deluxe', name: 'Deluxe Room', price: 3500 },
    { id: 'suite', name: 'Executive Suite', price: 5000 },
    { id: 'family', name: 'Family Room', price: 4500 },
  ];

  // Calculate number of nights
  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  
  // Calculate total price
  const selectedRoom = roomTypes.find(room => room.id === roomType);
  const totalPrice = selectedRoom ? selectedRoom.price * nights : 0;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!firstName || !lastName || !email || !phone || !roomType) {
      setSnackbar({
        open: true,
        message: 'Please fill all required fields',
        severity: 'error',
      });
      return;
    }
    
    // Validate dates
    if (nights < 1) {
      setSnackbar({
        open: true,
        message: 'Check-out date must be after check-in date',
        severity: 'error',
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Create booking data
      const bookingData = {
        firstName,
        lastName,
        email,
        phone,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        adults,
        children,
        roomType,
        roomTypeName: selectedRoom.name,
        nights,
        totalPrice,
        specialRequests,
        status: 'pending', // Initial status is pending
      };
      
      // Submit booking to API
      await apiService.website.createBooking(bookingData);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Booking request submitted successfully! We will confirm your booking shortly.',
        severity: 'success',
      });
      
      // Reset form
      resetForm();
      
      setLoading(false);
    } catch (error) {
      console.error('Error submitting booking:', error);
      setSnackbar({
        open: true,
        message: 'Failed to submit booking. Please try again.',
        severity: 'error',
      });
      setLoading(false);
    }
  };
  
  // Reset form fields
  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCheckIn(addDays(new Date(), 1));
    setCheckOut(addDays(new Date(), 2));
    setAdults(1);
    setChildren(0);
    setRoomType('');
    setSpecialRequests('');
  };
  
  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: '100%' }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            borderRadius: 2,
            background: 'linear-gradient(to right, #ffffff, #f8f9fa)',
          }}
        >
          <Typography 
            variant="h4" 
            gutterBottom 
            sx={{ 
              fontWeight: 700, 
              color: '#1e3a8a',
              textAlign: 'center',
              mb: 3,
            }}
          >
            Book Your Stay at Hotel Sandhya Grand
          </Typography>
          
          <Divider sx={{ mb: 4 }} />
          
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid size={12}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#1e3a8a',
                    mb: 2,
                  }}
                >
                  Personal Information
                </Typography>
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField
                  fullWidth
                  required
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField
                  fullWidth
                  required
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField
                  fullWidth
                  required
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField
                  fullWidth
                  required
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              {/* Booking Details */}
              <Grid size={12}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#1e3a8a',
                    mt: 2,
                    mb: 2,
                  }}
                >
                  Booking Details
                </Typography>
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <DatePicker
                  label="Check-in Date"
                  value={checkIn}
                  onChange={(newValue) => setCheckIn(newValue)}
                  minDate={addDays(new Date(), 1)}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <DatePicker
                  label="Check-out Date"
                  value={checkOut}
                  onChange={(newValue) => setCheckOut(newValue)}
                  minDate={addDays(checkIn, 1)}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <FormControl fullWidth required>
                  <InputLabel>Room Type</InputLabel>
                  <Select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    label="Room Type"
                    MenuProps={{ slotProps: {
                      paper: { sx: { backgroundColor: '#fff', maxHeight: 300 } }
                    } }}
                  >
                    {roomTypes.map((room) => (
                      <MenuItem key={room.id} value={room.id}>
                        {room.name} - {currencySym()}{room.price} per night
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}>
                <FormControl fullWidth>
                  <InputLabel>Adults</InputLabel>
                  <Select
                    value={adults}
                    onChange={(e) => setAdults(e.target.value)}
                    label="Adults"
                    MenuProps={{ slotProps: {
                      paper: { sx: { backgroundColor: '#fff', maxHeight: 300 } }
                    } }}
                  >
                    {[1, 2, 3, 4].map((num) => (
                      <MenuItem key={num} value={num}>{num}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}>
                <FormControl fullWidth>
                  <InputLabel>Children</InputLabel>
                  <Select
                    value={children}
                    onChange={(e) => setChildren(e.target.value)}
                    label="Children"
                    MenuProps={{ slotProps: {
                      paper: { sx: { backgroundColor: '#fff', maxHeight: 300 } }
                    } }}
                  >
                    {[0, 1, 2, 3].map((num) => (
                      <MenuItem key={num} value={num}>{num}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Special Requests"
                  multiline
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              {/* Booking Summary */}
              {roomType && nights > 0 && (
                <Grid size={12}>
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: 3, 
                      mt: 2, 
                      bgcolor: '#f0f7ff',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                      Booking Summary
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <Typography variant="body1">Room Type:</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body1" sx={{
                          fontWeight: "medium"
                        }}>{selectedRoom.name}</Typography>
                      </Grid>
                      
                      <Grid size={6}>
                        <Typography variant="body1">Check-in:</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body1" sx={{
                          fontWeight: "medium"
                        }}>
                          {checkIn.toLocaleDateString()}
                        </Typography>
                      </Grid>
                      
                      <Grid size={6}>
                        <Typography variant="body1">Check-out:</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body1" sx={{
                          fontWeight: "medium"
                        }}>
                          {checkOut.toLocaleDateString()}
                        </Typography>
                      </Grid>
                      
                      <Grid size={6}>
                        <Typography variant="body1">Number of Nights:</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body1" sx={{
                          fontWeight: "medium"
                        }}>{nights}</Typography>
                      </Grid>
                      
                      <Grid size={6}>
                        <Typography variant="body1">Price per Night:</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body1" sx={{
                          fontWeight: "medium"
                        }}>{currencySym()}{selectedRoom.price}</Typography>
                      </Grid>
                      
                      <Grid size={6}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                          Total Amount:
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                          {currencySym()}{totalPrice}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              )}
              
              <Grid sx={{ mt: 3, textAlign: 'center' }} size={12}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    px: 5,
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    bgcolor: '#1e3a8a',
                    '&:hover': {
                      bgcolor: '#152a60',
                    },
                  }}
                >
                  {loading ? 'Processing...' : 'Book Now'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </LocalizationProvider>
  );
};

export default WebsiteBookingForm;