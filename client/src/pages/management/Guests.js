import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../../api';
import { formatIdentityByType, identityPlaceholder, identityError } from '../../components/forms/bookingForm/idFormatters';
import {
  Grid, _Paper, Typography, Box, CircularProgress,
  Button, Dialog, DialogContent,
  DialogActions, TextField, MenuItem, IconButton,
  Snackbar, Alert, InputAdornment,
  Avatar, Stack, useTheme, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person,
  Phone,
  Email,
  Home,
  Badge as BadgeIcon,
  EventNote as EventNoteIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import PageLayout from '../../components/layout/PageLayout';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
  labelSx,
  valueSx,
} from '../../components/forms/formStyles';

// Best-effort PIN-code → district/state lookup (same providers as the booking
// form). Returns null when both providers fail so the user can type manually.
const lookupPincode = async (pincode) => {
  const timeout = 5000;
  try {
    const { data } = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, { timeout });
    if (data?.[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { district: po.District, state: po.State };
    }
  } catch { /* fall through */ }
  try {
    const { data } = await axios.get(`https://api.zippopotam.us/in/${pincode}`, { timeout });
    const place = data?.places?.[0];
    if (place) return { district: place['place name'], state: place.state };
  } catch { /* both failed */ }
  return null;
};

// Parse a stored one-line address back into structured parts. Anchored from the
// RIGHT so it survives a variable number of comma parts: Aadhaar KYC produces
// 6+ (house, street, area, sub-district, district, state, pincode), and the old
// fixed-position [0..4] parse shoved the pincode/district/state into the wrong
// fields. Here the reliable tail — pincode, then state, district, area — is
// pulled off the end, and whatever remains is the street line.
const parseAddress = (address) => {
  const parts = String(address || '').split(',').map((s) => s.trim()).filter(Boolean);
  const pincode = /^\d{6}$/.test(parts[parts.length - 1] || '') ? parts.pop() : '';
  const state = parts.length ? parts.pop() : '';
  const district = parts.length ? parts.pop() : '';
  const area = parts.length ? parts.pop() : '';
  const streetName = parts.join(', ');
  return { streetName, area, district, state, pincode };
};

// Load the form's address fields for a guest. Prefer the structured fields when
// present (new records round-trip losslessly); fall back to parsing the legacy
// single-line `address` string for older records.
const addressFields = (g) => {
  if (g && (g.streetName || g.area || g.district || g.state || g.pincode)) {
    return {
      streetName: g.streetName || '', area: g.area || '', district: g.district || '',
      state: g.state || '', pincode: g.pincode || '',
    };
  }
  return parseAddress(g?.address);
};

// Join the structured address parts back into one stored string.
const joinAddress = (f) => [f.streetName, f.area, f.district, f.state, f.pincode]
  .map((s) => String(s || '').trim()).filter(Boolean).join(', ');

// Keep only the 10-digit local part of a phone number (drops a +91 prefix).
const phoneLocal = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// 15-character GSTIN: 2-digit state code + 10-char PAN + entity + Z + checksum.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const DetailItem = ({ label, value, isDarkMode, full }) => (
  <Grid
    size={{
      xs: 12,
      sm: full ? 12 : 6
    }}>
    <Typography sx={labelSx(isDarkMode)}>{label}</Typography>
    <Typography sx={{ ...valueSx(isDarkMode), mt: 0.25, whiteSpace: 'pre-wrap' }}>
      {value || '—'}
    </Typography>
  </Grid>
);

const textFieldSx = (isDarkMode) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    backgroundColor: isDarkMode ? 'rgba(30,41,59,0.45)' : 'rgba(255,255,255,0.65)',
    transition: 'all 0.2s ease',
    '& fieldset': {
      borderColor: isDarkMode ? 'rgba(148,163,184,0.22)' : 'rgba(226,232,240,0.95)',
    },
    '&:hover fieldset': { borderColor: 'rgba(var(--app-primary-rgb),0.5)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--app-primary)', borderWidth: '1.5px' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--app-primary)' },
});

