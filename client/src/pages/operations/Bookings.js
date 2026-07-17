import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, Paper, Snackbar, Alert, CircularProgress,
  TablePagination, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isValid } from 'date-fns';
import AddIcon from '@mui/icons-material/Add';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageLayout from '../../components/layout/PageLayout';
import FormDialog, { FormSection } from '../../components/forms/FormDialog';
import BookingForm from '../../components/forms/BookingForm';
import BookingCard from '../../components/ui/BookingCard';
import GroupBookingDialog from '../../components/forms/GroupBookingDialog';
import BookingTypeSelector from '../../components/forms/BookingTypeSelector';
import CompanyBookingDialog from '../../components/forms/CompanyBookingDialog';
import RoomTransferDialog from '../../components/forms/RoomTransferDialog';
import RoomingListDialog from '../../components/forms/RoomingListDialog';
import CompaniesManager from '../../components/forms/CompaniesManager';
import api from '../../api';
import Guests from '../management/Guests';
import CheckoutDialog from '../../components/forms/CheckoutDialog';
import GuestWelcomeDialog from '../../components/GuestWelcomeDialog';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HotelIcon from '@mui/icons-material/Hotel';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PrintIcon from '@mui/icons-material/Print';
import DescriptionIcon from '@mui/icons-material/Description';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';
import BookingDetailsDialog from '../../components/forms/BookingDetailsDialog';
import GuestPrintForm from '../../components/forms/GuestPrintForm';
import SettleBalanceDialog from '../../components/forms/SettleBalanceDialog';
import { useSettings } from '../../contexts/SettingsContext';
import { useBilling } from '../../hooks/useBilling';
import { calcGst, calcBreakfast, clampDiscount, currencySym } from '../../utils/billing';
import { EASE_OUT, PAYMENT_OPTIONS } from './bookings/constants';
import { StatusFilter, SearchField } from './bookings/HeaderControls';
import DateRangePicker from './bookings/DateRangePicker';