// Helper function to normalize identity type values
const normalizeIdentityType = (value) => {
  if (!value) return 'Aadhar';
  
  const normalizedValue = value.toString().toLowerCase();
  
  if (normalizedValue.includes('aadhar') || normalizedValue.includes('aadhaar')) {
    return 'Aadhar';
  }
  if (normalizedValue.includes('passport')) {
    return 'Passport';
  }
  if (normalizedValue.includes('driving') || normalizedValue.includes('license')) {
    return 'DrivingLicense';
  }
  if (normalizedValue.includes('voter')) {
    return 'VoterID';
  }
  
  // If it's already a valid option, return as is
  const validOptions = ['Aadhar', 'Passport', 'DrivingLicense', 'VoterID'];
  if (validOptions.includes(value)) {
    return value;
  }
  
  // Default fallback
  return 'Aadhar';
};

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  gender: '',
  age: '',
  // Structured address (same shape as the booking dialog); stored concatenated.
  streetName: '',
  area: '',
  district: '',
  state: '',
  pincode: '',
  identityType: 'Aadhar',
  identityNumber: '',
  nationality: 'Indian',
  companyName: '',
  gstNumber: '',
  specialNotes: '',
};

const Guests = ({ onSelectGuest }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [bookingListener, setBookingListener] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsGuest, setDetailsGuest] = useState(null);
  const [filter, setFilter] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [gstLoading, setGstLoading] = useState(false);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedGuest(null);
    setFormData(initialFormData);
  }, []);

  const handleOpenDialog = useCallback((guest = null) => {
    if (guest) {
      // Ensure all form fields have defined values
      setSelectedGuest(guest);
      setFormData({
        name: guest.name || '',
        email: guest.email || '',
        phone: phoneLocal(guest.phone),
        gender: guest.gender || '',
        age: guest.age || '',
        ...addressFields(guest),
        identityType: normalizeIdentityType(guest.identityType) || 'Aadhar',
        identityNumber: guest.identityNumber || '',
        nationality: guest.nationality || 'Indian',
        companyName: guest.companyName || '',
        gstNumber: guest.gstNumber || '',
        specialNotes: guest.specialNotes || '',
      });
    } else {
      setFormData(initialFormData);
    }
    setOpenDialog(true);
  }, []);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // Look up the GSTIN → registered company name + address, then auto-fill the
  // company field and the structured address fields. For a business guest the
  // GST-registered address is the authoritative one, so it replaces whatever is
  // in the address fields (the user can still edit afterwards).
  const handleFetchGst = useCallback(async () => {
    const gst = String(formData.gstNumber || '').replace(/\s+/g, '').toUpperCase();
    if (!GST_REGEX.test(gst)) {
      showSnackbar('Enter a valid 15-character GSTIN before fetching', 'error');
      return;
    }
    setGstLoading(true);
    try {
      const { data } = await api.gst.lookup(gst);
      const c = data?.data;
      if (!data?.success || !c) {
        throw new Error(data?.message || 'Could not fetch GST details');
      }
      const addr = c.address || {};
      setFormData((prev) => ({
        ...prev,
        gstNumber: gst,
        // Only fill the company name if the user hasn't typed one.
        companyName: prev.companyName?.trim() ? prev.companyName : (c.tradeName || c.legalName || ''),
        streetName: addr.street || prev.streetName,
        area: addr.area || prev.area,
        district: addr.district || prev.district,
        state: addr.state || prev.state,
        pincode: addr.pincode || prev.pincode,
      }));
      showSnackbar(
        c.demo
          ? 'Demo mode: sample company details filled (no GST provider configured)'
          : `Fetched: ${c.legalName || c.tradeName || gst}`,
        c.demo ? 'info' : 'success',
      );
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || 'Could not fetch GST details', 'error');
    } finally {
      setGstLoading(false);
    }
  }, [formData.gstNumber, showSnackbar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name?.trim() || !formData.phone?.trim()) {
      showSnackbar('Please fill all required fields', 'error');
      return;
    }
    if (phoneLocal(formData.phone).length !== 10) {
      showSnackbar('Enter a valid 10-digit phone number', 'error');
      return;
    }
    if (!formData.identityNumber?.trim()) {
      showSnackbar('Enter the identity number', 'error');
      return;
    }
    const idErr = identityError(formData.identityType, formData.identityNumber);
    if (idErr) {
      showSnackbar(idErr, 'error');
      return;
    }

    try {
      // Store phone with the +91 prefix and the address as one concatenated
      // string (the structured parts are for the form only).
      const payload = {
        ...formData,
        phone: `+91 ${phoneLocal(formData.phone)}`,
        address: joinAddress(formData),
      };
      if (selectedGuest?._id) {
        await api.guests.update(selectedGuest._id, payload);
      } else {
        await api.guests.create(payload);
      }

      await fetchGuests();
      handleCloseDialog();
      showSnackbar(selectedGuest ? 'Guest updated successfully' : 'Guest created successfully');
    } catch (error) {
      console.error('Error saving guest:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save guest', 'error');
    }
  };

  const handleDelete = async (guestId) => {
    if (!window.confirm('Are you sure you want to delete this guest?')) {return;}
    
    try {
      await api.guests.delete(guestId);
      await fetchGuests();
      showSnackbar('Guest deleted successfully');
    } catch (error) {
      console.error('Error deleting guest:', error);
      showSnackbar(error.response?.data?.message || 'Failed to delete guest', 'error');
    }
  };

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.guests.getAll();
      setGuests(response.data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
      showSnackbar('Failed to fetch guests', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  useEffect(() => {
    // Function to handle new bookings
    const handleNewBooking = (booking) => {
      // Check if guest already exists
      const existingGuest = guests.find(g => 
        g.email === booking.guestEmail || 
        (g.phone === booking.guestPhone && booking.guestPhone),
      );
      
      if (existingGuest) {
        // You might want to update the existing guest with new booking info
        return;
      }
      
      // Create a new guest from booking data
      const newGuest = {
        name: booking.guestName,
        email: booking.guestEmail,
        phone: booking.guestPhone || '',
        idType: booking.idType || 'Aadhar',
        idNumber: booking.idNumber || '',
        address: booking.address || '',
        city: booking.city || '',
        state: booking.state || '',
        country: booking.country || 'India',
        zipCode: booking.zipCode || '',
        bookingHistory: [booking._id],
        notes: `Created from booking #${booking.bookingNumber}`,
        vip: false,
        createdAt: new Date().toISOString(),
      };
      
      // Save the new guest
      api.guests.create(newGuest)
        .then(_response => {
          showSnackbar('Guest card created from booking', 'success');
          fetchGuests(); // Refresh the guest list
        })
        .catch(_error => {
          showSnackbar('Failed to create guest card', 'error');
        });
    };
    
    // Set up event listener for new bookings
    const setupBookingListener = () => {
      // Create a custom event listener for booking events
      const listener = (event) => {
        try {
          // Add proper null checks
          if (event && event.detail && event.detail.action === 'created' && event.detail.booking) {
            // Handle the booking synchronously instead of returning a promise
            handleNewBooking(event.detail.booking);
          }
          // Don't return anything from the listener
        } catch (error) {
          console.error('Error processing booking event:', error);
        }
      };
      
      window.addEventListener('hotelBookingCreated', listener);
      setBookingListener(listener);
      
      return listener;
    };
    
    const listener = setupBookingListener();
    
    // Clean up event listener
    return () => {
      if (bookingListener) {
        window.removeEventListener('hotelBookingCreated', bookingListener);
      } else if (listener) {
        window.removeEventListener('hotelBookingCreated', listener);
      }
    };
  }, [guests, fetchGuests, showSnackbar, bookingListener]); // Added bookingListener to dependencies

  // When loading guest data into the form
  useEffect(() => {
    if (selectedGuest) {
      setFormData({
        name: selectedGuest.name || '',
        email: selectedGuest.email || '',
        phone: phoneLocal(selectedGuest.phone),
        gender: selectedGuest.gender || '',
        age: selectedGuest.age || '',
        ...addressFields(selectedGuest),
        // Map the identity fields correctly and normalize values
        identityType: normalizeIdentityType(selectedGuest.identityType || selectedGuest.idType) || 'Aadhar',
        identityNumber: selectedGuest.identityNumber || selectedGuest.idNumber || '',
        nationality: selectedGuest.nationality || 'Indian',
        companyName: selectedGuest.companyName || '',
        gstNumber: selectedGuest.gstNumber || '',
        specialNotes: selectedGuest.specialNotes || selectedGuest.notes || '',
      });
    }
  }, [selectedGuest]);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Person sx={{ fontSize: 42, color: '#23272f', fontWeight: 300 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" sx={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--app-primary)', lineHeight: 1.2 }}>
        Guests Management
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2px', fontWeight: 500 }}>
              Guest Directory
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={primaryButtonSx}
        >
          New Guest
        </Button>
      </Box>
      {/* Filter input */}
      <Box sx={{ mb: 3, maxWidth: 400 }}>
        <TextField
          fullWidth
          label="Filter guests by name, email, or phone"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          variant="outlined"
          size="small"
        />
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (() => {
        const filteredGuests = guests.filter(guest => {
          const q = filter.trim().toLowerCase();
          if (!q) {return true;}
          return (
            (guest.name && guest.name.toLowerCase().includes(q)) ||
            (guest.email && guest.email.toLowerCase().includes(q)) ||
            (guest.phone && guest.phone.toLowerCase().includes(q))
          );
        });

        const headCellSx = {
          borderBottom: '1px solid rgba(148,163,184,0.18)',
          color: 'rgba(100,116,139,0.95)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          py: 1.5,
        };
        const bodyCellSx = {
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          color: '#23272f',
          py: 1.5,
        };

        return (
          <TableContainer
            sx={{
              borderRadius: 3,
              background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
              backdropFilter: 'var(--app-blur)',
              WebkitBackdropFilter: 'var(--app-blur)',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Guest</TableCell>
                  <TableCell sx={headCellSx}>Phone</TableCell>
                  <TableCell sx={headCellSx}>Email</TableCell>
                  <TableCell sx={headCellSx} align="center">Age</TableCell>
                  <TableCell sx={headCellSx} align="center">Gender</TableCell>
                  <TableCell sx={headCellSx} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ ...bodyCellSx, py: 5, color: 'rgba(100,116,139,0.9)' }}>
                      No guests found.
                    </TableCell>
                  </TableRow>
                ) : filteredGuests.map((guest) => (
                  <TableRow
                    key={guest._id}
                    hover
                    onClick={() => { setDetailsGuest(guest); setDetailsDialogOpen(true); }}
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb),0.06)' } }}
                  >
                    <TableCell sx={bodyCellSx}>
                      <Stack direction="row" spacing={1.5} sx={{
                        alignItems: "center"
                      }}>
                        <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(var(--app-primary-rgb),0.12)', color: 'var(--app-primary)' }}>
                          <Person fontSize="small" />
                        </Avatar>
                        <Typography sx={{ fontWeight: 600, color: '#23272f' }}>{guest.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={bodyCellSx}>{guest.phone || '—'}</TableCell>
                    <TableCell sx={bodyCellSx}>{guest.email || '—'}</TableCell>
                    <TableCell sx={bodyCellSx} align="center">{guest.age || '—'}</TableCell>
                    <TableCell sx={bodyCellSx} align="center">{guest.gender || '—'}</TableCell>
                    <TableCell sx={bodyCellSx} align="right">
                      <Stack direction="row" spacing={0.5} sx={{
                        justifyContent: "flex-end"
                      }}>
                        {onSelectGuest && (
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', mr: 0.5 }}
                            onClick={e => { e.stopPropagation(); onSelectGuest(guest); }}
                          >
                            Book Again
                          </Button>
                        )}
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); handleOpenDialog(guest); }}
                            sx={{ color: '#2193b0' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); handleDelete(guest._id); }}
                            sx={{ color: '#ef4444' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      })()}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        {/* Header */}
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={2.5} sx={{
            alignItems: "center"
          }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary))',
                boxShadow: '0 8px 22px -10px rgba(var(--app-primary-rgb),0.6)',
              }}
            >
              <Person />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                  color: isDarkMode ? 'rgba(241,245,249,0.96)' : 'rgba(15,23,42,0.96)',
                }}
              >
                {selectedGuest ? 'Edit Guest' : 'New Guest'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                {selectedGuest ? 'Update guest information' : 'Add a guest to your directory'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {/* Personal details */}
              <Box sx={sectionCardSx(isDarkMode)}>
                <Typography sx={sectionTitleSx(isDarkMode)}>
                  <Person fontSize="inherit" />
                  Personal Details
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Guest Name"
                      required
                      sx={textFieldSx(isDarkMode)}
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start"><Person fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                        }
                      }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                        }
                      }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Phone"
                      required
                      sx={textFieldSx(isDarkMode)}
                      value={formData.phone || ''}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, phone: digits });
                      }}
                      helperText="10-digit mobile number"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Phone fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>+91</Typography>
                            </InputAdornment>
                          ),
                        },

                        htmlInput: { maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }
                      }} />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      select
                      label="Gender"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.gender || ''}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      slotProps={{
                        select: { MenuProps: { slotProps: {
                          paper: { sx: { backgroundColor: isDarkMode ? '#1e293b' : '#fff' } }
                        } } }
                      }}
                    >
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Age"
                      type="number"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.age || ''}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Nationality"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.nationality || ''}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Identity */}
              <Box sx={sectionCardSx(isDarkMode)}>
                <Typography sx={sectionTitleSx(isDarkMode)}>
                  <BadgeIcon fontSize="inherit" />
                  Identity
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      select
                      label="Identity Type"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.identityType || 'Aadhar'}
                      onChange={(e) => setFormData({
                        ...formData,
                        identityType: e.target.value,
                        // Re-format the existing number for the newly chosen type.
                        identityNumber: formatIdentityByType(e.target.value, formData.identityNumber),
                      })}
                      slotProps={{
                        select: { MenuProps: { slotProps: {
                          paper: { sx: { backgroundColor: isDarkMode ? '#1e293b' : '#fff' } }
                        } } }
                      }}
                    >
                      <MenuItem value="Aadhar">Aadhar Card</MenuItem>
                      <MenuItem value="Passport">Passport</MenuItem>
                      <MenuItem value="DrivingLicense">Driving License</MenuItem>
                      <MenuItem value="VoterID">Voter ID</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      required
                      label="Identity Number"
                      placeholder={identityPlaceholder(formData.identityType)}
                      sx={textFieldSx(isDarkMode)}
                      value={formData.identityNumber || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        identityNumber: formatIdentityByType(formData.identityType, e.target.value),
                      })}
                      error={!!identityError(formData.identityType, formData.identityNumber)}
                      helperText={identityError(formData.identityType, formData.identityNumber)}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Company / GST — optional; GSTIN auto-fetches the registered address */}
              <Box sx={sectionCardSx(isDarkMode)}>
                <Typography sx={sectionTitleSx(isDarkMode)}>
                  <BusinessIcon fontSize="inherit" />
                  Company / GST
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Company Name"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.companyName || ''}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start"><BusinessIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                        }
                      }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="GST Number"
                      placeholder="15-character GSTIN"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.gstNumber || ''}
                      onChange={(e) => {
                        const gst = e.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 15);
                        setFormData({ ...formData, gstNumber: gst });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleFetchGst(); }
                      }}
                      error={!!formData.gstNumber && !GST_REGEX.test(formData.gstNumber)}
                      helperText={
                        formData.gstNumber && !GST_REGEX.test(formData.gstNumber)
                          ? 'Enter a valid 15-character GSTIN'
                          : "Fetches the company's registered address"
                      }
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <Button
                                size="small"
                                onClick={handleFetchGst}
                                disabled={gstLoading || !GST_REGEX.test(String(formData.gstNumber || ''))}
                                startIcon={gstLoading ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
                                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, minWidth: 0, whiteSpace: 'nowrap' }}
                              >
                                {gstLoading ? 'Fetching' : 'Fetch'}
                              </Button>
                            </InputAdornment>
                          ),
                        },
                        htmlInput: { maxLength: 15, style: { textTransform: 'uppercase' } }
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Additional */}
              <Box sx={sectionCardSx(isDarkMode)}>
                <Typography sx={sectionTitleSx(isDarkMode)}>
                  <EventNoteIcon fontSize="inherit" />
                  Additional Information
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Street Name"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.streetName || ''}
                      onChange={(e) => setFormData({ ...formData, streetName: e.target.value })}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start"><Home fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                        }
                      }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      fullWidth
                      label="Area"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.area || ''}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 4
                    }}>
                    <TextField
                      fullWidth
                      label="Pincode"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.pincode || ''}
                      onChange={(e) => {
                        const pincode = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        setFormData((prev) => ({ ...prev, pincode }));
                        if (pincode.length !== 6) return;
                        setPincodeLoading(true);
                        lookupPincode(pincode)
                          .then((result) => {
                            if (result) {
                              setFormData((prev) => ({
                                ...prev,
                                pincode,
                                district: result.district || prev.district,
                                state: result.state || prev.state,
                              }));
                            }
                          })
                          .finally(() => setPincodeLoading(false));
                      }}
                      helperText="Auto-fills district & state"
                      slotProps={{
                        input: {
                          endAdornment: pincodeLoading ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> : null,
                        },

                        htmlInput: { inputMode: 'numeric', maxLength: 6 }
                      }} />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 4
                    }}>
                    <TextField
                      fullWidth
                      label="District"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.district || ''}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 4
                    }}>
                    <TextField
                      fullWidth
                      label="State"
                      sx={textFieldSx(isDarkMode)}
                      value={formData.state || ''}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Special Notes"
                      multiline
                      rows={2}
                      sx={textFieldSx(isDarkMode)}
                      value={formData.specialNotes || ''}
                      onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          <Button onClick={handleCloseDialog} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" sx={primaryButtonSx}>
            {selectedGuest ? 'Update Guest' : 'Create Guest'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Guest Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        {detailsGuest && (
          <>
            {/* Header */}
            <Box sx={headerWrapSx(isDarkMode)}>
              <Stack direction="row" spacing={2.5} sx={{
                alignItems: "center"
              }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    fontWeight: 700,
                    fontSize: 22,
                    background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary))',
                    boxShadow: '0 8px 22px -10px rgba(var(--app-primary-rgb),0.6)',
                  }}
                >
                  {detailsGuest.name?.trim()?.charAt(0)?.toUpperCase() || <Person />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.15,
                      color: isDarkMode ? 'rgba(241,245,249,0.96)' : 'rgba(15,23,42,0.96)',
                    }}
                    noWrap
                  >
                    {detailsGuest.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                    {detailsGuest.phone || '—'}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
              <Stack spacing={2.5}>
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <Person fontSize="inherit" />
                    Personal Details
                  </Typography>
                  <Grid container spacing={2}>
                    <DetailItem label="Phone" value={detailsGuest.phone} isDarkMode={isDarkMode} />
                    <DetailItem label="Email" value={detailsGuest.email} isDarkMode={isDarkMode} />
                    <DetailItem label="Gender" value={detailsGuest.gender} isDarkMode={isDarkMode} />
                    <DetailItem label="Age" value={detailsGuest.age} isDarkMode={isDarkMode} />
                    <DetailItem label="Nationality" value={detailsGuest.nationality} isDarkMode={isDarkMode} />
                  </Grid>
                </Box>

                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <BadgeIcon fontSize="inherit" />
                    Identity
                  </Typography>
                  <Grid container spacing={2}>
                    <DetailItem label="Identity Type" value={detailsGuest.identityType || detailsGuest.idType} isDarkMode={isDarkMode} />
                    <DetailItem label="Identity Number" value={detailsGuest.identityNumber || detailsGuest.idNumber} isDarkMode={isDarkMode} />
                  </Grid>
                </Box>

                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <EventNoteIcon fontSize="inherit" />
                    Additional Information
                  </Typography>
                  <Grid container spacing={2}>
                    <DetailItem label="Company" value={detailsGuest.companyName} isDarkMode={isDarkMode} />
                    <DetailItem label="GST Number" value={detailsGuest.gstNumber} isDarkMode={isDarkMode} />
                    <DetailItem label="Address" value={detailsGuest.address} isDarkMode={isDarkMode} full />
                    <DetailItem label="Special Notes" value={detailsGuest.specialNotes || detailsGuest.notes} isDarkMode={isDarkMode} full />
                  </Grid>
                </Box>
              </Stack>
            </DialogContent>
          </>
        )}
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          {detailsGuest && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => { setDetailsDialogOpen(false); handleOpenDialog(detailsGuest); }}
              sx={secondaryButtonSx(isDarkMode)}
            >
              Edit
            </Button>
          )}
          <Button onClick={() => setDetailsDialogOpen(false)} variant="contained" sx={primaryButtonSx}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default Guests;