const Bookings = ({ view = 'all', bookingType = null }) => {
  // `view` is driven by the sidebar sub-tabs: 'active' shows the Active Bookings
  // cards, 'checkedout' shows the Checked Out Guests table, 'all' shows both.
  // `bookingType` ('group' | 'company') scopes the page to one cluster type,
  // collapsing each group/company to a single master row.
  const showActive = view === 'all' || view === 'active';
  const showCheckedOut = (view === 'all' || view === 'checkedout') && !bookingType;
  const activeHeading = bookingType === 'group' ? 'Group Bookings'
    : bookingType === 'company' ? 'Company Bookings' : 'Active Bookings';
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activeStep, setActiveStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  // Guest list: filter by a stay date window (overlaps check-in/check-out).
  const [coDateFrom, setCoDateFrom] = useState('');
  const [coDateTo, setCoDateTo] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState(null);
  const [checkoutRoom, setCheckoutRoom] = useState(null);
  const [welcomeBooking, setWelcomeBooking] = useState(null);
  const [welcomeRoom, setWelcomeRoom] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [pageCheckedOut, setPageCheckedOut] = useState(0);
  const [rowsPerPageCheckedOut, setRowsPerPageCheckedOut] = useState(10);
  const [guestPrintFormOpen, setGuestPrintFormOpen] = useState(false);
  const [selectedBookingForPrint, setSelectedBookingForPrint] = useState(null);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleBooking, setSettleBooking] = useState(null);
  const [processingCheckoutIds, setProcessingCheckoutIds] = useState(new Set());
  // Group / Company / Transfer feature dialogs
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  // Unified "New Booking" flow — one entry, three modes (individual/group/company).
  const [bookingMode, setBookingMode] = useState('individual');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferBooking, setTransferBooking] = useState(null);
  const [roomingOpen, setRoomingOpen] = useState(false);
  const [roomingGroupId, setRoomingGroupId] = useState(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);

  // Add housekeeping context
  const { settings } = useSettings();
  const billing = useBilling();
  const darkMode = !!settings?.theme?.darkMode;

  const [formData, setFormData] = useState({
    guestName: '',
    phone: '',
    email: '',
    age: '',
    gender: '',
    nationality: 'Indian',
    guestType: 'Individual',
    bookingSource: 'Walk-in',
    additionalServices: [],
    idCardType: 'Aadhaar Card',
    idCardNumber: '',
    companyName: '',
    gstNumber: '',
    streetName: '',
    area: '',
    district: '',
    state: '',
    checkIn: new Date(),
    checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
    checkInTime: (() => {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    })(),
    checkOutTime: billing.defaultCheckOutTime,
    roomId: '',
    adults: 1,
    children: 0,
    totalAmount: 0,
    baseAmount: 0,
    breakfastAmount: 0,
    gstAmount: 0,
    discount: 0,
    extraCharges: { extraBed: 0, extraPerson: 0, foodPackage: 0, laundry: 0, transport: 0, other: 0 },
    extraChargesTotal: 0,
    paidAmount: 0,
    remainingAmount: 0,
    paymentStatus: 'Pending',
    bookingStatus: 'Pending',
    specialRequests: '',
    customerId: '',
    idCardImage: null,
    idCardImageBack: null,
    tariffType: 'normal', // Add tariff type field
  });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // Generate booking ID with 6-digit serial starting from 100001
  const generateBookingId = () => {
    let serial = parseInt(localStorage.getItem('bookingSerial') || '100000', 10);
    serial += 1;
    localStorage.setItem('bookingSerial', serial.toString());
    return `BK-${serial}`;
  };

  // Generate a temporary customer ID for display before saving to backend
  const generateTempCustomerId = () => {
    let serial = parseInt(localStorage.getItem('customerSerial') || '10000', 10);
    serial += 1;
    localStorage.setItem('customerSerial', serial.toString());
    // Use initials and date for a realistic temp ID
    const guestName = formData.guestName || 'G';
    const nameParts = guestName.trim().split(' ');
    const firstInitial = nameParts[0]?.charAt(0).toUpperCase() || 'G';
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0).toUpperCase() : '';
    const initials = firstInitial + lastInitial;
    const dateObj = new Date();
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const serialStr = String(serial).padStart(5, '0');
    return `${initials}${dateStr}${serialStr}`;
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.bookings.getAll();
      // Ensure response.data is an array
      const bookingsArray = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBookings(bookingsArray);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]); // Set empty array on error
      showSnackbar('Failed to fetch bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.rooms.getAll();
      // Support both array and object API responses
      const roomsArray = Array.isArray(response.data) ? response.data : (response.data.data || []);
      // Get all bookings to check for date overlaps
      const bookingsResponse = await api.bookings.getAll();
      const allBookings = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : (bookingsResponse.data?.data || []);
      // Add availability information to each room
      const roomsWithAvailability = roomsArray.map(room => {
        // Find bookings for this room
        const roomBookings = allBookings.filter(booking => 
          booking.roomId === room._id && 
          booking.bookingStatus !== 'Cancelled' && 
          booking.bookingStatus !== 'Completed',
        );
        return {
          ...room,
          bookings: roomBookings,
        };
      });
      setRooms(roomsWithAvailability);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([]); // Set empty array on error
      showSnackbar('Failed to fetch rooms', 'error');
    }
  }, [showSnackbar]);

  // Function to refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([fetchBookings(), fetchRooms()]);
  }, [fetchBookings, fetchRooms]);

  const handleOpenDialog = (booking = null) => {
    setActiveStep(0);
    if (booking) {
      setSelectedBooking(booking);

      // booking.roomId comes back populated as an object; the <Select> keys on
      // the plain string _id, so normalise before matching/storing.
      const bookingRoomId =
        booking.roomId && typeof booking.roomId === 'object'
          ? booking.roomId._id
          : booking.roomId || '';
      const roomExists = rooms.some(room => room._id === bookingRoomId);

      setFormData({
        ...booking,
        bookingId: booking.bookingId || '',
        checkIn: (() => {
          try {
            const date = new Date(booking.checkIn);
            return isValid(date) ? date : new Date();
          } catch (error) {
            console.warn('Invalid checkIn date:', booking.checkIn);
            return new Date();
          }
        })(),
        checkOut: (() => {
          try {
            const date = new Date(booking.checkOut);
            return isValid(date) ? date : new Date(new Date().setDate(new Date().getDate() + 1));
          } catch (error) {
            console.warn('Invalid checkOut date:', booking.checkOut);
            return new Date(new Date().setDate(new Date().getDate() + 1));
          }
        })(),
        checkInTime: booking.checkInTime || (() => {
          const now = new Date();
          return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        })(),
        checkOutTime: booking.checkOutTime || billing.defaultCheckOutTime,
        roomId: roomExists ? bookingRoomId : '',
        idCardType: booking.idCardType || 'Aadhaar Card',
        idCardNumber: booking.idCardNumber || '',
        idCardImage: booking.idCardImage || null,
        tariffType: booking.tariffType || 'normal',
        breakfastAmount: booking.breakfastAmount || 0,
      });
    } else {
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setSelectedBooking(null);
      setFormData({
        bookingId: generateBookingId(),
        guestName: '',
        email: '',
        phone: '',
        age: '',
        gender: '',
        nationality: 'Indian',
        companyName: '',
        gstNumber: '',
        area: '',
        streetName: '',
        pincode: '',
        district: '',
        state: '',
        checkIn: new Date(),
        checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
        checkInTime: currentTime,
        checkOutTime: currentTime,
        roomId: '',
        adults: 1,
        children: 0,
        totalAmount: 0,
        baseAmount: 0,
        breakfastAmount: 0,
        gstAmount: 0,
        discount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: 'Pending',
        bookingStatus: 'Pending',
        specialRequests: '',
        customerId: generateTempCustomerId(),
        idCardType: 'Aadhaar Card',
        idCardNumber: '',
        idCardImage: null,
        tariffType: 'normal',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedBooking(null);
    setActiveStep(0);
    setBookingMode('individual');
  };

  // Single "New Booking" entry point — always starts on the Individual form;
  // the in-dialog type toggle switches to Group / Company without leaving the flow.
  const handleNewBooking = () => {
    setBookingMode('individual');
    setGroupDialogOpen(false);
    setCompanyDialogOpen(false);
    handleOpenDialog();
  };

  // Swap the open dialog as the user flips the Booking Type toggle. Only one of
  // the three dialogs is ever open; switching closes the others.
  const switchBookingMode = (mode) => {
    if (!mode || mode === bookingMode) return;
    setBookingMode(mode);
    setOpenDialog(mode === 'individual');
    setGroupDialogOpen(mode === 'group');
    setCompanyDialogOpen(mode === 'company');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If payment status is changed to "Paid", automatically set paid amount to total amount
    if (name === 'paymentStatus' && value === 'Paid') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        paidAmount: prev.totalAmount,
        remainingAmount: 0,
      }));
    }
    
    // If tariff type changes, recalculate the total amount
    if (name === 'tariffType' && formData.roomId && formData.checkIn && formData.checkOut) {
      const room = rooms.find(r => r._id === formData.roomId);
      if (room) {
        const nights = calculateNights(formData.checkIn, formData.checkOut, formData.checkInTime, formData.checkOutTime);
        const baseAmount = room.pricePerNight * nights;
        const breakfastAmount = value === 'breakfast' ? calcBreakfast(nights, billing) : 0;
        const subtotal = baseAmount + breakfastAmount;
        const gstAmount = calcGst(subtotal, billing);
        const totalAmount = subtotal + gstAmount;
        
        setFormData(prev => ({
          ...prev,
          [name]: value,
          baseAmount: Math.round(baseAmount),
          breakfastAmount: Math.round(breakfastAmount),
          gstAmount: Math.round(gstAmount),
          totalAmount: Math.round(totalAmount),
        }));
      }
    }
  };

  const handleDateChange = (name, date) => {
    setFormData({ ...formData, [name]: date });
    
    // Recalculate total amount when dates change
    if (formData.roomId && (name === 'checkIn' || name === 'checkOut')) {
      const room = rooms.find(r => r._id === formData.roomId);
      if (room && formData.checkIn && (name === 'checkIn' ? date : formData.checkIn) && 
          (name === 'checkOut' ? date : formData.checkOut)) {
        const checkIn = name === 'checkIn' ? date : formData.checkIn;
        const checkOut = name === 'checkOut' ? date : formData.checkOut;
        const nights = calculateNights(checkIn, checkOut, formData.checkInTime, formData.checkOutTime);
        const baseAmount = room.pricePerNight * nights;
        const breakfastAmount = formData.tariffType === 'breakfast' ? calcBreakfast(nights, billing) : 0;
        const subtotal = baseAmount + breakfastAmount;
        const gstAmount = calcGst(subtotal, billing);
        const totalAmount = subtotal + gstAmount;
        setFormData(prev => ({ 
          ...prev, 
          totalAmount: Math.round(totalAmount),
          baseAmount: Math.round(baseAmount),
          breakfastAmount: Math.round(breakfastAmount),
          gstAmount: Math.round(gstAmount),
        }));
      }
    }
  };

  const handleRoomChange = (e) => {
    const roomId = e.target.value;
    
    // Only set roomId if it's a valid value
    if (!roomId || roomId === '' || roomId === 'null' || roomId === 'undefined') {
      setFormData({ ...formData, roomId: '', totalAmount: 0, baseAmount: 0, gstAmount: 0, breakfastAmount: 0 });
      return;
    }
    
    setFormData({ ...formData, roomId });
    
    // Calculate total amount when room changes
    if (roomId && formData.checkIn && formData.checkOut) {
      const room = rooms.find(r => r._id === roomId);
      if (room) {
        
        const nights = calculateNights(formData.checkIn, formData.checkOut, formData.checkInTime, formData.checkOutTime);
        
        const baseAmount = room.pricePerNight * nights;
        const breakfastAmount = formData.tariffType === 'breakfast' ? calcBreakfast(nights, billing) : 0;
        const subtotal = baseAmount + breakfastAmount;
        const gstAmount = calcGst(subtotal, billing); // GST at the configured room rate
        const totalAmount = subtotal + gstAmount;
        
        
        setFormData(prev => ({ 
          ...prev, 
          totalAmount: Math.round(totalAmount),
          baseAmount: Math.round(baseAmount),
          breakfastAmount: Math.round(breakfastAmount),
          gstAmount: Math.round(gstAmount),
        }));
      }
    }
  };

  const handleTimeChange = (name, value) => {
    let timeStr = '';
    if (value instanceof Date && isValid(value)) {
      timeStr = format(value, 'HH:mm');
    } else if (typeof value === 'string') {
      timeStr = value;
    }
    setFormData(prev => ({
      ...prev,
      [name]: timeStr,
    }));

    // Recalculate total amount when check-out time changes
    if (formData.roomId && formData.checkIn && formData.checkOut && 
        (name === 'checkInTime' || name === 'checkOutTime')) {
      const room = rooms.find(r => r._id === formData.roomId);
      if (room) {
        const nights = calculateNights(formData.checkIn, formData.checkOut, name === 'checkInTime' ? timeStr : formData.checkInTime, name === 'checkOutTime' ? timeStr : formData.checkOutTime);
        const baseAmount = room.pricePerNight * nights;
        const breakfastAmount = formData.tariffType === 'breakfast' ? calcBreakfast(nights, billing) : 0;
        const subtotal = baseAmount + breakfastAmount;
        const gstAmount = calcGst(subtotal, billing);
        const totalAmount = subtotal + gstAmount;
        
        setFormData(prev => ({ 
          ...prev, 
          totalAmount: Math.round(totalAmount),
          baseAmount: Math.round(baseAmount),
          breakfastAmount: Math.round(breakfastAmount),
          gstAmount: Math.round(gstAmount),
        }));
      }
    }
  };

  const handlePaidAmountChange = (e) => {
    const paidAmount = parseFloat(e.target.value) || 0;
    const totalAmount = parseFloat(formData.totalAmount) || 0;
    const remainingAmount = totalAmount - paidAmount;
    
    let paymentStatus = 'Pending';
    if (paidAmount >= totalAmount) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'Partial';
    }
    
    setFormData(prev => ({ 
      ...prev, 
      paidAmount,
      paymentStatus,
      remainingAmount: Math.max(0, remainingAmount),
    }));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required fields
    if (!formData.guestName || !formData.phone || !formData.roomId || !formData.checkIn || !formData.checkOut) {
      showSnackbar('Please fill all required fields', 'error');
      return;
    }
    
    // Validate roomId is not empty string or null
    if (!formData.roomId || formData.roomId.trim() === '' || formData.roomId === 'null' || formData.roomId === 'undefined') {
      showSnackbar('Please select a valid room', 'error');
      return;
    }
    
    // Validate totalAmount
    if (!formData.totalAmount || formData.totalAmount <= 0) {
      showSnackbar('Total amount must be calculated and greater than 0', 'error');
      return;
    }
    // Phone validation (Indian 10-digit)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      showSnackbar('Please enter a valid 10-digit phone number', 'error');
      return;
    }
    // Email validation (if provided)
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      showSnackbar('Please enter a valid email address', 'error');
      return;
    }
  
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkIn = new Date(formData.checkIn);
      const checkOut = new Date(formData.checkOut);
      
      // Check if check-in date is before check-out date
      if (checkIn >= checkOut) {
        showSnackbar('Check-out date must be after check-in date', 'error');
        return;
      }
      
      // Always update room status to occupied for new bookings
      // or if check-in date is today or in the past and check-out is in the future
      const isCurrentStay = checkIn <= today && checkOut > today;
      
      // Create a FormData object if there's an ID card image to upload
      let bookingData;
    
      // If there's a new ID image to upload (front and/or Aadhaar back)
      const hasFront = formData.idCardImage instanceof File;
      const hasBack = formData.idCardImageBack instanceof File;
      if (hasFront || hasBack) {
        const formDataObj = new FormData();
        // Append all booking data as a single JSON string under 'data'
        const bookingDataForJson = {
          ...formData,
          checkInTime: formData.checkInTime || format(new Date(), 'HH:mm'),
          checkOutTime: formData.checkOutTime || billing.defaultCheckOutTime,
        };
        delete bookingDataForJson.idCardImage;      // files travel as multipart parts
        delete bookingDataForJson.idCardImageBack;
        formDataObj.append('data', JSON.stringify(bookingDataForJson));
        if (hasFront) formDataObj.append('idCardImage', formData.idCardImage);
        if (hasBack) formDataObj.append('idCardImageBack', formData.idCardImageBack);
        // Use the FormData object instead
        bookingData = formDataObj;
      } else {
        // Ensure we have proper booking data structure even without file
        bookingData = { 
          ...formData,
          checkInTime: formData.checkInTime || (() => {
          const now = new Date();
          return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        })(),
          checkOutTime: formData.checkOutTime || billing.defaultCheckOutTime,
        };
      }
      
      // Include room status update in the request (only for non-FormData)
      if (!(bookingData instanceof FormData)) {
        bookingData.updateRoomStatus = true; // Always update room status for new bookings
      }
  
      let response;
      if (selectedBooking) {
        response = await api.bookings.update(selectedBooking._id, bookingData);
        showSnackbar('Booking updated successfully', 'success');
        
        // Also update room status when editing a booking if it's a current stay
        if (isCurrentStay && window.hotelManagement && window.hotelManagement.updateRoomStatus) {
          window.hotelManagement.updateRoomStatus(formData.roomId, true);
        }
      } else {
        // Ensure customerId, _id, and invoiceNumber are not sent for new bookings
        if (bookingData instanceof FormData) {
          bookingData.delete('customerId');
          bookingData.delete('_id');
          bookingData.delete('invoiceNumber');
        } else {
          delete bookingData.customerId;
          delete bookingData._id;
          delete bookingData.invoiceNumber;
        }
        
        
        response = await api.bookings.create(bookingData);
        showSnackbar('Booking created successfully', 'success');
        
        // Dispatch booking event to notify other components
        const bookingEvent = new CustomEvent('bookingEvent', {
          detail: { 
            roomId: formData.roomId,
            action: 'booking_created',
            isBooked: true,
            booking: response.data,
          },
        });
        window.dispatchEvent(bookingEvent);
        
        // After successful booking creation, update formData with returned booking (including customerId)
        setFormData({
          ...formData,
          ...response.data,
          checkIn: response.data.checkIn ? new Date(response.data.checkIn) : formData.checkIn,
          checkOut: response.data.checkOut ? new Date(response.data.checkOut) : formData.checkOut,
        });
        handleCloseDialog();
        await refreshData();
        // Walk-in created already checked in → offer to send WiFi + menu.
        if (response?.data?.checkedIn === true && settings?.guestMessaging?.enabled !== false) {
          openWelcomeFor(response.data);
        }
        return;
      }
      
      handleCloseDialog();
      await refreshData();
    } catch (error) {
      console.error('Error saving booking:', error);
      showSnackbar('Failed to save booking: ' + (error.response?.data?.message || error.message), 'error');
    }
  };
  
  const handleDeleteBooking = async (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        setLoading(true);
        
        // Get the booking before deleting it
        const bookingToDelete = bookings.find(b => b._id === bookingId);
        
        // First, update the room status to available if it was occupied by this booking
        if (bookingToDelete && bookingToDelete.roomId) {
          try {
            // Extract room ID correctly - handle both populated objects and direct ObjectId strings
            const roomId = typeof bookingToDelete.roomId === 'object' ? bookingToDelete.roomId._id : bookingToDelete.roomId;
            // Use the dedicated updateStatus method to avoid validation errors
            await api.rooms.updateStatus(roomId, 'available');
          } catch (roomError) {
            console.warn('Could not update room status:', roomError);
            // Continue with booking deletion even if room update fails
          }
        }
        
        // Now delete the booking
        await api.bookings.delete(bookingId);
        showSnackbar('Booking deleted successfully');
        
        // Dispatch booking event to notify other components
        const bookingEvent = new CustomEvent('bookingEvent', {
          detail: { 
            roomId: bookingToDelete.roomId,
            action: 'booking_deleted',
            isBooked: false,
            bookingId: bookingId,
          },
        });
        window.dispatchEvent(bookingEvent);
        
        await refreshData();
      } catch (error) {
        console.error('Error deleting booking:', error);
        showSnackbar(error.response?.data?.message || 'Failed to delete booking', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Open the "Send WiFi & menu on WhatsApp" dialog for a given booking
  // (used on check-in, on walk-in creation, and from the "Send WiFi & Menu" action).
  const openWelcomeFor = (booking) => {
    if (!booking) return;
    const rid = typeof booking.roomId === 'object' ? booking.roomId._id : booking.roomId;
    setWelcomeRoom(rooms.find((r) => r._id === rid) || (typeof booking.roomId === 'object' ? booking.roomId : null));
    setWelcomeBooking(booking);
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      setLoading(true);
      const booking = bookings.find(b => b._id === bookingId);
      if (!booking) {
        showSnackbar('Booking not found', 'error');
        setLoading(false);
        return;
      }
  
      if (newStatus === 'Completed') {
        // For checkout, we open the dialog instead of a direct status change
        // Handle both populated roomId objects and string IDs
        const roomId = typeof booking.roomId === 'object' ? booking.roomId._id : booking.roomId;
        const room = rooms.find(r => r._id === roomId);
        
        // Add booking to processing set
        setProcessingCheckoutIds(prev => new Set(prev).add(bookingId));
        
        // Set booking and room data first
        setCheckoutBooking(booking);
        setCheckoutRoom(room);
        
        // Add a small delay to ensure state is set before opening dialog
        setTimeout(() => {
          setCheckoutDialogOpen(true);
        }, 100);
        
        setLoading(false);
        return;
      }
  
      // For 'Confirmed' (Check-in) — use the dedicated endpoint so the guest
      // is marked physically present (checkedIn) and the room is occupied.
      // Other status changes still go through a plain update.
      if (newStatus === 'Confirmed') {
        await api.bookings.checkIn(bookingId);
      } else {
        await api.bookings.update(bookingId, { bookingStatus: newStatus });
      }

      // Dispatch booking event to notify other components
      const bookingEvent = new CustomEvent('bookingEvent', {
        detail: {
          roomId: booking.roomId,
          action: 'booking_updated',
          isBooked: newStatus === 'Confirmed',
          bookingId: bookingId,
          status: newStatus,
        },
      });
      window.dispatchEvent(bookingEvent);

      showSnackbar(newStatus === 'Confirmed' ? 'Guest checked in' : `Booking status updated to ${newStatus}`);

      // On check-in, offer to send WiFi password + food-menu link to the guest's WhatsApp.
      if (newStatus === 'Confirmed' && settings?.guestMessaging?.enabled !== false) {
        openWelcomeFor(booking);
      }

      await refreshData();
    } catch (error) {
      console.error(`Error updating booking to ${newStatus}:`, error);
      showSnackbar(error.response?.data?.message || 'Failed to update booking status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const _handleCheckIn = async (id) => {
    try {
      setLoading(true);
      const booking = bookings.find(b => b._id === id);
      if (!booking) {
        showSnackbar('Booking not found', 'error');
        return;
      }

      // Update booking status to Confirmed
      await api.bookings.update(id, { 
        bookingStatus: 'Confirmed',
        checkInTime: format(new Date(), 'HH:mm'),
      });

      // Update room status to occupied
      if (booking.roomId) {
        // Extract room ID correctly - handle both populated objects and direct ObjectId strings
        const roomId = typeof booking.roomId === 'object' ? booking.roomId._id : booking.roomId;
        await api.rooms.updateStatus(roomId, 'occupied');
      }

      // Dispatch booking event to notify other components
      const bookingEvent = new CustomEvent('bookingEvent', {
        detail: { 
          roomId: booking.roomId,
          action: 'booking_updated',
          isBooked: true,
          bookingId: id,
          status: 'Confirmed',
        },
      });
      window.dispatchEvent(bookingEvent);

      showSnackbar('Guest checked in successfully');
      await refreshData();
    } catch (error) {
      console.error('Error checking in:', error);
      showSnackbar(error.response?.data?.message || 'Failed to check in guest', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const _handleCheckout = (id) => {
    const booking = bookings.find(b => b._id === id);
    if (!booking) {
      showSnackbar('Booking not found', 'error');
      return;
    }
    const room = rooms.find(r => r._id === booking.roomId);
    setCheckoutBooking(booking);
    setCheckoutRoom(room);
    setCheckoutDialogOpen(true);
  };
  
  const handlePincodeChange = async (e) => {
    const pincode = e.target.value;
    setFormData(prev => ({ ...prev, pincode }));
    
    if (pincode && pincode.length === 6) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();
        
        if (data[0].Status === 'Success') {
          const postOffice = data[0].PostOffice[0];
          setFormData(prev => ({
            ...prev,
            district: postOffice.District || prev.district,
            state: postOffice.State || prev.state,
          }));
        }
      } catch (error) {
        console.error('Error fetching pincode data:', error);
        // Don't show error to user as this is a convenience feature
      }
    }
  };
  
  const _handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const _handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // Print invoice using enhanced color printing method
  const handlePrintInvoice = async (booking) => {
    try {
      // Enhanced settings loading check with timing analysis
      if (!settings) {
        showSnackbar('Settings not loaded. Please wait and try again.', 'warning');
        return;
      }
      
      if (settings.loading === true) {
        showSnackbar('Settings are still loading. Please wait...', 'info');
        
        // Wait for settings to load with timeout
        let attempts = 0;
        const maxAttempts = 10; // 5 seconds total
        
        while (settings.loading && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (settings.loading) {
          showSnackbar('Settings loading timeout. Please refresh and try again.', 'error');
          return;
        }
      }
      
      const _room = rooms.find(r => r._id === booking.roomId);
      let _restaurantOrders = [];
      
      // Fetch restaurant orders for the booking
      try {
        const response = await api.restaurant.getOrdersByBooking(booking._id);
        _restaurantOrders = response.data || [];
      } catch (error) {
        _restaurantOrders = [];
      }
      
      // Use the server-side professional template for invoice generation
      try {
        const response = await api.post(`/invoices/booking/${booking._id}`, {
          template: 'luxury_room_booking'
        });
        
        const htmlContent = response.data;
        
        // Open print preview window with the new professional template
        const printWindow = window.open('', '_blank', 'width=900,height=1200,scrollbars=yes,resizable=yes');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          
          // Auto-print after content loads
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              printWindow.onafterprint = () => {
                printWindow.close();
              };
            }, 500);
          };
        } else {
          throw new Error('Please allow popups to print invoices');
        }
      } catch (error) {
        console.error('Error printing professional invoice:', error);
        showSnackbar('Failed to print invoice: ' + error.message, 'error');
      }
      
      showSnackbar('Invoice printed successfully!', 'success');
    } catch (error) {
      showSnackbar('Failed to print invoice: ' + error.message, 'error');
    }
  };

  // Payment completion handler: after payment, show invoice dialog
  const handlePaymentComplete = async (paymentDetails) => {
    try {
      if (!checkoutBooking) {
        showSnackbar('No booking data found', 'error');
        return;
      }
      
      showSnackbar('Processing checkout...', 'info');
      
      // Update booking with payment details and mark as completed
      const totalWithRestaurant = paymentDetails.totalWithRestaurant || checkoutBooking.totalAmount || 0;
      const restaurantCharges = paymentDetails.restaurantCharges || 0;
      const updatedBookingData = {
        ...checkoutBooking,
        paidAmount: (checkoutBooking.paidAmount || 0) + paymentDetails.amount,
        paymentMethod: paymentDetails.method,
        paymentReference: paymentDetails.reference,
        bookingStatus: 'Completed',
        paymentStatus: 'Paid',
        remainingAmount: 0,
        checkOutTime: format(new Date(), 'HH:mm'),
        restaurantCharges: restaurantCharges,
        totalWithRestaurant: totalWithRestaurant,
        // Update with correct night count and amount from checkout calculation
        actualNights: paymentDetails.actualNights || checkoutBooking.nights || 1,
        totalAmount: paymentDetails.adjustedAmount || checkoutBooking.totalAmount,
        checkOut: paymentDetails.checkoutDate ? format(paymentDetails.checkoutDate, 'yyyy-MM-dd') : checkoutBooking.checkOut,
      };
      
      await api.bookings.update(checkoutBooking._id, updatedBookingData);
      
      // Update room status to cleaning after checkout (consistent with server logic)
      if (checkoutBooking.roomId) {
        // Extract room ID correctly - handle both populated objects and direct ObjectId strings
        const roomId = typeof checkoutBooking.roomId === 'object' ? checkoutBooking.roomId._id : checkoutBooking.roomId;
        // Set to cleaning status - housekeeping will update to available when cleaning is complete
        await api.rooms.updateStatus(roomId, 'cleaning');
      }
      
      // Dispatch booking event to notify other components
      const bookingEvent = new CustomEvent('bookingEvent', {
        detail: { 
          roomId: checkoutBooking.roomId,
          action: 'booking_completed',
          isBooked: false,
          bookingId: checkoutBooking._id,
          status: 'Completed',
        },
      });
      window.dispatchEvent(bookingEvent);
      
      // Close checkout dialog immediately
      setCheckoutDialogOpen(false);
      setCheckoutBooking(null);
      setCheckoutRoom(null);
      
      // Remove booking from processing set
      setProcessingCheckoutIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkoutBooking._id);
        return newSet;
      });
      
      // Open the invoice / print dialog straight away — it renders from the
      // booking data we already have, so it must not wait behind a full
      // bookings+rooms refetch (that refetch was the delay before the print
      // prompt appeared). Refresh the lists in the background instead.
      setSelectedBooking(updatedBookingData);
      setInvoiceDialogOpen(true);
      showSnackbar('Checkout completed successfully! Room has been marked for cleaning.', 'success');

      Promise.resolve(refreshData()).catch(() => {});
    } catch (error) {
      console.error('Error completing payment:', error);
      showSnackbar('Failed to complete checkout: ' + (error.response?.data?.message || error.message), 'error');
    }
  };
        
  // Handler to open guest selection dialog
  const handleOpenGuestDialog = () => setGuestDialogOpen(true);
  const handleCloseGuestDialog = () => setGuestDialogOpen(false);

  // Handler to autofill booking form with guest data
  const handleSelectGuestForBooking = (guest) => {
    // Guest identity-type enum → booking form's human labels.
    const ID_TYPE_MAP = {
      Aadhar: 'Aadhaar Card', Aadhaar: 'Aadhaar Card', Passport: 'Passport',
      DrivingLicense: 'Driving License', VoterID: 'Voter ID',
    };
    // Prefer the guest's structured address fields. For legacy records that only
    // have the single-line `address` (Aadhaar gives 6+ comma parts), parse the
    // tail from the RIGHT so pincode/state/district land in the right boxes.
    const parts = String(guest.address || '').split(',').map((s) => s.trim()).filter(Boolean);
    const legacyPincode = /^\d{6}$/.test(parts[parts.length - 1] || '') ? parts.pop() : '';
    const legacyState = parts.length ? parts.pop() : '';
    const legacyDistrict = parts.length ? parts.pop() : '';
    const legacyArea = parts.length ? parts.pop() : '';
    const legacyStreet = parts.join(', ');
    setFormData(prev => ({
      ...prev,
      guestName: guest.name || '',
      email: guest.email || '',
      // Booking phone field holds the 10-digit local number (+91 is shown as a prefix).
      phone: String(guest.phone || '').replace(/\D/g, '').slice(-10),
      age: guest.age || '',
      gender: guest.gender || '',
      nationality: guest.nationality || 'Indian',
      customerId: guest.customerId || guest._id || generateTempCustomerId(),
      // Robust ID card type/number mapping
      idCardType: guest.idCardType || ID_TYPE_MAP[guest.identityType] || guest.identityType || guest.idType || 'Aadhaar Card',
      idCardNumber: guest.idCardNumber || guest.identityNumber || guest.idNumber || '',
      companyName: guest.companyName || '',
      gstNumber: guest.gstNumber || '',
      streetName: guest.streetName || legacyStreet,
      area: guest.area || legacyArea,
      district: guest.district || guest.city || legacyDistrict,
      state: guest.state || legacyState,
      pincode: guest.pincode || guest.zipCode || legacyPincode,
      bookingId: generateBookingId(),
    }));
    setSelectedBooking(null);
    setActiveStep(0);
    setOpenDialog(true);
    setGuestDialogOpen(false);
  };

  // Helper to calculate nights based on checkout time with late checkout rule
  const calculateNights = useCallback((checkIn, checkOut, checkInTime, checkOutTime) => {
    if (!checkIn || !checkOut) {return 1;}
    // Parse if string
    const checkInDateObj = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
    const checkOutDateObj = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;
    if (!isValid(checkInDateObj) || !isValid(checkOutDateObj)) {return 1;}
    
    // Get date part only
    const checkInDate = new Date(checkInDateObj.getFullYear(), checkInDateObj.getMonth(), checkInDateObj.getDate());
    const checkOutDate = new Date(checkOutDateObj.getFullYear(), checkOutDateObj.getMonth(), checkOutDateObj.getDate());
    
    // Calculate base nights as the difference in days
    let nights = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    nights = Math.max(1, nights); // Always at least 1 night for same-day bookings
    
    // Apply late checkout rule: if checkout time is after 12:00 PM, add 1 more night
    const checkOutTimeStr = checkOutTime || billing.defaultCheckOutTime;
    if (checkOutTimeStr) {
      try {
        const [hours, minutes] = checkOutTimeStr.split(':').map(Number);
        const checkoutHour = hours + (minutes / 60); // Convert to decimal hours
        
        // If checkout is after 12:00 PM (12.0), add one more night
        if (checkoutHour > 12.0) {
          nights += 1;
        }
      } catch (error) {
        console.error('Error parsing checkout time:', error);
      }
    }

    return nights;
  }, [billing]);

  // Recalculate nights and amounts whenever relevant formData changes
  useEffect(() => {
    if (formData.roomId && formData.checkIn && formData.checkOut) {
      const room = rooms.find(r => r._id === formData.roomId);
      if (room) {
        const nights = calculateNights(formData.checkIn, formData.checkOut, formData.checkInTime, formData.checkOutTime);
        const baseAmount = room.pricePerNight * nights;
        const breakfastAmount = formData.tariffType === 'breakfast' ? calcBreakfast(nights, billing) : 0;
        const subtotal = baseAmount + breakfastAmount;
        // GST is charged on the full pre-discount amount, so the discount never
        // reduces it. The discount is a percentage off the base room price only
        // (not breakfast, not GST).
        const gstAmount = calcGst(subtotal, billing);
        const discountPct = clampDiscount(formData.discount, billing);
        const discountAmount = baseAmount * (discountPct / 100);
        const totalAmount = subtotal + gstAmount - discountAmount;
        setFormData(prev => ({
          ...prev,
          totalAmount: Math.round(totalAmount),
          baseAmount: Math.round(baseAmount),
          breakfastAmount: Math.round(breakfastAmount),
          discountAmount: Math.round(discountAmount),
          gstAmount: Math.round(gstAmount),
        }));
      }
    }
  }, [
    formData.roomId,
    formData.checkIn,
    formData.checkOut,
    formData.checkInTime,
    formData.checkOutTime,
    formData.tariffType,
    formData.discount,
    rooms,
    billing,
    calculateNights,
  ]);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, [fetchBookings, fetchRooms]);
        
  // Add these handlers for checked out pagination
  const handleChangePageCheckedOut = (event, newPage) => {
    setPageCheckedOut(newPage);
  };
  const handleChangeRowsPerPageCheckedOut = (event) => {
    setRowsPerPageCheckedOut(parseInt(event.target.value, 10));
    setPageCheckedOut(0);
  };

  // Shared guest table for the In Hotel + Checked Out sections. Renders the
  // given rows (pagination/visibility stay with each section); shows a tidy
  // empty state when there are none.
  const guestColors = ['#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#F43F5E'];
  const renderGuestTable = (rows, { serialOffset = 0, emptyText = 'No guests match this view.' } = {}) => {
    const headBg = darkMode
      ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
      : 'linear-gradient(180deg, rgba(var(--app-primary-rgb, 99,102,241), 0.07), rgba(var(--app-primary-rgb, 99,102,241), 0))';
    const headCellSx = {
      py: 1.5, px: 1.5, fontSize: 11, fontWeight: 800,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: darkMode ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.65)',
      borderBottom: `2px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(var(--app-primary-rgb, 99,102,241), 0.18)'}`,
      background: 'transparent',
    };
    const bodyRowDivider = darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.06)';
    const cellSx = { py: 1.4, px: 1.5, fontSize: 13, color: darkMode ? '#f3f4f6' : '#1e293b', borderBottom: bodyRowDivider };
    const actionBtn = {
      p: 0.9, mx: 0.25,
      color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)',
      transition: 'background 0.25s ease, color 0.25s ease, transform 0.2s ease',
      '&:hover': { color: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.12)', transform: 'translateY(-1px)' },
    };
    if (rows.length === 0) {
      return (
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          sx={{
            mt: 1, py: 5, px: 3, textAlign: 'center', borderRadius: '12px',
            border: `1px dashed ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}`,
            color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)',
          }}
        >
          <Box sx={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--app-primary)', fontWeight: 800, mb: 1 }}>— Nothing here</Box>
          <Box sx={{ fontFamily: 'serif', fontSize: 18, fontWeight: 400 }}>{emptyText}</Box>
        </Box>
      );
    }
    return (
      <TableContainer sx={{ borderRadius: '12px' }}>
        <Table size="small" sx={{ background: headBg, backgroundRepeat: 'no-repeat', backgroundSize: '100% 56px' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headCellSx, width: 56 }}>#</TableCell>
              <TableCell sx={headCellSx}>Guest</TableCell>
              <TableCell sx={headCellSx}>Room</TableCell>
              <TableCell sx={headCellSx}>Check-in</TableCell>
              <TableCell sx={headCellSx}>Check-out</TableCell>
              <TableCell sx={{ ...headCellSx, textAlign: 'right' }}>Total</TableCell>
              <TableCell align="center" sx={{ ...headCellSx, width: 200 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence initial={false}>
              {rows.map((booking, idx) => {
                const serial = serialOffset + idx + 1;
                const bookingRoomId = typeof booking.roomId === 'object' && booking.roomId !== null
                  ? booking.roomId._id : booking.roomId;
                const room = rooms.find(r => r._id === bookingRoomId);
                const roomNumber = (room?.roomNumber || room?.number || booking.roomNumber || '').toString();
                const initial = (booking.guestName || '?').trim().charAt(0).toUpperCase();
                const color = guestColors[(booking.guestName || '').length % guestColors.length];
                const roomShortfall = (Number(booking.totalAmount) || 0) - (Number(booking.paidAmount) || 0);
                const hasShortfall = roomShortfall > 0.01;
                return (
                  <Box
                    component={motion.tr}
                    key={booking._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, delay: idx * 0.035, ease: EASE_OUT }}
                    whileHover={{ y: -1 }}
                    sx={{
                      position: 'relative',
                      '& > td': { transition: 'background 0.25s ease' },
                      '&:hover > td': {
                        background: darkMode
                          ? 'rgba(var(--app-primary-rgb, 99,102,241), 0.10)'
                          : 'rgba(var(--app-primary-rgb, 99,102,241), 0.06)',
                      },
                      '&:last-child > td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell sx={{ ...cellSx, fontWeight: 800, color: 'var(--app-primary)' }}>
                      {String(serial).padStart(2, '0')}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 30, height: 30, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 800, fontSize: 13,
                            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                            boxShadow: `0 6px 14px -6px ${color}AA`,
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </Box>
                        <Box sx={{ fontWeight: 600 }}>{booking.guestName}</Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex', alignItems: 'center',
                          px: 1.2, py: 0.4, borderRadius: '999px',
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                          color: 'var(--app-primary)',
                          background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.10)',
                          border: '1px solid rgba(var(--app-primary-rgb, 99,102,241), 0.22)',
                        }}
                      >
                        {roomNumber || booking.roomType || '—'}
                      </Box>
                    </TableCell>
                    <TableCell sx={cellSx}>{format(parseISO(booking.checkIn), 'PP')}</TableCell>
                    <TableCell sx={cellSx}>{format(parseISO(booking.checkOut), 'PP')}</TableCell>
                    <TableCell sx={{ ...cellSx, textAlign: 'right' }}>
                      <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Box sx={{ fontWeight: 800, fontSize: 14, color: darkMode ? '#f3f4f6' : '#0f172a' }}>
                          {currencySym()}{Number(booking.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Box>
                        {hasShortfall && (
                          <Box sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#dc2626' }}>
                            {currencySym()}{roomShortfall.toFixed(2)} due
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={cellSx}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => { setDetailsBooking(booking); setDetailsDialogOpen(true); }} sx={actionBtn}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {booking.groupId && (
                        <Tooltip title="Rooming list — assign rooms">
                          <IconButton size="small" onClick={() => { setRoomingGroupId(booking.groupId); setRoomingOpen(true); }} sx={actionBtn}>
                            <ListAltIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={hasShortfall ? `Settle balance · ${currencySym()}${roomShortfall.toFixed(2)} due` : 'Settle balance'}>
                        <IconButton
                          size="small"
                          onClick={() => { setSettleBooking(booking); setSettleDialogOpen(true); }}
                          sx={{
                            ...actionBtn,
                            color: hasShortfall ? '#dc2626' : actionBtn.color,
                            '&:hover': hasShortfall
                              ? { color: '#dc2626', background: 'rgba(220, 38, 38, 0.10)', transform: 'translateY(-1px)' }
                              : actionBtn['&:hover'],
                          }}
                        >
                          <PaymentsOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print Receipt">
                        <IconButton size="small" onClick={() => handlePrintInvoice(booking)} sx={actionBtn}>
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print Guest Form">
                        <IconButton size="small" onClick={() => { setSelectedBookingForPrint(booking); setGuestPrintFormOpen(true); }} sx={actionBtn}>
                          <DescriptionIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </Box>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <PageLayout>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BookOnlineIcon sx={{ fontSize: 42, color: settings.theme.accentColor, fontWeight: 300 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--app-primary)' }}>
              Bookings Management
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Manage all guest reservations
            </Typography>
          </Box>
        </Box>
        {/* Booking-creation actions belong to the Active view only — hidden
            on the Checked Out Guests list, which is read-only history. */}
        {showActive && (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Group / Company are no longer separate buttons — the single
              "New Booking" flow hosts all three via an in-dialog type toggle. */}
          {/* Ghost action — Select Guest */}
          <Box
            component={motion.button}
            type="button"
            onClick={handleOpenGuestDialog}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            sx={{
              all: 'unset', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 1.25,
              px: 2.5, py: 1.1,
              borderRadius: '999px',
              fontSize: 12, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: darkMode ? '#f3f4f6' : '#1e293b',
              background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
              border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}`,
              transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease, color 0.25s ease',
              '& .ghost-icon': {
                display: 'inline-flex', color: 'var(--app-primary)',
                transition: 'transform 0.3s ease',
              },
              '&:hover': {
                color: 'var(--app-primary)',
                borderColor: 'var(--app-primary)',
                background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.08)',
                boxShadow: '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.10)',
              },
              '&:hover .ghost-icon': { transform: 'translateX(-2px) scale(1.08)' },
            }}
          >
            <Box component="span" className="ghost-icon">
              <PersonSearchOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            Select Guest
          </Box>

          {/* Primary CTA — New Booking (Individual / Group / Company) */}
          <Box
            component={motion.button}
            type="button"
            onClick={handleNewBooking}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            sx={{
              all: 'unset', cursor: 'pointer', position: 'relative',
              display: 'inline-flex', alignItems: 'center', gap: 1.25,
              px: 2.75, py: 1.15,
              borderRadius: '999px',
              fontSize: 12, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#fff',
              background: 'var(--app-primary)',
              backgroundSize: '150% 100%',
              backgroundPosition: '0% 0%',
              boxShadow: '0 10px 24px -10px rgba(var(--app-primary-rgb, 99,102,241), 0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              transition: 'background-position 0.5s ease, box-shadow 0.3s ease, transform 0.2s ease',
              overflow: 'hidden',
              '& .cta-plus': {
                display: 'inline-flex', transition: 'transform 0.35s ease',
              },
              '& .cta-arrow': {
                display: 'inline-flex', transition: 'transform 0.35s ease, opacity 0.25s ease',
                opacity: 0.6,
              },
              '&::before': {
                content: '""', position: 'absolute', inset: -2, borderRadius: '999px',
                background: 'var(--app-primary)',
                filter: 'blur(14px)', opacity: 0.45, zIndex: -1,
                transition: 'opacity 0.3s ease, filter 0.3s ease',
              },
              '&:hover': {
                backgroundPosition: '100% 0%',
                boxShadow: '0 14px 30px -10px rgba(var(--app-primary-rgb, 99,102,241), 0.70), inset 0 1px 0 rgba(255,255,255,0.22)',
              },
              '&:hover::before': { opacity: 0.70, filter: 'blur(18px)' },
              '&:hover .cta-plus':  { transform: 'rotate(180deg)' },
              '&:hover .cta-arrow': { transform: 'translateX(4px)', opacity: 1 },
            }}
          >
            <Box component="span" className="cta-plus">
              <AddIcon sx={{ fontSize: 18 }} />
            </Box>
            New Booking
            <Box component="span" className="cta-arrow">
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </Box>
        )}
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      ) : (
        <>
          {/* Active Bookings Section */}
          {showActive && (() => {
            const activeFiltered = (Array.isArray(bookings) ? bookings : [])
              .filter(b => b.bookingStatus !== 'Completed' && b.bookingStatus !== 'Checked Out' && b.bookingStatus !== 'Checkout')
              // Group/Company views: one row per cluster (the master).
              .filter(b => !bookingType || (b.bookingType === bookingType && b.isGroupMaster));
            return (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary', fontWeight: 500 }}>
                  {activeHeading}
                </Typography>
                <Grid container spacing={3}>
                  {activeFiltered
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((booking, index) => (
                      <Grid
                        key={booking._id}
                        size={{
                          xs: 12,
                          sm: 6,
                          md: 4
                        }}>
                        <BookingCard
                          index={index}
                          booking={booking}
                          onEdit={() => handleOpenDialog(booking)}
                          onDelete={() => handleDeleteBooking(booking._id)}
                          onUpdateStatus={handleUpdateBookingStatus}
                          onPrintInvoice={() => handlePrintInvoice(booking)}
                          onTransfer={() => { setTransferBooking(booking); setTransferDialogOpen(true); }}
                          onRoomingList={(b) => { setRoomingGroupId(b.groupId); setRoomingOpen(true); }}
                          onSendWelcome={openWelcomeFor}
                          isProcessingCheckout={processingCheckoutIds.has(booking._id)}
                        />
                      </Grid>
                    ))}
                </Grid>
                {activeFiltered.length === 0 && (
                  <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                    sx={{
                      mt: 1, py: 5, px: 3, textAlign: 'center',
                      borderRadius: '12px',
                      border: `1px dashed ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}`,
                      color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)',
                    }}
                  >
                    <Box sx={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--app-primary)', fontWeight: 800, mb: 1 }}>
                      — Nothing here
                    </Box>
                    <Box sx={{ fontFamily: 'serif', fontSize: 18, fontWeight: 400 }}>
                      No active bookings match this view.
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })()}

          {/* Guests Section — In Hotel (current) + Checked Out (history) */}
          {showCheckedOut && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary', fontWeight: 500 }}>
              Guests
            </Typography>
            <Paper
              sx={{
                position: 'relative',
                p: { xs: 2, sm: 3 },
                background: darkMode
                  ? 'rgba(30, 35, 45, 0.55)'
                  : 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2 + 0.55))',
                backdropFilter: 'blur(16px) saturate(140%)',
                WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                borderRadius: '18px',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
                boxShadow: darkMode
                  ? '0 24px 60px -28px rgba(0,0,0,0.55)'
                  : '0 24px 60px -28px rgba(15,23,42,0.20)',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0, left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg, var(--app-primary), var(--app-secondary, #EC4899), var(--app-accent, #F59E0B))',
                  opacity: 0.85,
                },
              }}
            >
              {/* Flex-wrap so the controls keep a min width and wrap to the
                  next line instead of overlapping when space is tight. */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3, mt: 0.5 }}>
                <Box sx={{ flex: '2 1 240px', minWidth: 220 }}>
                  <SearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    darkMode={darkMode}
                    label="Search"
                    hint="By guest name or room"
                    placeholder="Type a name, room…"
                  />
                </Box>
                <Box sx={{ flex: '1 1 180px', minWidth: 170 }}>
                  <StatusFilter
                    value={statusFilter}
                    onChange={setStatusFilter}
                    darkMode={darkMode}
                  />
                </Box>
                <Box sx={{ flex: '1 1 180px', minWidth: 170 }}>
                  <StatusFilter
                    value={paymentFilter}
                    onChange={setPaymentFilter}
                    darkMode={darkMode}
                    options={PAYMENT_OPTIONS}
                    label="Payment"
                  />
                </Box>
                <Box sx={{ flex: '1 1 190px', minWidth: 180 }}>
                  <DateRangePicker
                    from={coDateFrom}
                    to={coDateTo}
                    onChange={({ from, to }) => { setCoDateFrom(from); setCoDateTo(to); }}
                    darkMode={darkMode}
                  />
                </Box>
                <Box sx={{ flex: '0 0 auto', ml: 'auto' }}>
                  <Button
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); setCoDateFrom(''); setCoDateTo(''); }}
                    sx={{
                      px: 3.5, py: 1.4, minWidth: 96,
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'var(--app-primary)',
                      background: 'transparent',
                      border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
                      transition: 'background 0.25s ease, border-color 0.25s ease, transform 0.2s ease',
                      '&:hover': {
                        borderColor: 'var(--app-primary)',
                        background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.08)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>

              {(() => {
                const matchesSearch = (b) => {
                  if (searchQuery.trim() === '') return true;
                  const guestName = (b.guestName || '').toLowerCase();
                  const bookingRoomId = typeof b.roomId === 'object' && b.roomId !== null ? b.roomId._id : b.roomId;
                  const room = rooms.find(r => r._id === bookingRoomId);
                  const roomNumber = room ? (room.roomNumber || room.number || '') : (b.roomNumber || '');
                  return guestName.includes(searchQuery.toLowerCase()) || String(roomNumber).includes(searchQuery);
                };
                const matchesDates = (b) => {
                  if (!coDateFrom && !coDateTo) return true;
                  const ci = b.checkIn ? new Date(b.checkIn) : null;
                  const co = b.checkOut ? new Date(b.checkOut) : null;
                  const from = coDateFrom ? new Date(`${coDateFrom}T00:00:00`) : null;
                  const to = coDateTo ? new Date(`${coDateTo}T23:59:59`) : null;
                  if (from && co && co < from) return false; // stay ended before the window
                  if (to && ci && ci > to) return false;      // stay began after the window
                  return true;
                };
                const matchesPayment = (b) => paymentFilter === 'all' || b.paymentStatus === paymentFilter;

                const baseRows = (Array.isArray(bookings) ? bookings : [])
                  .filter(b => matchesSearch(b) && matchesDates(b) && matchesPayment(b));
                // 'In Hotel' = checked in and still staying (bookingStatus 'Confirmed').
                const inHotelRows = baseRows.filter(b => b.bookingStatus === 'Confirmed');
                const checkedOutAll = baseRows.filter(b => ['Completed', 'Checked Out', 'Checkout'].includes(b.bookingStatus));

                const showIn = statusFilter === 'all' || statusFilter === 'In Hotel';
                const showOut = statusFilter === 'all' || statusFilter === 'Completed';

                const coTotal = checkedOutAll.length;
                const coPageRows = checkedOutAll.slice(
                  pageCheckedOut * rowsPerPageCheckedOut,
                  pageCheckedOut * rowsPerPageCheckedOut + rowsPerPageCheckedOut,
                );

                const sectionLabelSx = {
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'var(--app-primary)', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1,
                };
                const countPill = (n, fg, bg) => (
                  <Box component="span" sx={{ px: 1, py: 0.1, borderRadius: '999px', fontSize: 11, fontWeight: 800, color: fg, background: bg }}>{n}</Box>
                );

                return (
                  <>
                    {showIn && (
                      <Box sx={{ mb: showOut ? 4 : 0 }}>
                        <Box sx={sectionLabelSx}>In Hotel {countPill(inHotelRows.length, '#10B981', 'rgba(16,185,129,0.13)')}</Box>
                        {renderGuestTable(inHotelRows, { emptyText: 'No in-hotel guests match this view.' })}
                      </Box>
                    )}

                    {showOut && (
                      <Box>
                        <Box sx={sectionLabelSx}>Checked Out {countPill(coTotal, 'var(--app-primary)', 'rgba(var(--app-primary-rgb, 99,102,241),0.13)')}</Box>
                        {renderGuestTable(coPageRows, {
                          serialOffset: pageCheckedOut * rowsPerPageCheckedOut,
                          emptyText: 'No checked-out guests match this view.',
                        })}
                        {coTotal > 0 && (
                          <Box sx={{
                            mt: 1.5, pt: 1.5,
                            borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
                            '& .MuiTablePagination-toolbar': { px: 0, color: darkMode ? '#f3f4f6' : '#1e293b' },
                            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
                              color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)',
                            },
                            '& .MuiTablePagination-actions .MuiIconButton-root': {
                              color: 'var(--app-primary)',
                              transition: 'background 0.2s ease',
                              '&:hover': { background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.10)' },
                              '&.Mui-disabled': { color: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(15,23,42,0.20)' },
                            },
                          }}>
                            <TablePagination
                              rowsPerPageOptions={[10, 20, 50]}
                              component="div"
                              count={coTotal}
                              rowsPerPage={rowsPerPageCheckedOut}
                              page={pageCheckedOut}
                              onPageChange={handleChangePageCheckedOut}
                              onRowsPerPageChange={handleChangeRowsPerPageCheckedOut}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                  </>
                );
              })()}
            </Paper>
          </Box>
          )}
        </>
      )}
      <FormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="lg"
        icon={<HotelIcon />}
        eyebrow="Front Desk"
        title={selectedBooking ? 'Edit Booking' : 'New Booking'}
        hideActions
      >
          {!selectedBooking && (
            <Box sx={{ mb: 2.5 }}>
              <BookingTypeSelector value={bookingMode} onChange={switchBookingMode} />
            </Box>
          )}
          <BookingForm
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            handleDateChange={handleDateChange}
            handleRoomChange={handleRoomChange}
            handlePaidAmountChange={handlePaidAmountChange}
            handlePincodeChange={handlePincodeChange}
            handleSubmit={handleSubmit}
            rooms={rooms}
            selectedBooking={selectedBooking}
            handleBack={handleBack}
            handleNext={handleNext}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            booking={selectedBooking}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            handleTimeChange={handleTimeChange}
          />
      </FormDialog>
      <CheckoutDialog
        open={checkoutDialogOpen}
        onClose={() => {
          setCheckoutDialogOpen(false);
          // Remove from processing set if dialog is cancelled
          if (checkoutBooking) {
            setProcessingCheckoutIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(checkoutBooking._id);
              return newSet;
            });
          }
          setCheckoutBooking(null);
          setCheckoutRoom(null);
        }}
        booking={checkoutBooking}
        room={checkoutRoom}
        onPaymentComplete={handlePaymentComplete}
      />
      <GuestWelcomeDialog
        open={!!welcomeBooking}
        onClose={() => { setWelcomeBooking(null); setWelcomeRoom(null); }}
        booking={welcomeBooking}
        room={welcomeRoom}
        settings={settings}
        onNotify={showSnackbar}
      />
      <SettleBalanceDialog
        open={settleDialogOpen}
        onClose={() => { setSettleDialogOpen(false); setSettleBooking(null); }}
        booking={settleBooking}
        onSettled={(info) => {
          showSnackbar(`Recorded ${currencySym()}${info.amount.toFixed(2)} payment`, 'success');
          fetchBookings?.();
        }}
      />
      <GroupBookingDialog
        open={groupDialogOpen}
        onClose={() => { setGroupDialogOpen(false); setBookingMode('individual'); }}
        rooms={rooms}
        typeSelector={<BookingTypeSelector value={bookingMode} onChange={switchBookingMode} />}
        onCreated={(msg) => { setBookingMode('individual'); showSnackbar(msg, 'success'); refreshData(); }}
      />
      <CompanyBookingDialog
        open={companyDialogOpen}
        onClose={() => { setCompanyDialogOpen(false); setBookingMode('individual'); }}
        rooms={rooms}
        typeSelector={<BookingTypeSelector value={bookingMode} onChange={switchBookingMode} />}
        onManageCompanies={() => setCompaniesOpen(true)}
        onCreated={(msg) => { setBookingMode('individual'); showSnackbar(msg, 'success'); refreshData(); }}
      />
      <RoomTransferDialog
        open={transferDialogOpen}
        onClose={() => { setTransferDialogOpen(false); setTransferBooking(null); }}
        booking={transferBooking}
        rooms={rooms}
        onTransferred={(msg) => { showSnackbar(msg, 'success'); refreshData(); }}
      />
      <RoomingListDialog
        open={roomingOpen}
        onClose={() => { setRoomingOpen(false); setRoomingGroupId(null); }}
        groupId={roomingGroupId}
        rooms={rooms}
        onUpdated={() => { showSnackbar('Rooming list updated', 'success'); refreshData(); }}
      />
      <CompaniesManager
        open={companiesOpen}
        onClose={() => setCompaniesOpen(false)}
        rooms={rooms}
        onChanged={() => {}}
      />
      {invoiceDialogOpen && (
        <FormDialog
          open={invoiceDialogOpen}
          onClose={() => setInvoiceDialogOpen(false)}
          maxWidth="md"
          icon={<ReceiptLongIcon />}
          eyebrow="Billing"
          title="Invoice Preview"
          cancelLabel="Close"
          submitLabel="Print"
          onSubmit={async (e) => {
            if (e?.preventDefault) e.preventDefault();
            if (selectedBooking) {
              try {
                const response = await api.post(`/invoices/booking/${selectedBooking._id}`, {
                  template: 'luxury_room_booking'
                });

                const htmlContent = response.data;

                // Open print preview window with the new professional template
                const printWindow = window.open('', '_blank', 'width=900,height=1200,scrollbars=yes,resizable=yes');
                if (printWindow) {
                  printWindow.document.write(htmlContent);
                  printWindow.document.close();
                  printWindow.focus();

                  // Auto-print after content loads
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.onafterprint = () => {
                        printWindow.close();
                      };
                    }, 500);
                  };
                } else {
                  throw new Error('Please allow popups to print invoices');
                }
              } catch (error) {
                console.error('Error printing professional invoice:', error);
                showSnackbar('Failed to print invoice: ' + error.message, 'error');
              }
            }
          }}
        >
          <FormSection title="Invoice" icon={<ReceiptLongIcon fontSize="small" />} iconColor="#6366f1">
            <Typography variant="body2" color="textSecondary">
              Click Print to generate and print the invoice using the selected template from settings.
            </Typography>
          </FormSection>
        </FormDialog>
      )}
      {/* Guest Print Form Dialog */}
      <GuestPrintForm
        open={guestPrintFormOpen}
        onClose={() => {
          setGuestPrintFormOpen(false);
          setSelectedBookingForPrint(null);
        }}
        booking={selectedBookingForPrint}
        room={
          selectedBookingForPrint
            ? (typeof selectedBookingForPrint.roomId === 'object'
              ? selectedBookingForPrint.roomId
              : rooms.find(r => r._id === selectedBookingForPrint.roomId))
            : null
        }
        restaurantOrders={[]}
      />
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ 
            width: '100%',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            borderRadius: 2,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <FormDialog
        open={guestDialogOpen}
        onClose={handleCloseGuestDialog}
        maxWidth="md"
        icon={<PersonSearchIcon />}
        eyebrow="Front Desk"
        title="Select Guest"
        hideCancel
        submitLabel="Close"
      >
        <FormSection>
          <Guests onSelectGuest={handleSelectGuestForBooking} />
        </FormSection>
      </FormDialog>
      <BookingDetailsDialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        booking={detailsBooking}
      />
    </PageLayout>
  );
};
        
export default Bookings;
