import { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Box, Grid, Typography, IconButton, Button,
  Dialog, DialogContent, DialogActions,
  TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, CircularProgress, Chip,
  Divider, Stack, useTheme,
  Checkbox, FormControlLabel, FormGroup,
  Stepper, Step, StepButton,
} from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  CalendarMonth as CalendarIcon,
  People as PeopleIcon,
  Celebration as CelebrationIcon,
  Print as PrintIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import PageLayout from '../../components/layout/PageLayout';
import { motion } from 'framer-motion';
import { useSettings } from '../../contexts/SettingsContext';
import invoiceService from '../../services/invoiceService';
import api from '../../api';
import { currencySym, liveBilling } from '../../utils/billing';
import EventCalendar from '../../components/banquet/EventCalendar';
import EventPackagesManager from '../../components/banquet/EventPackagesManager';
import CateringPackagesManager from '../../components/banquet/CateringPackagesManager';
import DecorationPackagesManager from '../../components/banquet/DecorationPackagesManager';
import UtensilsManager from '../../components/banquet/UtensilsManager';
import AdvancePaymentsDialog from '../../components/banquet/AdvancePaymentsDialog';
import FinalizeBillingDialog from '../../components/banquet/FinalizeBillingDialog';
import PaymentsIcon from '@mui/icons-material/Payments';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import BlenderOutlinedIcon from '@mui/icons-material/BlenderOutlined';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from '../../components/forms/formStyles';
import {
  FLOOR_OPTIONS,
  BANQUET_ROOM_RATE,
  roomFloorLevel,
  levelsForFloors,
  ID_PROOF_TYPES,
  EVENT_TYPES,
  SEATING_STYLES,
  eventCategory,
  addOnsForCategory,
  isDurationPricedType,
  POLICY_FIELDS,
  policyDefaultsForType,
  isAutoPolicyValue,
  BOOKING_STATUS,
  BOOKING_STEPS,
  emptyCateringItem,
  emptyDecorationItem,
  emptyUtensilItem,
  MEAL_OPTIONS,
  initialFormData,
} from './banquet/bookingConstants';
import {
  calculateFloorCost,
  calculateRemainingAmount,
  calculateEventDuration,
  getEventTimingDefaults,
  cateringItemAmount,
  sumCateringItems,
  sumDecorationItems,
  utensilItemAmount,
  sumUtensilItems,
} from './banquet/bookingPricing';
import HkKpiCard from '../operations/housekeeping/HkKpiCard';
import BanquetHeader from './banquet/BanquetHeader';
import BanquetTabs from './banquet/BanquetTabs';
import UpcomingEvents from './banquet/UpcomingEvents';
import HallAvailability from './banquet/HallAvailability';
import BookingsTable from './banquet/BookingsTable';
import BanquetCharts from './banquet/BanquetCharts';
import BanquetEmptyState from './banquet/BanquetEmptyState';
import { BQ, moneyShort, eventStart, isSameDay, startOfDay } from './banquet/banquetDash';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';

// Guards the multi-step wizard: if one step's render throws, this shows the
// error inline instead of letting the whole dialog unmount (which looked like
// the dialog "disappearing" the moment the Payment step rendered). Advancing
// or going back clears the error so navigation keeps working.
class WizardStepBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface the real cause in the console for diagnosis.
    // eslint-disable-next-line no-console
    console.error('[BanquetHallBooking] step render error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.stepKey !== this.props.stepKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Alert severity="error" sx={{ my: 2 }}>
          This step couldn’t be displayed: {String(this.state.error?.message || this.state.error)}.
          Use “Back” to continue, and please share this message so it can be fixed.
        </Alert>
      );
    }
    return this.props.children;
  }
}

// Keep only the 10-digit local part of a phone number (drops a +91 / spaces),
// and a display formatter that groups it "98765 43210" for readability. The +91
// is shown as a fixed field prefix and is never stored in the value.
const phoneLocal10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);
const formatPhone10 = (v) => {
  const d = phoneLocal10(v);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
};

const BanquetHallBooking = () => {
  const { settings } = useSettings();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [selectedMonth, _setSelectedMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState([]);
  const [rooms, setRooms] = useState([]);

  // View switcher (list / calendar / packages) + calendar month nav.
  const [view, setView] = useState('overview');
  const _todayCal = new Date();
  const [calMonth, setCalMonth] = useState(_todayCal.getMonth() + 1);
  const [calYear, setCalYear] = useState(_todayCal.getFullYear());
  const [halls, setHalls] = useState([]);

  // Reusable packages selectable on the booking form.
  const [eventPackages, setEventPackages] = useState([]);
  const [cateringPackages, setCateringPackages] = useState([]);
  const [decorationPackages, setDecorationPackages] = useState([]);
  const [utensilCatalog, setUtensilCatalog] = useState([]); // with live available/reserved

  // Step-by-step wizard position within the booking dialog.
  const [activeStep, setActiveStep] = useState(0);
  // When the final (Payment) step was entered — used to ignore an accidental
  // submit fired by the Next→"Create booking" button swap (a double-click whose
  // second click lands on the freshly-shown submit button would otherwise
  // create the booking and close the dialog the instant Payment appears).
  const paymentStepEnteredAt = useRef(0);

  // Advance-collection ledger dialog.
  const [paymentsBooking, setPaymentsBooking] = useState(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [finalizeBooking, setFinalizeBooking] = useState(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const goPrevMonth = () => {
    setCalMonth((m) => { if (m === 1) { setCalYear((y) => y - 1); return 12; } return m - 1; });
  };
  const goNextMonth = () => {
    setCalMonth((m) => { if (m === 12) { setCalYear((y) => y + 1); return 1; } return m + 1; });
  };

  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.rooms.getAll();
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      setRooms([]);
    }
  }, []);

  // Get marriage settings
  const banquetHallBookingSettings = settings.banquetHallBooking || {};
  // Default event duration (hours) for new non-wedding bookings — Operations settings.
  const defaultEventHours = settings?.operations?.banquet?.defaultEventHours;

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.banquet.getBookings();
      
      // Handle different response structures
      let bookingsData = [];
      if (response.data) {
        bookingsData = Array.isArray(response.data) ? response.data : 
                      Array.isArray(response.data.data) ? response.data.data : [];
      } else if (Array.isArray(response)) {
        bookingsData = response;
      }
      
      setBookings(bookingsData);
    } catch (error) {
      setBookings([]); // Ensure bookings is always an array
      showSnackbar('Failed to fetch bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const fetchAvailableDates = useCallback(async (date) => {
    try {
      const _month = date.getMonth() + 1;
      const _year = date.getFullYear();
      // Note: Available dates endpoint may not exist for banquet, using fallback
      const response = await api.banquet.getBookings();
      setAvailableDates(response.data || []);
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchAvailableDates(selectedMonth);
    fetchRooms();
  }, [fetchBookings, fetchAvailableDates, selectedMonth, fetchRooms]);

  // Load halls + reusable packages once, for the package managers and the
  // event/catering package pickers on the booking form.
  const fetchPackages = useCallback(async (excludeBooking = null) => {
    try {
      const [evt, cat, dec, uten] = await Promise.all([
        api.banquet.getPackages(),
        api.banquet.getCateringPackages(),
        api.banquet.getDecorationPackages(),
        api.banquet.getUtensilItems(excludeBooking),
      ]);
      setEventPackages(evt.data?.data || []);
      setCateringPackages(cat.data?.data || []);
      setDecorationPackages(dec.data?.data || []);
      setUtensilCatalog(uten.data?.data || []);
    } catch { /* packages are optional on the form */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.banquet.getHalls();
        setHalls(data?.data || []);
      } catch { /* halls are optional here */ }
    })();
    fetchPackages();
  }, [fetchPackages]);

  // Helper to calculate number of days between two dates (inclusive)
  const getNumberOfDays = (start, end) => {
    if (!start) {return 1;}
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = end ? (typeof end === 'string' ? new Date(end) : end) : startDate;
    const diff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 1;
  };

  // Auto-calculate totalAmount and remainingAmount when dependencies change.
  // Pricing model: venue (floor or duration) + decoration + catering + extras,
  // where decoration and catering are the SUM of their repeatable line items
  // (plus any decoration carried by an applied event package).
  useEffect(() => {
    const isDurationPriced = isDurationPricedType(formData.eventType);
    const usingPackage = !isDurationPriced && !!formData.packageId;

    // Days the booking actually spans, from the start datetime to the end
    // datetime, so a 22 10:00 → 26 22:00 conference = 5 days while a standard
    // overnight wedding (22 10:00 → 23 09:00) stays 1 day (not 2). Drives both
    // the duration charge and the per-day reserved-room charge.
    const numberOfDays = (() => {
      if (!formData.eventDate) { return 1; }
      const startDT = new Date(`${formData.eventDate}T${formData.startTime || '10:00'}:00`);
      let endDT = new Date(`${formData.endDate || formData.eventDate}T${formData.endTime || formData.startTime || '10:00'}:00`);
      if (Number.isNaN(startDT.getTime()) || Number.isNaN(endDT.getTime())) {
        return Math.max(1, getNumberOfDays(formData.eventDate, formData.endDate));
      }
      if (endDT <= startDT) { endDT = new Date(endDT.getTime() + 86400000); } // overnight → next day
      return Math.max(1, Math.ceil((endDT - startDT) / 86400000));
    })();

    // ── Venue / floor cost (+ any decoration bundled in an event package) ──
    let floorCost = 0;
    let packageDecoration = 0;
    if (isDurationPriced) {
      // Duration events bill the per-day hours × the hourly rate × the number of
      // days, so a multi-day conference counts every day (not just day one).
      floorCost = (parseFloat(formData.eventDuration) || 0) * liveBilling().banquetVenueHourlyRate * numberOfDays;
    } else if (usingPackage) {
      floorCost = Number(formData.packageBasePrice) || 0;
      packageDecoration = Number(formData.packageDecorationCost) || 0;
    } else {
      floorCost = calculateFloorCost(formData.selectedFloors);
    }

    // ── Decoration & catering — summed from the repeatable line items ──
    const decorationCost = packageDecoration + sumDecorationItems(formData.decorationItems);
    const cateringCost = sumCateringItems(formData.cateringItems, formData.guestCount);

    // ── Reserved guest rooms (apart from the hall/floor package) ──
    // Charged at the banquet per-room rate PER DAY the event runs; complimentary
    // rooms are free. A 5-day event holds the rooms for 5 days.
    const reservedRooms = Array.isArray(formData.rooms) ? formData.rooms.length : 0;
    const complimentaryRooms = parseInt(formData.complimentaryRooms, 10) || 0;
    const chargeableRooms = Math.max(0, reservedRooms - complimentaryRooms);
    const roomsCost = chargeableRooms * BANQUET_ROOM_RATE * numberOfDays;

    // Rented utensils / cookware (self-cooking guests) — sum of line amounts.
    const utensilsCost = sumUtensilItems(formData.utensilItems);

    // Vendor extras (photography + entertainment) add to the billed total.
    const extrasCost = (parseFloat(formData.photographyAmount) || 0) + (parseFloat(formData.entertainmentCost) || 0);

    const totalAmount = floorCost + roomsCost + decorationCost + cateringCost + utensilsCost + extrasCost;

    const advanceAmount = parseFloat(formData.advanceAmount) || 0;
    const remainingAmount = calculateRemainingAmount(totalAmount, advanceAmount);
    const eventDuration = calculateEventDuration(formData.startTime, formData.endTime);

    setFormData(prev => ({
      ...prev,
      floorCost,
      roomsCost,
      decorationCost,
      menuCost: cateringCost,
      utensilsCost,
      numberOfDays,
      totalAmount,
      remainingAmount,
      eventDuration,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.selectedFloors, formData.rooms, formData.complimentaryRooms, formData.decorationItems, formData.cateringItems, formData.utensilItems, formData.guestCount, formData.packageId, formData.packageBasePrice, formData.packageDecorationCost, formData.advanceAmount, formData.eventType, formData.eventDate, formData.endDate, formData.startTime, formData.endTime, formData.photographyAmount, formData.entertainmentCost]);

  // Remember when the Payment (final) step was shown, for the submit guard.
  useEffect(() => {
    if (activeStep === BOOKING_STEPS.length - 1) {
      paymentStepEnteredAt.current = Date.now();
    }
  }, [activeStep]);

  const handleCloseDialog = () => {
    setOpenDialog(false);
    if (!selectedBooking) {
      setFormData(initialFormData);
    }
    setSelectedBooking(null);
    setActiveStep(0);
  };

  const handleOpenDialog = (booking = null, preset = null) => {
    // Refresh the pickers; when editing, exclude this booking's own utensils from
    // the reserved count so its current quantities read as available.
    fetchPackages(booking?._id || null);
    if (booking) {
      const bookingData = {
        ...initialFormData,
        ...booking,
        customerName: booking.customerName || '',
        customerPhone: phoneLocal10(booking.customerPhone),
        alternatePhone: phoneLocal10(booking.alternatePhone),
        customerEmail: booking.customerEmail || '',
        eventType: booking.eventType || 'Wedding',
        eventDate: booking.eventDate ? format(parseISO(new Date(booking.eventDate).toISOString()), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        startTime: booking.startTime || '10:00',
        endTime: booking.endTime || '22:00',
        guestCount: booking.guestCount || '',
        advanceAmount: booking.advanceAmount || '',
        status: booking.status || 'Pending',
        specialRequests: booking.specialRequests || '',
        decorationType: booking.decorationType || '',
        decorationDetails: booking.decorationDetails || '',
        decorationCost: booking.decorationCost || 0,

        // Repeatable decoration line items. For older bookings (no package),
        // rebuild a single item from the legacy decorationType/decorationCost.
        decorationItems: Array.isArray(booking.decorationItems) && booking.decorationItems.length
          ? booking.decorationItems.map((it) => ({
            decorationPackageId: it.packageId?._id || it.packageId || '',
            name: it.name || '',
            category: it.category || '',
            cost: it.cost || 0,
            details: it.details || '',
          }))
          : ((!booking.packageId && booking.decorationType && (booking.decorationCost || 0) > 0)
            ? [{
              decorationPackageId: '',
              name: booking.decorationType || 'Decoration',
              category: booking.decorationType || '',
              cost: booking.decorationCost || 0,
              details: booking.decorationDetails || '',
            }]
            : []),
        selectedFloors: (booking.selectedFloors || booking.floorSelection || [])
          .filter((f) => FLOOR_OPTIONS.some((opt) => opt.value === f)),
        rooms: Array.isArray(booking.rooms) ? booking.rooms.map((r) => (typeof r === 'object' ? r._id : r)) : [],
        eventDuration:
          booking.eventDuration !== undefined && booking.eventDuration !== null
            ? String(booking.eventDuration)
            : (formData.eventDuration !== undefined && formData.eventDuration !== null ? formData.eventDuration : '1'),

        // Event package — reconstruct the package venue/decoration amounts from
        // the saved floorCost/decorationCost so editing keeps the same totals.
        packageId: booking.packageId?._id || booking.packageId || '',
        packageName: booking.packageName || '',
        packageBasePrice: (booking.packageId ? booking.floorCost : 0) || 0,
        packageDecorationCost: (booking.packageId ? booking.decorationCost : 0) || 0,

        // Catering package + plates (falls back to legacy menu.numberOfPlates).
        cateringPackageId: booking.cateringPackageId?._id || booking.cateringPackageId || '',
        cateringPackageName: booking.cateringPackageName || booking.cateringPackage || '',
        cateringPerPlate: booking.cateringPerPlate || 0,
        numberOfPlates: booking.numberOfPlates
          ? String(booking.numberOfPlates)
          : (booking.menu?.numberOfPlates || ''),

        // Repeatable catering line items. Falls back to a single item rebuilt
        // from the legacy per-plate/plates fields for older bookings.
        cateringItems: Array.isArray(booking.cateringItems) && booking.cateringItems.length
          ? booking.cateringItems.map((it) => ({
            cateringPackageId: it.packageId?._id || it.packageId || '',
            name: it.name || '',
            category: it.category || '',
            meal: it.meal || '',
            perPlate: it.perPlate || 0,
            plates: it.plates != null ? String(it.plates) : '',
            // Preserve post-event actuals so a routine edit never reverts the
            // finalized bill back to the estimate.
            actualPlates: it.actualPlates != null ? it.actualPlates : null,
            days: it.days || 1,
          }))
          : ((booking.cateringPerPlate || booking.numberOfPlates || booking.menu?.numberOfPlates)
            ? [{
              cateringPackageId: booking.cateringPackageId?._id || booking.cateringPackageId || '',
              name: booking.cateringPackageName || booking.cateringPackage || 'Catering',
              category: '',
              perPlate: booking.cateringPerPlate || 0,
              plates: String(booking.numberOfPlates || booking.menu?.numberOfPlates || ''),
              days: booking.daysWithMeals || 1,
            }]
            : []),

        // Rented utensils / cookware line items.
        utensilItems: Array.isArray(booking.utensilItems)
          ? booking.utensilItems.map((it) => ({
            utensilItemId: it.itemId?._id || it.itemId || '',
            name: it.name || '',
            unit: it.unit || 'piece',
            cost: it.cost || 0,
            quantity: it.quantity != null ? String(it.quantity) : '',
          }))
          : [],
        utensilsCost: booking.utensilsCost || 0,

        endDate: booking.endDate ? format(parseISO(new Date(booking.endDate).toISOString()), 'yyyy-MM-dd') : '',
        daysWithMeals: booking.daysWithMeals !== undefined && booking.daysWithMeals !== null && booking.daysWithMeals !== '' ? String(booking.daysWithMeals) : String(getNumberOfDays(booking.eventDate, booking.endDate)),

        // Extended customer / KYC
        address: booking.address || '',
        city: booking.city || '',
        state: booking.state || '',
        pincode: booking.pincode || '',
        idProofType: booking.idProofType || '',
        idProofNumber: booking.idProofNumber || '',
        gstNumber: booking.gstNumber || '',

        // Event title + wedding names
        eventTitle: booking.eventTitle || '',
        groomName: booking.groomName || '',
        brideName: booking.brideName || '',

        // Type-specific event details (numbers → strings for the inputs).
        eventDetails: {
          ...initialFormData.eventDetails,
          ...(booking.eventDetails || {}),
          delegates: booking.eventDetails?.delegates ? String(booking.eventDetails.delegates) : '',
          sessionsDays: booking.eventDetails?.sessionsDays ? String(booking.eventDetails.sessionsDays) : '',
          birthdayAge: booking.eventDetails?.birthdayAge ? String(booking.eventDetails.birthdayAge) : '',
        },

        // Venue + guest breakdown (numbers → strings for the inputs)
        venueCapacity: booking.venueCapacity ? String(booking.venueCapacity) : '',
        seatingStyle: booking.seatingStyle || '',
        expectedGuests: booking.expectedGuests ? String(booking.expectedGuests) : '',
        guaranteedGuests: booking.guaranteedGuests ? String(booking.guaranteedGuests) : '',
        vipGuests: booking.vipGuests ? String(booking.vipGuests) : '',
        kidsCount: booking.kidsCount ? String(booking.kidsCount) : '',

        // Room booking
        roomCheckIn: booking.roomCheckIn ? format(parseISO(new Date(booking.roomCheckIn).toISOString()), 'yyyy-MM-dd') : '',
        roomCheckOut: booking.roomCheckOut ? format(parseISO(new Date(booking.roomCheckOut).toISOString()), 'yyyy-MM-dd') : '',
        roomTypes: Array.isArray(booking.roomTypes) ? booking.roomTypes : [],
        complimentaryRooms: booking.complimentaryRooms ? String(booking.complimentaryRooms) : '',
        extraBedRequired: !!booking.extraBedRequired,

        // Coordinator
        salesExecutive: booking.salesExecutive || '',
        eventManager: booking.eventManager || '',
        coordinatorPhone: booking.coordinatorPhone || '',

        // Payment schedule (dueDate → yyyy-MM-dd for the inputs)
        paymentSchedule: Array.isArray(booking.paymentSchedule)
          ? booking.paymentSchedule.map((p) => ({
            label: p.label || '',
            dueDate: p.dueDate ? format(parseISO(new Date(p.dueDate).toISOString()), 'yyyy-MM-dd') : '',
            amount: p.amount != null ? String(p.amount) : '',
            status: p.status || 'Pending',
          }))
          : [],

        // Contract & terms
        cancellationPolicy: booking.cancellationPolicy || '',
        refundPolicy: booking.refundPolicy || '',
        damageCharges: booking.damageCharges || '',
        overtimeCharges: booking.overtimeCharges || '',
        outsideVendorPolicy: booking.outsideVendorPolicy || '',
        termsAccepted: !!booking.termsAccepted,

        // Decoration extras
        decorationOptions: Array.isArray(booking.decorationOptions) ? booking.decorationOptions : [],
        decorVendor: booking.decorVendor || '',

        // Photography & Videography
        photographyRequired: !!booking.photographyRequired,
        videographyRequired: !!booking.videographyRequired,
        droneCoverage: !!booking.droneCoverage,
        preWeddingShoot: !!booking.preWeddingShoot,
        photographyVendor: booking.photographyVendor || '',
        photographyAmount: booking.photographyAmount ? String(booking.photographyAmount) : '',

        // Entertainment
        entertainmentOptions: Array.isArray(booking.entertainmentOptions) ? booking.entertainmentOptions : [],
        entertainmentVendor: booking.entertainmentVendor || '',
        entertainmentCost: booking.entertainmentCost ? String(booking.entertainmentCost) : '',
      };
      setSelectedBooking(booking);
      setFormData(bookingData);
    } else {
      setSelectedBooking(null);
      const today = format(new Date(), 'yyyy-MM-dd');
      const presetType = preset || 'Wedding';
      setFormData({ ...initialFormData, eventType: presetType, eventDate: today, ...getEventTimingDefaults(presetType, today, defaultEventHours), ...policyDefaultsForType(presetType) });
    }
    setActiveStep(0);
    setOpenDialog(true);
  };

  const validateEmail = (email) => {
    // Improved email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone) => {
    // 10 digit numeric
    return /^\d{10}$/.test(phone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // The whole wizard lives inside one <form>, so pressing Enter (implicit
    // submit) on an intermediate step would otherwise create the booking and
    // skip the remaining steps (e.g. never reaching Payment). Only the final
    // step actually submits; anywhere else, Enter just advances to the next step.
    if (activeStep < BOOKING_STEPS.length - 1) {
      handleNext();
      return;
    }
    // Ignore a submit that fires within a moment of the Payment step appearing —
    // that's the accidental double-click / button-swap case, not a deliberate
    // "Create booking". A real submit happens after the user reviews the step.
    if (Date.now() - paymentStepEnteredAt.current < 700) {
      return;
    }
    let valid = true;
    setPhoneError('');
    setEmailError('');
    if (!formData.customerName || !formData.customerPhone || !formData.eventDate) {
      showSnackbar('Please fill all required fields', 'error');
      return;
    }
    if (!validatePhone(formData.customerPhone)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      valid = false;
    }
    if (formData.customerEmail && !validateEmail(formData.customerEmail)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }
    if (!valid) {return;}

    try {
      const isDurationPriced = isDurationPricedType(formData.eventType);

      // Normalise the repeatable catering line items → priced rows.
      const cateringItems = (formData.cateringItems || [])
        .filter((it) => (parseInt(it.plates, 10) || 0) > 0 || (Number(it.perPlate) || 0) > 0 || it.cateringPackageId)
        .map((it) => {
          const perPlate = Number(it.perPlate) || 0;
          const days = Math.max(1, parseInt(it.days, 10) || 1);
          // Estimated plates default to the guest count — at quotation staff enter
          // total guests + package, so guests are the estimate until actuals are set.
          const plates = (parseInt(it.plates, 10) || 0) || (parseInt(formData.guestCount, 10) || 0);
          // Keep any post-event actual-plate count; bill on it when present.
          const hasActual = it.actualPlates !== null && it.actualPlates !== undefined && it.actualPlates !== '';
          const actualPlates = hasActual ? (parseInt(it.actualPlates, 10) || 0) : null;
          const billedPlates = hasActual ? actualPlates : plates;
          return {
            packageId: it.cateringPackageId || null,
            name: (it.name || '').trim() || 'Catering',
            category: it.category || '',
            meal: it.meal || '',
            perPlate, plates, days,
            actualPlates,
            amount: perPlate * billedPlates * days,
          };
        });

      // Normalise the repeatable decoration line items → flat-priced rows.
      const decorationItems = (formData.decorationItems || [])
        .filter((it) => (Number(it.cost) || 0) > 0 || (it.name || '').trim() || it.decorationPackageId)
        .map((it) => ({
          packageId: it.decorationPackageId || null,
          name: (it.name || '').trim() || 'Decoration',
          category: it.category || '',
          cost: Number(it.cost) || 0,
          details: (it.details || '').trim(),
        }));

      // Normalise the rented utensil line items (only rows with a quantity taken).
      const utensilItems = (formData.utensilItems || [])
        .filter((it) => (parseInt(it.quantity, 10) || 0) > 0)
        .map((it) => {
          const cost = Number(it.cost) || 0;
          const quantity = parseInt(it.quantity, 10) || 0;
          return {
            itemId: it.utensilItemId || null,
            name: (it.name || '').trim() || 'Utensil',
            unit: it.unit || 'piece',
            cost, quantity,
            amount: cost * quantity,
          };
        });
      const utensilsCost = utensilItems.reduce((s, it) => s + it.amount, 0);

      const firstCatering = cateringItems[0] || null;
      const totalPlates = cateringItems.reduce((s, it) => s + it.plates, 0);
      const maxMealDays = cateringItems.reduce((m, it) => Math.max(m, it.days), 0);
      const hasCatering = cateringItems.length > 0;

      // Type-specific details — parse the numeric sub-fields.
      const ed = formData.eventDetails || {};
      const eventDetails = {
        ...ed,
        delegates: parseInt(ed.delegates, 10) || 0,
        sessionsDays: parseInt(ed.sessionsDays, 10) || 0,
        birthdayAge: parseInt(ed.birthdayAge, 10) || 0,
      };

      const bookingData = {
        ...formData,
        cateringItems,
        decorationItems,
        utensilItems,
        utensilsCost,
        eventDetails,
        guestCount: parseInt(formData.guestCount, 10) || 0,
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        totalAmount: formData.totalAmount, // Already calculated in useEffect
        remainingAmount: formData.remainingAmount, // Already calculated in useEffect
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim(),
        eventDate: new Date(formData.eventDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : '',
        floorCost: formData.floorCost,
        eventDuration: parseInt(formData.eventDuration, 10) || 0,
        // Legacy decoration fields kept in sync from the items (invoice compat).
        // decorationType must stay a valid schema enum (Standard/Premium/Custom);
        // the real décor names live in decorationItems / decorationDetails. Keep
        // a tier already chosen (e.g. from an applied event package), otherwise
        // mark it Custom when there are line items, else Standard.
        decorationType: ['Standard', 'Premium', 'Custom'].includes(formData.decorationType)
          ? formData.decorationType
          : (decorationItems.length ? 'Custom' : 'Standard'),
        decorationCost: formData.decorationCost || 0,
        decorationDetails: decorationItems.map((it) => it.details).filter(Boolean).join(' · '),

        // Event package link (venue/decoration bundle)
        packageId: formData.packageId || null,
        packageName: formData.packageName || '',

        // Legacy catering fields flattened from the line items (invoice compat).
        cateringPackageId: firstCatering?.packageId || null,
        cateringPackageName: firstCatering?.name || '',
        cateringPackage: cateringItems.map((it) => it.name).join(', '), // invoice display field
        cateringPerPlate: firstCatering?.perPlate || 0,
        numberOfPlates: totalPlates,

        // menuCost already holds the computed catering total from the effect.
        menuCost: formData.menuCost || 0,

        // Keep a minimal menu object for backward-compatible invoice rendering.
        menu: hasCatering ? {
          hasMeals: true,
          numberOfPlates: String(totalPlates),
          cateringPackageName: cateringItems.map((it) => it.name).join(', '),
        } : {},

        floorSelection: isDurationPriced
          ? ['duration']
          : (formData.selectedFloors && formData.selectedFloors.length > 0 ? formData.selectedFloors : ['none']),
        daysWithMeals: maxMealDays,

        // Venue + guest breakdown (string inputs → numbers)
        venueCapacity: parseInt(formData.venueCapacity, 10) || 0,
        expectedGuests: parseInt(formData.expectedGuests, 10) || 0,
        guaranteedGuests: parseInt(formData.guaranteedGuests, 10) || 0,
        vipGuests: parseInt(formData.vipGuests, 10) || 0,
        kidsCount: parseInt(formData.kidsCount, 10) || 0,

        // Room booking
        roomCheckIn: formData.roomCheckIn ? new Date(formData.roomCheckIn).toISOString() : null,
        roomCheckOut: formData.roomCheckOut ? new Date(formData.roomCheckOut).toISOString() : null,
        complimentaryRooms: parseInt(formData.complimentaryRooms, 10) || 0,

        // Payment schedule (normalise amounts/dates)
        paymentSchedule: (formData.paymentSchedule || [])
          .filter((p) => p.label || p.amount || p.dueDate)
          .map((p) => ({
            label: (p.label || '').trim(),
            dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : null,
            amount: parseFloat(p.amount) || 0,
            status: p.status === 'Paid' ? 'Paid' : 'Pending',
          })),

        // Vendor extras (string inputs → numbers)
        photographyAmount: parseFloat(formData.photographyAmount) || 0,
        entertainmentCost: parseFloat(formData.entertainmentCost) || 0,
      };

      if (selectedBooking?._id) {
        await api.banquet.updateBooking(selectedBooking._id, bookingData);
        showSnackbar('Booking updated successfully');
      } else {
        await api.banquet.createBooking(bookingData);
        showSnackbar('Booking created successfully');
      }
      
      await fetchBookings();
      await fetchAvailableDates(selectedMonth);
      handleCloseDialog();
    } catch (error) {
      // Prefer the server message (e.g. a utensil out-of-stock 409) over axios's
      // generic "Request failed with status code …".
      showSnackbar(error.response?.data?.message || error.message || 'Failed to save booking', 'error');
    }
  };

  const handleDelete = async (bookingId) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) {return;}
    
    try {
      await api.banquet.deleteBooking(bookingId);
      await fetchBookings();
      await fetchAvailableDates(selectedMonth);
      showSnackbar('Booking deleted successfully');
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Failed to delete booking', 'error');
    }
  };


  const _isDateAvailable = (dateStr) => {
    // Parse the string date before using format
    const date = parseISO(dateStr);
    const formattedDate = format(date, 'yyyy-MM-dd');
    return availableDates.includes(formattedDate);
  };

  // Apply an event package → prefills venue (basePrice) + decoration. Clearing
  // it restores the manual floor/decoration pickers.
  const applyEventPackage = (pkgId) => {
    const pkg = eventPackages.find((p) => p._id === pkgId);
    if (!pkg) {
      setFormData((prev) => ({ ...prev, packageId: '', packageName: '', packageBasePrice: 0, packageDecorationCost: 0 }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      packageId: pkg._id,
      packageName: pkg.name,
      packageBasePrice: pkg.basePrice || 0,
      packageDecorationCost: pkg.decorationCost || 0,
      decorationType: pkg.decorationType || 'Standard',
    }));
  };

  // ── Repeatable catering line items ─────────────────────────────────────────
  const addCateringItem = () => setFormData((prev) => ({
    ...prev,
    // Default a new catering line's Days to the event's day span, so a multi-day
    // event bills each meal across every day out of the box.
    cateringItems: [...(prev.cateringItems || []), { ...emptyCateringItem, days: Math.max(1, prev.numberOfDays || 1) }],
  }));
  const removeCateringItem = (idx) => setFormData((prev) => ({
    ...prev,
    cateringItems: (prev.cateringItems || []).filter((_, i) => i !== idx),
  }));
  const updateCateringItem = (idx, patch) => setFormData((prev) => ({
    ...prev,
    cateringItems: (prev.cateringItems || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
  }));
  // Picking a catering package fills the row's name + per-plate price. Plates are
  // cleared so the amount defaults to the event's total guest count (staff quote
  // a package + total guests; the plate field is hidden while a package is set).
  const applyCateringPackageToItem = (idx, pkgId) => {
    const pkg = cateringPackages.find((p) => p._id === pkgId);
    updateCateringItem(idx, pkg
      ? { cateringPackageId: pkg._id, name: pkg.name, category: pkg.category || '', perPlate: pkg.pricePerPlate || 0, plates: '' }
      : { cateringPackageId: '', perPlate: 0 });
  };

  // ── Repeatable utensil / cookware line items (rented to self-cooking guests) ─
  const addUtensilItem = () => setFormData((prev) => ({
    ...prev,
    utensilItems: [...(prev.utensilItems || []), { ...emptyUtensilItem }],
  }));
  const removeUtensilItem = (idx) => setFormData((prev) => ({
    ...prev,
    utensilItems: (prev.utensilItems || []).filter((_, i) => i !== idx),
  }));
  const updateUtensilItem = (idx, patch) => setFormData((prev) => ({
    ...prev,
    utensilItems: (prev.utensilItems || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
  }));
  // Picking a utensil from the catalog fills the row's name, unit and per-unit cost.
  const applyUtensilToItem = (idx, itemId) => {
    const it = utensilCatalog.find((u) => u._id === itemId);
    updateUtensilItem(idx, it
      ? { utensilItemId: it._id, name: it.name, unit: it.unit || 'piece', cost: it.cost || 0 }
      : { utensilItemId: '', cost: 0 });
  };
  // Live availability for a utensil catalog id (already excludes the booking
  // being edited via the ?excludeBooking fetch).
  const utensilAvailable = (itemId) => {
    const it = utensilCatalog.find((u) => u._id === itemId);
    return it ? Number(it.available ?? it.quantityTotal ?? 0) : null;
  };

  // Update one field inside the type-specific eventDetails object.
  const setEventDetail = (key, value) => setFormData((prev) => ({
    ...prev,
    eventDetails: { ...(prev.eventDetails || {}), [key]: value },
  }));

  // ── Repeatable decoration line items ───────────────────────────────────────
  const addDecorationItem = () => setFormData((prev) => ({
    ...prev,
    decorationItems: [...(prev.decorationItems || []), { ...emptyDecorationItem }],
  }));
  const removeDecorationItem = (idx) => setFormData((prev) => ({
    ...prev,
    decorationItems: (prev.decorationItems || []).filter((_, i) => i !== idx),
  }));
  const updateDecorationItem = (idx, patch) => setFormData((prev) => ({
    ...prev,
    decorationItems: (prev.decorationItems || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)),
  }));
  // Picking a decoration package fills the row's name + flat cost.
  const applyDecorationPackageToItem = (idx, pkgId) => {
    const pkg = decorationPackages.find((p) => p._id === pkgId);
    updateDecorationItem(idx, pkg
      ? { decorationPackageId: pkg._id, name: pkg.name, category: pkg.category || '', cost: pkg.price || 0 }
      : { decorationPackageId: '', cost: 0 });
  };

  // ── Wizard navigation ──────────────────────────────────────────────────────
  // Customer step (0) needs a name + valid 10-digit phone before advancing.
  const stepHasError = (step) => {
    if (step === 0) {
      return !formData.customerName.trim() || !validatePhone(formData.customerPhone);
    }
    return false;
  };
  const goToStep = (step) => {
    if (step > activeStep && stepHasError(activeStep)) {
      if (!formData.customerName.trim()) { showSnackbar('Customer name is required', 'error'); }
      else { setPhoneError('Please enter a valid 10-digit phone number'); }
      return;
    }
    setActiveStep(step);
  };
  const handleNext = () => goToStep(Math.min(activeStep + 1, BOOKING_STEPS.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));

  // Validate advance booking requirements
  const _validateAdvanceBooking = (eventDate) => {
    if (!banquetHallBookingSettings.requireAdvanceBooking) {return true;}
    
    const today = new Date();
    const bookingDate = new Date(eventDate);
    const daysDifference = Math.ceil((bookingDate - today) / (1000 * 60 * 60 * 24));
    
    return daysDifference >= (banquetHallBookingSettings.advanceBookingDays || 30);
  };

  // Calculate required deposit amount
  const _calculateRequiredDeposit = (totalAmount) => {
    if (!banquetHallBookingSettings.requireDeposit) {return 0;}
    return (totalAmount * (banquetHallBookingSettings.depositPercentage || 50)) / 100;
  };

  const outstandingBookings = Array.isArray(bookings)
    ? bookings.filter((b) => (Number(b.remainingAmount) || 0) > 0)
    : [];

  const metrics = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    const active = list.filter((b) => b.status !== 'Cancelled');
    const now = startOfDay(new Date());
    const in7 = new Date(now); in7.setDate(now.getDate() + 7);
    const monthNow = new Date();
    const inThisMonth = (d) => d && d.getMonth() === monthNow.getMonth() && d.getFullYear() === monthNow.getFullYear();
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const inLastMonth = (d) => d && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    const todayEvents = active.filter((b) => isSameDay(eventStart(b), new Date())).length;
    const upcoming = active.filter((b) => { const s = eventStart(b); return s && startOfDay(s) >= now && startOfDay(s) < in7; }).length;
    const monthRevenue = active.filter((b) => inThisMonth(b.eventDate ? new Date(b.eventDate) : null)).reduce((a, b) => a + (Number(b.totalAmount) || 0), 0);
    const pendingPayments = list.reduce((a, b) => a + (Number(b.remainingAmount) || 0), 0);
    const enquiries = list.filter((b) => b.source === 'website' || b.status === 'Pending').length;
    const bookedToday = (halls || []).filter((h) => active.some((b) => String(b.hallId?._id || b.hallId) === String(h._id) && isSameDay(eventStart(b), new Date()))).length;
    const occupancy = (halls || []).length ? Math.round((bookedToday / halls.length) * 100) : 0;
    const outstandingCount = list.filter((b) => (Number(b.remainingAmount) || 0) > 0).length;
    const thisMonthCount = active.filter((b) => inThisMonth(b.eventDate ? new Date(b.eventDate) : null)).length;
    const lastMonthCount = active.filter((b) => inLastMonth(b.eventDate ? new Date(b.eventDate) : null)).length;
    const growth = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : (thisMonthCount > 0 ? 100 : 0);
    return { total: list.length, todayEvents, upcoming, monthRevenue, pendingPayments, enquiries, occupancy, outstandingCount, growth };
  }, [bookings, halls]);

  const kpis = [
    { icon: <EventNoteOutlinedIcon />, label: 'Total Bookings', value: metrics.total, color: BQ.primary, subtext: 'All events', trend: (metrics.growth >= 0 ? '+' : '') + metrics.growth + '%', trendUp: metrics.growth >= 0 },
    { icon: <EventAvailableOutlinedIcon />, label: 'Upcoming Events', value: metrics.upcoming, color: BQ.blue, subtext: 'Next 7 days' },
    { icon: <CurrencyRupeeIcon />, label: 'Revenue', value: moneyShort(metrics.monthRevenue), color: BQ.success, subtext: 'This month' },
    { icon: <AccountBalanceWalletOutlinedIcon />, label: 'Pending Payments', value: moneyShort(metrics.pendingPayments), color: BQ.danger, subtext: 'Outstanding' },
    { icon: <ApartmentOutlinedIcon />, label: 'Hall Occupancy', value: metrics.occupancy + '%', color: BQ.gold, subtext: 'Booked today', progress: metrics.occupancy },
    { icon: <GroupsOutlinedIcon />, label: 'Event Enquiries', value: metrics.enquiries, color: BQ.purple, subtext: 'New leads' },
  ];

  const tabDefs = [
    { value: 'overview', label: 'Overview', icon: <DashboardOutlinedIcon /> },
    { value: 'list', label: 'Bookings', icon: <EventSeatOutlinedIcon />, count: Array.isArray(bookings) ? bookings.length : 0 },
    { value: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
    { value: 'packages', label: 'Packages', icon: <Inventory2OutlinedIcon /> },
    { value: 'catering', label: 'Catering', icon: <RestaurantMenuIcon /> },
    { value: 'decoration', label: 'Decoration', icon: <BrushOutlinedIcon /> },
    { value: 'utensils', label: 'Utensils', icon: <BlenderOutlinedIcon /> },
    { value: 'payments', label: 'Payments', icon: <PaymentsIcon />, count: metrics.outstandingCount },
    { value: 'reports', label: 'Reports', icon: <AssessmentOutlinedIcon /> },
  ];

  // Quotation and invoice both use the banquet template chosen in
  // Settings → Invoice templates; the docType switches the copy/layout.
  const printQuotation = async (booking) => {
    try {
      if (!settings) { showSnackbar('Settings not loaded. Please wait and try again.', 'warning'); return; }
      await invoiceService.printBanquetInvoice(booking, null, settings, 'quotation');
      showSnackbar('Quotation printed successfully!', 'success');
    } catch (error) {
      showSnackbar('Failed to print quotation: ' + error.message, 'error');
    }
  };

  const printInvoice = async (booking) => {
    try {
      if (!settings) { showSnackbar('Settings not loaded. Please wait and try again.', 'warning'); return; }
      await invoiceService.printBanquetInvoice(booking, null, settings, 'invoice');
      showSnackbar('Banquet invoice printed successfully!', 'success');
    } catch (error) {
      showSnackbar('Failed to print banquet invoice: ' + error.message, 'error');
    }
  };

  return (
    <PageLayout>
      {/* Premium dashboard header */}
      <BanquetHeader
        isDark={isDarkMode}
        todayEvents={metrics.todayEvents}
        upcomingEvents={metrics.upcoming}
        monthlyRevenue={metrics.monthRevenue}
        onCreate={(preset) => handleOpenDialog(null, preset)}
      />
      {/* KPI dashboard cards */}
      <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }, gap: 2 }}>
        {kpis.map((k, i) => (
          <HkKpiCard key={k.label} {...k} isDark={isDarkMode} loading={loading} delay={i * 0.05} />
        ))}
      </Box>
      {/* Module tabs */}
      <Box sx={{ mt: 2.5, mb: 3 }}>
        <BanquetTabs tabs={tabDefs} value={view} onChange={setView} isDark={isDarkMode} />
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : view === 'overview' ? (
        bookings.length === 0 ? (
          <BanquetEmptyState isDark={isDarkMode} onCreate={() => handleOpenDialog()} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Grid container spacing={3}>
              <Grid
                size={{
                  xs: 12,
                  lg: 7
                }}>
                <UpcomingEvents bookings={bookings} halls={halls} isDark={isDarkMode} onSelect={(b) => handleOpenDialog(b)} />
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  lg: 5
                }}>
                <HallAvailability halls={halls} bookings={bookings} isDark={isDarkMode} onSelect={() => handleOpenDialog()} />
              </Grid>
            </Grid>
            <BanquetCharts bookings={bookings} halls={halls} isDark={isDarkMode} />
          </Box>
        )
      ) : view === 'payments' ? (
        <BookingsTable
          bookings={outstandingBookings}
          halls={halls}
          isDark={isDarkMode}
          title="Outstanding Payments"
          subtitle={String(outstandingBookings.length) + ' with balance due'}
          emptyState={<BanquetEmptyState isDark={isDarkMode} onCreate={() => handleOpenDialog()} />}
          onEdit={(b) => handleOpenDialog(b)}
          onDelete={(b) => handleDelete(b._id)}
          onPayments={(b) => { setPaymentsBooking(b); setPaymentsOpen(true); }}
          onFinalize={(b) => { setFinalizeBooking(b); setFinalizeOpen(true); }}
          onPrintQuotation={printQuotation}
          onPrintInvoice={printInvoice}
        />
      ) : view === 'reports' ? (
        <BanquetCharts bookings={bookings} halls={halls} isDark={isDarkMode} />
      ) : view === 'calendar' ? (
        <Box sx={{ ...sectionCardSx(isDarkMode), p: { xs: 2, md: 3 } }}>
          <EventCalendar
            bookings={bookings}
            month={calMonth}
            year={calYear}
            onPrev={goPrevMonth}
            onNext={goNextMonth}
            onSelectDate={() => handleOpenDialog()}
            onSelectBooking={(b) => handleOpenDialog(b)}
          />
        </Box>
      ) : view === 'packages' ? (
        <EventPackagesManager halls={halls} onNotify={showSnackbar} />
      ) : view === 'catering' ? (
        <CateringPackagesManager onNotify={showSnackbar} />
      ) : view === 'decoration' ? (
        <DecorationPackagesManager onNotify={showSnackbar} />
      ) : view === 'utensils' ? (
        <UtensilsManager onNotify={showSnackbar} />
      ) : (
        <BookingsTable
          bookings={bookings}
          halls={halls}
          isDark={isDarkMode}
          title="All Bookings"
          subtitle={String(Array.isArray(bookings) ? bookings.length : 0) + ' events'}
          emptyState={<BanquetEmptyState isDark={isDarkMode} onCreate={() => handleOpenDialog()} />}
          onEdit={(b) => handleOpenDialog(b)}
          onDelete={(b) => handleDelete(b._id)}
          onPayments={(b) => { setPaymentsBooking(b); setPaymentsOpen(true); }}
          onFinalize={(b) => { setFinalizeBooking(b); setFinalizeOpen(true); }}
          onPrintQuotation={printQuotation}
          onPrintInvoice={printInvoice}
        />
      )}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={2} sx={{
            alignItems: "center"
          }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(236,72,153,0.18))',
              color: 'var(--app-primary)',
            }}>
              <CelebrationIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                Banquet Hall
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', mt: 0.25 }}>
                {selectedBooking ? 'Edit booking' : 'New booking'}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <Box component="form" id="marriage-form" onSubmit={handleSubmit}>
              <Stepper
                nonLinear
                activeStep={activeStep}
                alternativeLabel
                sx={{
                  mb: 3,
                  '& .MuiStepLabel-label': { fontSize: 12, fontWeight: 600, mt: 0.5 },
                  '& .MuiStepLabel-label.Mui-active': { color: 'var(--app-primary)' },
                  '& .MuiStepIcon-root.Mui-active': { color: 'var(--app-primary)' },
                  '& .MuiStepIcon-root.Mui-completed': { color: 'var(--app-primary)' },
                }}
              >
                {BOOKING_STEPS.map((label, i) => (
                  <Step key={label} completed={activeStep > i}>
                    <StepButton color="inherit" onClick={() => goToStep(i)}>{label}</StepButton>
                  </Step>
                ))}
              </Stepper>
              <WizardStepBoundary stepKey={activeStep}>
              <Stack spacing={2.5}>
                {/* Customer Info Section */}
                {activeStep === 0 && (
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <PeopleIcon sx={{ color: '#06b6d4' }} /> Customer Info
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth
                        required
                        label="Customer Name"
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
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
                        label="Phone Number"
                        placeholder="98765 43210"
                        value={formatPhone10(formData.customerPhone)}
                        onChange={(e) => {
                          // Store only the 10-digit local part; +91 is a fixed prefix.
                          setFormData({ ...formData, customerPhone: phoneLocal10(e.target.value) });
                          if (phoneError) {setPhoneError('');}
                        }}
                        error={!!phoneError}
                        helperText={phoneError || ''}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: "text.secondary",
                                    fontWeight: 600
                                  }}>+91</Typography>
                              </InputAdornment>
                            ),
                          },

                          htmlInput: { maxLength: 11, inputMode: 'numeric', pattern: '[0-9 ]*' }
                        }} />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth
                        label="Alternate Phone Number"
                        placeholder="98765 43210"
                        value={formatPhone10(formData.alternatePhone)}
                        onChange={(e) => {
                          setFormData({ ...formData, alternatePhone: phoneLocal10(e.target.value) });
                        }}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: "text.secondary",
                                    fontWeight: 600
                                  }}>+91</Typography>
                              </InputAdornment>
                            ),
                          },

                          htmlInput: { maxLength: 11, inputMode: 'numeric', pattern: '[0-9 ]*' }
                        }} />
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
                        value={formData.customerEmail}
                        onChange={(e) => {
                          setFormData({ ...formData, customerEmail: e.target.value });
                          if (emailError) {setEmailError('');}
                        }}
                        error={!!emailError}
                        helperText={emailError || ''}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Residential Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="City"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="PIN Code"
                        value={formData.pincode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, pincode: value });
                        }}
                        slotProps={{
                          htmlInput: { maxLength: 6, inputMode: 'numeric' }
                        }}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <FormControl fullWidth>
                        <InputLabel>ID Proof Type</InputLabel>
                        <Select
                          label="ID Proof Type"
                          value={formData.idProofType}
                          onChange={(e) => setFormData({ ...formData, idProofType: e.target.value })}
                          MenuProps={{ slotProps: {
                            paper: { sx: { backgroundColor: '#fff' } }
                          } }}
                        >
                          <MenuItem value=""><em>— None —</em></MenuItem>
                          {ID_PROOF_TYPES.map((t) => (
                            <MenuItem key={t} value={t}>{t}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="ID Proof Number"
                        value={formData.idProofNumber}
                        onChange={(e) => setFormData({ ...formData, idProofNumber: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="GST Number (if applicable)"
                        value={formData.gstNumber}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        slotProps={{
                          htmlInput: { style: { textTransform: 'uppercase' } }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
                )}
                {/* Event Details Section */}
                {activeStep === 1 && (
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <CalendarIcon sx={{ color: '#f59e42' }} /> Event Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Event Title"
                        value={formData.eventTitle}
                        onChange={(e) => setFormData({ ...formData, eventTitle: e.target.value })}
                        placeholder='e.g. "Rahul & Priya Wedding"'
                      />
                    </Grid>
                    {/* ── Type-specific fields (driven by the event category) ── */}
                    {/* Wedding / Reception — couple names */}
                    {eventCategory(formData.eventType) === 'wedding' && (
                      <>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Groom Name" value={formData.groomName}
                            onChange={(e) => setFormData({ ...formData, groomName: e.target.value })} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Bride Name" value={formData.brideName}
                            onChange={(e) => setFormData({ ...formData, brideName: e.target.value })} />
                        </Grid>
                      </>
                    )}

                    {/* Corporate / Meeting / Conference — organisation details */}
                    {['corporate', 'conference'].includes(eventCategory(formData.eventType)) && (
                      <>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Company / Organization"
                            value={formData.eventDetails?.organizationName || ''}
                            onChange={(e) => setEventDetail('organizationName', e.target.value)} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Contact Person (name & designation)"
                            value={formData.eventDetails?.contactPerson || ''}
                            onChange={(e) => setEventDetail('contactPerson', e.target.value)} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth type="number"
                            label={eventCategory(formData.eventType) === 'conference' ? 'No. of Delegates' : 'No. of Attendees'}
                            value={formData.eventDetails?.delegates || ''}
                            onChange={(e) => { if (/^\d*$/.test(e.target.value)) { setEventDetail('delegates', e.target.value); } }}
                            slotProps={{
                              htmlInput: { min: 0 }
                            }} />
                        </Grid>
                        {eventCategory(formData.eventType) === 'conference' && (
                          <Grid
                            size={{
                              xs: 12,
                              sm: 6
                            }}>
                            <TextField fullWidth type="number" label="Sessions / Days"
                              value={formData.eventDetails?.sessionsDays || ''}
                              onChange={(e) => { if (/^\d*$/.test(e.target.value)) { setEventDetail('sessionsDays', e.target.value); } }}
                              slotProps={{
                                htmlInput: { min: 0 }
                              }} />
                          </Grid>
                        )}
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <FormControl fullWidth>
                            <InputLabel>Seating Style</InputLabel>
                            <Select label="Seating Style" value={formData.seatingStyle || ''}
                              onChange={(e) => setFormData({ ...formData, seatingStyle: e.target.value })}
                              MenuProps={{ slotProps: {
                                paper: { sx: { backgroundColor: '#fff' } }
                              } }}>
                              <MenuItem value=""><em>—</em></MenuItem>
                              {SEATING_STYLES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <FormControlLabel
                            control={<Checkbox checked={!!formData.eventDetails?.avRequired}
                              onChange={(e) => setEventDetail('avRequired', e.target.checked)} />}
                            label="AV / Projector / PA required" />
                        </Grid>
                        <Grid size={12}>
                          <TextField fullWidth label="Agenda / Purpose" multiline rows={2}
                            value={formData.eventDetails?.agenda || ''}
                            onChange={(e) => setEventDetail('agenda', e.target.value)} />
                        </Grid>
                      </>
                    )}

                    {/* Birthday — celebrant, age, theme, cake */}
                    {eventCategory(formData.eventType) === 'birthday' && (
                      <>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Birthday Person"
                            value={formData.eventDetails?.birthdayPersonName || ''}
                            onChange={(e) => setEventDetail('birthdayPersonName', e.target.value)} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 6,
                            sm: 3
                          }}>
                          <TextField fullWidth type="number" label="Age Turning"
                            value={formData.eventDetails?.birthdayAge || ''}
                            onChange={(e) => { if (/^\d*$/.test(e.target.value)) { setEventDetail('birthdayAge', e.target.value); } }}
                            slotProps={{
                              htmlInput: { min: 0 }
                            }} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 6,
                            sm: 3
                          }}>
                          <TextField fullWidth label="Theme"
                            value={formData.eventDetails?.theme || ''}
                            onChange={(e) => setEventDetail('theme', e.target.value)} />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <FormControlLabel
                            control={<Checkbox checked={!!formData.eventDetails?.cakeRequired}
                              onChange={(e) => setEventDetail('cakeRequired', e.target.checked)} />}
                            label="Cake required" />
                        </Grid>
                        {formData.eventDetails?.cakeRequired && (
                          <Grid
                            size={{
                              xs: 12,
                              sm: 6
                            }}>
                            <TextField fullWidth label="Cake Message"
                              value={formData.eventDetails?.cakeMessage || ''}
                              onChange={(e) => setEventDetail('cakeMessage', e.target.value)} />
                          </Grid>
                        )}
                      </>
                    )}

                    {/* Social — engagement / anniversary / party */}
                    {eventCategory(formData.eventType) === 'social' && (
                      <>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Celebrant / Couple Names"
                            value={formData.eventDetails?.celebrantNames || ''}
                            onChange={(e) => setEventDetail('celebrantNames', e.target.value)}
                            placeholder="e.g. Rahul & Priya / Sharma Family" />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TextField fullWidth label="Occasion Note"
                            value={formData.eventDetails?.occasionNote || ''}
                            onChange={(e) => setEventDetail('occasionNote', e.target.value)}
                            placeholder="e.g. 25th Anniversary" />
                        </Grid>
                      </>
                    )}
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <FormControl fullWidth required>
                        <InputLabel>Event Type</InputLabel>
                        <Select
                          label="Event Type"
                          value={formData.eventType}
                          onChange={(e) => {
                            const eventType = e.target.value;
                            // Swap in this type's default Contract & Terms text,
                            // but only for fields still holding an auto-default
                            // (never overwrite text staff have hand-edited).
                            const defaults = policyDefaultsForType(eventType);
                            const policyPatch = {};
                            POLICY_FIELDS.forEach((f) => {
                              if (isAutoPolicyValue(f, formData[f])) { policyPatch[f] = defaults[f]; }
                            });
                            setFormData({ ...formData, eventType, ...getEventTimingDefaults(eventType, formData.eventDate, defaultEventHours), ...policyPatch });
                          }}
                          MenuProps={{ slotProps: {
                            paper: { sx: { backgroundColor: '#fff' } }
                          } }}
                        >
                          {EVENT_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <DatePicker
                        format="dd/MM/yyyy"
                        label="Event Date"
                        value={formData.eventDate ? (typeof formData.eventDate === 'string' ? (formData.eventDate ? parseISO(formData.eventDate) : null) : formData.eventDate) : null}
                        onChange={(date) => {
                          const eventDate = date ? format(date, 'yyyy-MM-dd') : '';
                          setFormData({ ...formData, eventDate, ...getEventTimingDefaults(formData.eventType, eventDate, defaultEventHours) });
                        }}
                        slotProps={{ 
                          textField: { fullWidth: true, required: true },
                          popper: {
                            sx: {
                              '& .MuiPaper-root': {
                                backgroundColor: 'white',
                                opacity: 1,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                              }
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <DatePicker
                        format="dd/MM/yyyy"
                        label="End Date"
                        value={formData.endDate ? (typeof formData.endDate === 'string' ? (formData.endDate ? parseISO(formData.endDate) : null) : formData.endDate) : null}
                        onChange={(date) => setFormData({ ...formData, endDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                        slotProps={{ 
                          textField: { fullWidth: true },
                          popper: {
                            sx: {
                              '& .MuiPaper-root': {
                                backgroundColor: 'white',
                                opacity: 1,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                              }
                            }
                          }
                        }}
                        minDate={formData.eventDate ? parseISO(formData.eventDate) : undefined}
                      />
                    </Grid>
                    <Grid size={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccessTimeIcon sx={{ mr: 1, color: '#10b981' }} />
                        <Typography variant="subtitle1" sx={{ color: '#10b981', fontWeight: 600 }}>
                          Event Timing
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TimePicker
                            label="Start Time"
                            value={formData.startTime ? new Date(`1970-01-01T${formData.startTime}`) : null}
                            onChange={value => {
                              const timeStr = value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                              setFormData({ ...formData, startTime: timeStr });
                            }}
                            ampm={false}
                            minutesStep={5}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                slotProps: { input: { startAdornment: <AccessTimeIcon sx={{ mr: 1, color: '#10b981' }} /> } },
                                helperText: 'Select when the event starts',
                              },
                              clearButton: { title: 'Clear Start Time' },
                              popper: {
                                sx: {
                                  '& .MuiPaper-root': {
                                    backgroundColor: 'white',
                                    opacity: 1,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                  }
                                }
                              }
                            }}
                            clearable
                            disableCloseOnSelect={false}
                            format="HH:mm"
                          />
                        </Grid>
                        <Grid
                          size={{
                            xs: 12,
                            sm: 6
                          }}>
                          <TimePicker
                            label="End Time"
                            value={formData.endTime ? new Date(`1970-01-01T${formData.endTime}`) : null}
                            onChange={value => {
                              const timeStr = value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                              setFormData({ ...formData, endTime: timeStr });
                            }}
                            ampm={false}
                            minutesStep={5}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                slotProps: { input: { startAdornment: <AccessTimeIcon sx={{ mr: 1, color: '#10b981' }} /> } },
                                helperText: 'Select when the event ends',
                              },
                              clearButton: { title: 'Clear End Time' },
                              popper: {
                                sx: {
                                  '& .MuiPaper-root': {
                                    backgroundColor: 'white',
                                    opacity: 1,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                  }
                                }
                              }
                            }}
                            clearable
                            disableCloseOnSelect={false}
                            format="HH:mm"
                            minTime={formData.startTime ? new Date(`1970-01-01T${formData.startTime}`) : undefined}
                          />
                        </Grid>
                      </Grid>
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth
                        label="Guest Count"
                        type="number"
                        value={formData.guestCount}
                        onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          label="Status"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          MenuProps={{ slotProps: {
                            paper: { sx: { backgroundColor: '#fff' } }
                          } }}
                        >
                          {BOOKING_STATUS.map((status) => (
                            <MenuItem key={status} value={status}>{status}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
                )}
                {/* Floor & Decoration Section / Event Pricing Section */}
                {activeStep === 2 && (
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <EventIcon sx={{ color: '#a21caf' }} /> 
                    {isDurationPricedType(formData.eventType) ? 'Event Pricing' : 'Floor & Decoration'}
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Event package selector (non duration-priced events) */}
                    {!isDurationPricedType(formData.eventType) && (
                      <Grid size={12}>
                        <FormControl fullWidth>
                          <InputLabel>Event Package (optional)</InputLabel>
                          <Select
                            label="Event Package (optional)"
                            value={formData.packageId || ''}
                            onChange={(e) => applyEventPackage(e.target.value)}
                            MenuProps={{ slotProps: {
                              paper: { sx: { backgroundColor: '#fff', maxHeight: 360 } }
                            } }}
                          >
                            <MenuItem value=""><em>— No package (choose floors & decoration manually) —</em></MenuItem>
                            {eventPackages.filter((p) => p.isActive !== false).map((p) => (
                              <MenuItem key={p._id} value={p._id}>
                                {p.name} — {currencySym()}{((p.basePrice || 0) + (p.decorationCost || 0)).toLocaleString('en-IN')}
                              </MenuItem>
                            ))}
                          </Select>
                          <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
                            Applying a package sets the venue & decoration cost. Manage packages from the “Packages” tab.
                          </Typography>
                        </FormControl>
                      </Grid>
                    )}

                    {/* Applied-package summary OR manual floor + decoration pickers */}
                    {isDurationPricedType(formData.eventType) ? (
                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}>
                        <TextField
                          fullWidth
                          label="Event Duration (hours)"
                          type="number"
                          value={formData.eventDuration}
                          onChange={e => {
                            const value = e.target.value;
                            if (/^\d*$/.test(value)) {
                              setFormData({ ...formData, eventDuration: value });
                            }
                          }}
                          onWheel={e => e.target.blur()}
                          helperText={`Cost: ${currencySym()}${liveBilling().banquetVenueHourlyRate.toLocaleString('en-IN')} per hour`}
                          slotProps={{
                            htmlInput: { min: 1 }, input: { sx: {
                              '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                              },
                              '& input[type=number]': {
                                MozAppearance: 'textfield',
                              },
                            } }
                          }}
                        />
                      </Grid>
                    ) : formData.packageId ? (
                      <Grid size={12}>
                        <Box sx={{
                          p: 2, borderRadius: 2,
                          border: '1px solid rgba(var(--app-primary-rgb),0.3)',
                          background: 'rgba(var(--app-primary-rgb),0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
                        }}>
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 800,
                                color: 'var(--app-primary)'
                              }}>
                              {formData.packageName}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: "text.secondary"
                            }}>
                              Venue {currencySym()}{(Number(formData.packageBasePrice) || 0).toLocaleString('en-IN')}
                              {' · '}Decoration {currencySym()}{(Number(formData.packageDecorationCost) || 0).toLocaleString('en-IN')}
                              {formData.decorationType ? ` (${formData.decorationType})` : ''}
                            </Typography>
                          </Box>
                          <Button size="small" variant="outlined" onClick={() => applyEventPackage('')} sx={{ textTransform: 'none', borderRadius: '999px' }}>
                            Clear package
                          </Button>
                        </Box>
                      </Grid>
                    ) : (
                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}>
                        <FormControl fullWidth>
                          <InputLabel>Floors</InputLabel>
                          <Select
                            label="Floors"
                            multiple
                            value={formData.selectedFloors}
                            onChange={(e) => {
                              const selectedFloors = e.target.value;
                              // Rooms on a booked floor are part of the package —
                              // drop them from the separate guest-room reservation.
                              const covered = levelsForFloors(selectedFloors);
                              const rooms2 = (formData.rooms || []).filter((id) => {
                                const rm = rooms.find((r) => r._id === id);
                                return rm ? !covered.has(roomFloorLevel(rm.roomNumber)) : true;
                              });
                              setFormData({ ...formData, selectedFloors, rooms: rooms2 });
                            }}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                  <Chip key={value} label={FLOOR_OPTIONS.find(f => f.value === value)?.label || value} sx={{ bgcolor: '#dcfce7', color: '#10b981', fontWeight: 600 }} />
                                ))}
                              </Box>
                            )}
                            MenuProps={{ slotProps: {
                              paper: { sx: { backgroundColor: '#fff' } }
                            } }}
                          >
                            {FLOOR_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}

                    {/* Repeatable decoration line items — pick a décor package
                        from the catalog or add a custom item; each is priced
                        separately and summed into the total. */}
                    <Grid size={12}>
                      <Box sx={{ p: 2, borderRadius: 2, border: '1px dashed', borderColor: 'rgba(236,72,153,0.4)', background: 'rgba(236,72,153,0.04)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              color: '#ec4899'
                            }}>
                            <BrushOutlinedIcon fontSize="small" /> Decoration
                          </Typography>
                          <Button size="small" startIcon={<AddIcon />} onClick={addDecorationItem} sx={{ textTransform: 'none', borderRadius: '999px' }}>
                            Add decoration
                          </Button>
                        </Box>
                        {(formData.decorationItems || []).length === 0 ? (
                          <Typography variant="body2" sx={{
                            color: "text.secondary"
                          }}>
                            No decoration added. Pick a décor package (managed in the “Decoration” tab) or add a custom item.
                          </Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            {formData.decorationItems.map((item, idx) => (
                              <Grid container spacing={1.5} key={idx} sx={{
                                alignItems: "center"
                              }}>
                                <Grid
                                  size={{
                                    xs: 12,
                                    sm: 4
                                  }}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Décor package</InputLabel>
                                    <Select
                                      label="Décor package"
                                      value={item.decorationPackageId || ''}
                                      onChange={(e) => applyDecorationPackageToItem(idx, e.target.value)}
                                      MenuProps={{ slotProps: {
                                        paper: { sx: { backgroundColor: '#fff', maxHeight: 320 } }
                                      } }}
                                    >
                                      <MenuItem value=""><em>— Custom —</em></MenuItem>
                                      {decorationPackages.filter((p) => p.isActive !== false).map((p) => (
                                        <MenuItem key={p._id} value={p._id}>
                                          {p.name} — {currencySym()}{(p.price || 0).toLocaleString('en-IN')}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid
                                  size={{
                                    xs: 12,
                                    sm: 4
                                  }}>
                                  <TextField
                                    fullWidth size="small" label="Label"
                                    placeholder="Stage & Mandap"
                                    value={item.name}
                                    onChange={(e) => updateDecorationItem(idx, { name: e.target.value })}
                                  />
                                </Grid>
                                <Grid
                                  size={{
                                    xs: 8,
                                    sm: 3
                                  }}>
                                  <TextField
                                    fullWidth size="small" type="number" label={`Cost (${currencySym()})`}
                                    value={item.cost}
                                    onChange={(e) => updateDecorationItem(idx, { cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                    slotProps={{
                                      htmlInput: { min: 0, step: 100 }
                                    }}
                                  />
                                </Grid>
                                <Grid
                                  size={{
                                    xs: 4,
                                    sm: 1
                                  }}>
                                  <IconButton size="small" onClick={() => removeDecorationItem(idx)} sx={{ color: '#ef4444' }}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Grid>
                                <Grid size={12}>
                                  <TextField
                                    fullWidth size="small" label="Notes (optional)"
                                    placeholder="Theme, colours, flowers, lighting…"
                                    value={item.details}
                                    onChange={(e) => updateDecorationItem(idx, { details: e.target.value })}
                                  />
                                </Grid>
                              </Grid>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Grid>
                    {/* An event package books the whole hotel, so the separate
                        floor + guest-room reservation is hidden — the package
                        already covers every floor and its rooms. */}
                    {!formData.packageId && (
                    <Grid size={12}>
                      <FormControl fullWidth>
                        <InputLabel>Reserve Guest Rooms</InputLabel>
                        <Select
                          label="Reserve Guest Rooms"
                          multiple
                          value={formData.rooms}
                          onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((id) => {
                                const room = rooms.find((r) => r._id === id);
                                return (
                                  <Chip key={id} label={room ? `Room ${room.roomNumber}` : id} sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 600 }} />
                                );
                              })}
                            </Box>
                          )}
                          MenuProps={{ slotProps: {
                            paper: { sx: { backgroundColor: '#fff', maxHeight: 320 } }
                          } }}
                        >
                          {rooms
                            .filter((room) => !levelsForFloors(formData.selectedFloors).has(roomFloorLevel(room.roomNumber)))
                            .map((room) => (
                              <MenuItem key={room._id} value={room._id}>
                                Room {room.roomNumber} — {room.type}
                              </MenuItem>
                            ))}
                        </Select>
                        <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
                          Rooms on a booked floor are part of that package and are hidden here. Selected rooms are blocked from regular guest booking during the event dates.
                        </Typography>
                      </FormControl>
                    </Grid>
                    )}
                  </Grid>
                </Box>
                )}
                {/* Catering Section (repeatable line items) */}
                {activeStep === 3 && (
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <Typography sx={{ ...sectionTitleSx(isDarkMode), mb: 0 }}>
                      <RestaurantMenuIcon sx={{ color: '#f43f5e' }} /> Catering
                    </Typography>
                    <Button size="small" startIcon={<AddIcon />} onClick={addCateringItem} sx={{ textTransform: 'none', borderRadius: '999px' }}>
                      Add catering
                    </Button>
                  </Box>
                  {(formData.cateringItems || []).length === 0 ? (
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      No catering added. Pick a catering package (managed in the “Catering” tab) or add a custom per-plate item.
                    </Typography>
                  ) : (
                    <Stack spacing={2}>
                      {formData.cateringItems.map((item, idx) => {
                        const pkg = cateringPackages.find((p) => p._id === item.cateringPackageId);
                        const lineTotal = cateringItemAmount(item, formData.guestCount);
                        return (
                          <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Grid container spacing={1.5} sx={{
                              alignItems: "center"
                            }}>
                              <Grid
                                size={{
                                  xs: 12,
                                  sm: 4
                                }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Catering package</InputLabel>
                                  <Select
                                    label="Catering package"
                                    value={item.cateringPackageId || ''}
                                    onChange={(e) => applyCateringPackageToItem(idx, e.target.value)}
                                    MenuProps={{ slotProps: {
                                      paper: { sx: { backgroundColor: '#fff', maxHeight: 320 } }
                                    } }}
                                  >
                                    <MenuItem value=""><em>— Custom —</em></MenuItem>
                                    {cateringPackages.filter((p) => p.isActive !== false).map((p) => (
                                      <MenuItem key={p._id} value={p._id}>
                                        {p.name} — {currencySym()}{(p.pricePerPlate || 0).toLocaleString('en-IN')}/plate ({p.category})
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid
                                size={{
                                  xs: 12,
                                  sm: 4
                                }}>
                                <TextField fullWidth size="small" label="Label" placeholder="Veg Buffet"
                                  value={item.name}
                                  onChange={(e) => updateCateringItem(idx, { name: e.target.value })} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 4
                                }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Meal</InputLabel>
                                  <Select label="Meal" value={item.meal || ''}
                                    onChange={(e) => updateCateringItem(idx, { meal: e.target.value })}
                                    MenuProps={{ slotProps: {
                                      paper: { sx: { backgroundColor: '#fff' } }
                                    } }}>
                                    <MenuItem value=""><em>— Any —</em></MenuItem>
                                    {MEAL_OPTIONS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 4
                                }}>
                                <TextField fullWidth size="small" type="number" label={`Per plate (${currencySym()})`}
                                  value={item.perPlate}
                                  onChange={(e) => updateCateringItem(idx, { perPlate: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  slotProps={{
                                    htmlInput: { min: 0, step: 10 }
                                  }} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 3
                                }}>
                                {item.cateringPackageId ? (
                                  // Package selected → plates default to the total
                                  // guest count, so the manual plate field is hidden.
                                  (<TextField fullWidth size="small" label="Plates"
                                    value={`${parseInt(formData.guestCount, 10) || 0}`}
                                    helperText="= total guests"
                                    slotProps={{
                                      input: { readOnly: true }
                                    }} />)
                                ) : (
                                  <TextField fullWidth size="small" type="number" label="Plates"
                                    value={item.plates}
                                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) { updateCateringItem(idx, { plates: e.target.value }); } }}
                                    slotProps={{
                                      htmlInput: { min: 0 }
                                    }} />
                                )}
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 3
                                }}>
                                <TextField fullWidth size="small" type="number" label="Days"
                                  value={item.days}
                                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) { updateCateringItem(idx, { days: e.target.value }); } }}
                                  slotProps={{
                                    htmlInput: { min: 1 }
                                  }} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 9,
                                  sm: 5
                                }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--app-primary)' }}>
                                  Line total: {currencySym()}{lineTotal.toLocaleString('en-IN')}
                                </Typography>
                              </Grid>
                              <Grid
                                size={{
                                  xs: 3,
                                  sm: 1
                                }}>
                                <IconButton size="small" onClick={() => removeCateringItem(idx)} sx={{ color: '#ef4444' }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Grid>
                              {pkg && (pkg.items || []).length > 0 && (
                                <Grid size={12}>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {pkg.items.map((it, i) => (
                                      <Chip key={i} label={it} size="small" sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.08)' }} />
                                    ))}
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="Catering special requests"
                      value={formData.specialRequests}
                      onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    />
                  </Box>

                  {/* Utensils & Cookware — rented to guests who cook their own
                      food. Each line is chargeable (per-unit × qty) and reserves
                      stock; the picker shows how many are still available. */}
                  <Box sx={{ mt: 2, p: 2, borderRadius: 2, border: '1px dashed', borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.04)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          color: '#6366F1'
                        }}>
                        <RestaurantMenuIcon fontSize="small" /> Utensils & Cookware
                      </Typography>
                      <Button size="small" startIcon={<AddIcon />} onClick={addUtensilItem} sx={{ textTransform: 'none', borderRadius: '999px' }}>
                        Add utensil
                      </Button>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: 'block',
                        mb: 1.5
                      }}>
                      For guests who cook their own food — rent cookware, water jars, gas cylinders etc. (manage the catalog in the “Utensils” tab).
                    </Typography>
                    {(formData.utensilItems || []).length === 0 ? (
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>No utensils added.</Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {formData.utensilItems.map((item, idx) => {
                          const available = utensilAvailable(item.utensilItemId);
                          const qty = parseInt(item.quantity, 10) || 0;
                          const over = available != null && qty > available;
                          const lineTotal = utensilItemAmount(item);
                          return (
                            <Grid container spacing={1.5} key={idx} sx={{
                              alignItems: "center"
                            }}>
                              <Grid
                                size={{
                                  xs: 12,
                                  sm: 4
                                }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Utensil</InputLabel>
                                  <Select label="Utensil" value={item.utensilItemId || ''}
                                    onChange={(e) => applyUtensilToItem(idx, e.target.value)}
                                    MenuProps={{ slotProps: {
                                      paper: { sx: { backgroundColor: '#fff', maxHeight: 320 } }
                                    } }}>
                                    <MenuItem value=""><em>— Custom —</em></MenuItem>
                                    {utensilCatalog.filter((u) => u.isActive !== false).map((u) => (
                                      <MenuItem key={u._id} value={u._id}>
                                        {u.name} — {currencySym()}{(u.cost || 0).toLocaleString('en-IN')}/{u.unit || 'unit'} ({u.available ?? u.quantityTotal} left)
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
                                <TextField fullWidth size="small" label="Label" placeholder="Water Jar"
                                  value={item.name}
                                  onChange={(e) => updateUtensilItem(idx, { name: e.target.value })} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 2
                                }}>
                                <TextField fullWidth size="small" type="number" label={`Cost (${currencySym()})`}
                                  value={item.cost}
                                  onChange={(e) => updateUtensilItem(idx, { cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  slotProps={{
                                    htmlInput: { min: 0 }
                                  }} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 2
                                }}>
                                <TextField fullWidth size="small" type="number" label="Qty"
                                  value={item.quantity}
                                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) { updateUtensilItem(idx, { quantity: e.target.value }); } }}
                                  error={over}
                                  helperText={available != null ? (over ? `Only ${available} left` : `${available} available`) : ' '}
                                  slotProps={{
                                    htmlInput: { min: 0 }
                                  }} />
                              </Grid>
                              <Grid
                                size={{
                                  xs: 6,
                                  sm: 1
                                }}>
                                <IconButton size="small" onClick={() => removeUtensilItem(idx)} sx={{ color: '#ef4444' }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Grid>
                              <Grid size={12}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--app-primary)' }}>
                                  Line total: {currencySym()}{lineTotal.toLocaleString('en-IN')}
                                </Typography>
                              </Grid>
                            </Grid>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                </Box>
                )}
                {/* Guests & Add-ons step */}
                {activeStep === 4 && (<>
                {/* Additional Services Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <CelebrationIcon sx={{ color: '#f59e0b' }} /> Additional Services
                  </Typography>
                  <FormGroup row>
                    {addOnsForCategory(eventCategory(formData.eventType)).services.map((service) => (
                      <FormControlLabel
                        key={service}
                        sx={{ width: { xs: '50%', sm: '33%' }, m: 0 }}
                        control={(
                          <Checkbox
                            checked={(formData.additionalServices || []).includes(service)}
                            onChange={(e) => {
                              const current = formData.additionalServices || [];
                              const next = e.target.checked
                                ? [...current, service]
                                : current.filter((s) => s !== service);
                              setFormData({ ...formData, additionalServices: next });
                            }}
                          />
                        )}
                        label={service}
                      />
                    ))}
                  </FormGroup>
                </Box>

                {/* Decoration Add-ons & Vendor Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <CelebrationIcon sx={{ color: '#ec4899' }} /> Decoration Add-ons
                  </Typography>
                  <FormGroup row>
                    {addOnsForCategory(eventCategory(formData.eventType)).decor.map((opt) => (
                      <FormControlLabel
                        key={opt}
                        sx={{ width: { xs: '50%', sm: '33%' }, m: 0 }}
                        control={(
                          <Checkbox
                            checked={(formData.decorationOptions || []).includes(opt)}
                            onChange={(e) => {
                              const current = formData.decorationOptions || [];
                              const next = e.target.checked
                                ? [...current, opt]
                                : current.filter((s) => s !== opt);
                              setFormData({ ...formData, decorationOptions: next });
                            }}
                          />
                        )}
                        label={opt}
                      />
                    ))}
                  </FormGroup>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth label="Decor Vendor"
                        value={formData.decorVendor}
                        onChange={(e) => setFormData({ ...formData, decorVendor: e.target.value })}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Photography & Videography Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <EventIcon sx={{ color: '#8b5cf6' }} /> Photography &amp; Videography
                  </Typography>
                  <FormGroup row>
                    {[
                      ['photographyRequired', 'Photography'],
                      ['videographyRequired', 'Videography'],
                      ['droneCoverage', 'Drone Coverage'],
                      ['preWeddingShoot', 'Pre-Wedding Shoot'],
                    ].map(([key, label]) => (
                      <FormControlLabel
                        key={key}
                        sx={{ width: { xs: '50%', sm: '25%' }, m: 0 }}
                        control={(
                          <Checkbox
                            checked={!!formData[key]}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                          />
                        )}
                        label={label}
                      />
                    ))}
                  </FormGroup>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth label="Vendor Name"
                        value={formData.photographyVendor}
                        onChange={(e) => setFormData({ ...formData, photographyVendor: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth label={`Package Amount (${currencySym()})`} type="number"
                        value={formData.photographyAmount}
                        onChange={(e) => {
                          if (/^\d*\.?\d*$/.test(e.target.value)) { setFormData({ ...formData, photographyAmount: e.target.value }); }
                        }}
                        helperText="Added to the booking total"
                        slotProps={{
                          htmlInput: { min: 0 }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Entertainment Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <CelebrationIcon sx={{ color: '#f43f5e' }} /> Entertainment
                  </Typography>
                  <FormGroup row>
                    {addOnsForCategory(eventCategory(formData.eventType)).entertainment.map((opt) => (
                      <FormControlLabel
                        key={opt}
                        sx={{ width: { xs: '50%', sm: '33%' }, m: 0 }}
                        control={(
                          <Checkbox
                            checked={(formData.entertainmentOptions || []).includes(opt)}
                            onChange={(e) => {
                              const current = formData.entertainmentOptions || [];
                              const next = e.target.checked
                                ? [...current, opt]
                                : current.filter((s) => s !== opt);
                              setFormData({ ...formData, entertainmentOptions: next });
                            }}
                          />
                        )}
                        label={opt}
                      />
                    ))}
                  </FormGroup>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth label="Vendor Name"
                        value={formData.entertainmentVendor}
                        onChange={(e) => setFormData({ ...formData, entertainmentVendor: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth label={`Cost (${currencySym()})`} type="number"
                        value={formData.entertainmentCost}
                        onChange={(e) => {
                          if (/^\d*\.?\d*$/.test(e.target.value)) { setFormData({ ...formData, entertainmentCost: e.target.value }); }
                        }}
                        helperText="Added to the booking total"
                        slotProps={{
                          htmlInput: { min: 0 }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Event Coordinator Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <PeopleIcon sx={{ color: '#14b8a6' }} /> Event Coordinator
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="Sales Executive"
                        value={formData.salesExecutive}
                        onChange={(e) => setFormData({ ...formData, salesExecutive: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="Event Manager"
                        value={formData.eventManager}
                        onChange={(e) => setFormData({ ...formData, eventManager: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth
                        label="Coordinator Contact Number"
                        value={formData.coordinatorPhone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, coordinatorPhone: value });
                        }}
                        slotProps={{
                          htmlInput: { maxLength: 10, inputMode: 'numeric' }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                </>)}
                {/* Price Breakdown Section */}
                {activeStep === 5 && (<>
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <PrintIcon sx={{ color: '#10b981' }} /> Price Breakdown
                  </Typography>
                  <Box sx={{
                    p: 3,
                    borderRadius: 2,
                    background: 'rgba(var(--app-primary-rgb), 0.05)',
                    border: '1px solid rgba(var(--app-primary-rgb), 0.2)',
                  }}>
                    {(() => {
                      const isDurationPriced = isDurationPricedType(formData.eventType);
                      const cateringItems = formData.cateringItems || [];
                      const decorationItems = formData.decorationItems || [];
                      const packageDecoration = (!isDurationPriced && formData.packageId)
                        ? (Number(formData.packageDecorationCost) || 0) : 0;
                      const row = (label, value, color, key) => (
                        <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{
                            color: "text.secondary"
                          }}>{label}</Typography>
                          <Typography
                            variant="body2"
                            sx={[{
                              fontWeight: 600
                            }, color ? { color } : undefined]}>{currencySym()}{(value || 0).toLocaleString('en-IN')}</Typography>
                        </Box>
                      );
                      return (
                        <>
                          {row(
                            isDurationPriced
                              ? `Duration (${formData.eventDuration || 0} hrs × ${currencySym()}${liveBilling().banquetVenueHourlyRate.toLocaleString('en-IN')}${(formData.numberOfDays || 1) > 1 ? ` × ${formData.numberOfDays} days` : ''})`
                              : (formData.packageId ? `Venue · ${formData.packageName}` : `Floor cost (${formData.selectedFloors.length} floor${formData.selectedFloors.length === 1 ? '' : 's'})`),
                            formData.floorCost,
                            '#10b981'
                          )}
                          {(() => {
                            const reserved = (formData.rooms || []).length;
                            const complimentary = parseInt(formData.complimentaryRooms, 10) || 0;
                            const chargeable = Math.max(0, reserved - complimentary);
                            if (chargeable <= 0) { return null; }
                            const days = formData.numberOfDays || 1;
                            return row(
                              `Reserved rooms (${chargeable} × ${currencySym()}${BANQUET_ROOM_RATE.toLocaleString('en-IN')}${days > 1 ? ` × ${days} days` : ''})`,
                              chargeable * BANQUET_ROOM_RATE * days,
                              '#7c3aed',
                            );
                          })()}
                          {packageDecoration > 0 &&
                            row(`Decoration · ${formData.packageName}`, packageDecoration, '#f59e0b')}
                          {decorationItems.map((it, i) => {
                            const cost = Number(it.cost) || 0;
                            if (cost <= 0) { return null; }
                            return row(`Decoration · ${it.name || 'Item'}`, cost, '#ec4899', `dec-${i}`);
                          })}
                          {cateringItems.map((it, i) => {
                            const amt = cateringItemAmount(it, formData.guestCount);
                            if (amt <= 0) { return null; }
                            const perPlate = Number(it.perPlate) || 0;
                            const hasActual = it.actualPlates != null && it.actualPlates !== '';
                            const plates = hasActual
                              ? (parseInt(it.actualPlates, 10) || 0)
                              : ((parseInt(it.plates, 10) || 0) || (parseInt(formData.guestCount, 10) || 0));
                            const days = Math.max(1, parseInt(it.days, 10) || 1);
                            return row(
                              `Catering · ${it.name || 'Item'} (${currencySym()}${perPlate.toLocaleString('en-IN')} × ${plates} plate${plates === 1 ? '' : 's'}${days > 1 ? ` × ${days} days` : ''})`,
                              amt,
                              '#8b5cf6',
                              `cat-${i}`
                            );
                          })}
                          {(parseFloat(formData.photographyAmount) || 0) > 0 &&
                            row(`Photography / Videography${formData.photographyVendor ? ` · ${formData.photographyVendor}` : ''}`, parseFloat(formData.photographyAmount) || 0, '#ec4899')}
                          {(parseFloat(formData.entertainmentCost) || 0) > 0 &&
                            row(`Entertainment${formData.entertainmentVendor ? ` · ${formData.entertainmentVendor}` : ''}`, parseFloat(formData.entertainmentCost) || 0, '#f43f5e')}
                          <Divider sx={{ my: 2 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ color: 'var(--app-primary)', fontWeight: 700 }}>Total Amount</Typography>
                            <Typography variant="h6" sx={{ color: 'var(--app-primary)', fontWeight: 700 }}>
                              {currencySym()}{(formData.totalAmount || 0).toLocaleString('en-IN')}
                            </Typography>
                          </Box>
                        </>
                      );
                    })()}
                  </Box>
                </Box>

                {/* Payment Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <PrintIcon sx={{ color: '#10b981' }} /> Payment
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth
                        label="Advance Amount"
                        type="number"
                        value={formData.advanceAmount}
                        onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                        slotProps={{
                          htmlInput: { min: 0, step: 100 }
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
                        label="Total Amount"
                        type="number"
                        value={formData.totalAmount}
                        sx={{ '& .MuiInputBase-input': { fontWeight: 600, color: 'var(--app-primary)' } }}
                        slotProps={{
                          input: { readOnly: true }
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
                        label="Remaining Amount"
                        type="number"
                        value={formData.remainingAmount}
                        sx={{ '& .MuiInputBase-input': { fontWeight: 600, color: '#ef4444' } }}
                        slotProps={{
                          input: { readOnly: true }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Payment Schedule Section (installment plan) */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Typography sx={{ ...sectionTitleSx(isDarkMode), mb: 0 }}>
                      <PaymentsIcon sx={{ color: '#6366f1' }} /> Payment Schedule
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setFormData({
                        ...formData,
                        paymentSchedule: [
                          ...(formData.paymentSchedule || []),
                          { label: '', dueDate: '', amount: '', status: 'Pending' },
                        ],
                      })}
                      sx={{ textTransform: 'none', borderRadius: '999px' }}
                    >
                      Add installment
                    </Button>
                  </Box>
                  {(formData.paymentSchedule || []).length === 0 ? (
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      No installments planned. Add one to track due dates and payment status.
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {formData.paymentSchedule.map((inst, idx) => {
                        const updateInst = (patch) => {
                          const next = formData.paymentSchedule.map((p, i) => (i === idx ? { ...p, ...patch } : p));
                          setFormData({ ...formData, paymentSchedule: next });
                        };
                        return (
                          <Grid container spacing={1.5} key={idx} sx={{
                            alignItems: "center"
                          }}>
                            <Grid
                              size={{
                                xs: 12,
                                sm: 3
                              }}>
                              <TextField
                                fullWidth size="small" label="Label"
                                placeholder="1st Installment"
                                value={inst.label}
                                onChange={(e) => updateInst({ label: e.target.value })}
                              />
                            </Grid>
                            <Grid
                              size={{
                                xs: 6,
                                sm: 3
                              }}>
                              <DatePicker
                                format="dd/MM/yyyy"
                                label="Due Date"
                                value={inst.dueDate ? parseISO(inst.dueDate) : null}
                                onChange={(date) => updateInst({ dueDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                slotProps={{
                                  textField: { fullWidth: true, size: 'small' },
                                  popper: { sx: { '& .MuiPaper-root': { backgroundColor: 'white', opacity: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } } },
                                }}
                              />
                            </Grid>
                            <Grid
                              size={{
                                xs: 6,
                                sm: 3
                              }}>
                              <TextField
                                fullWidth size="small" label={`Amount (${currencySym()})`} type="number"
                                value={inst.amount}
                                onChange={(e) => updateInst({ amount: e.target.value })}
                                slotProps={{
                                  htmlInput: { min: 0 }
                                }}
                              />
                            </Grid>
                            <Grid
                              size={{
                                xs: 9,
                                sm: 2
                              }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                  label="Status"
                                  value={inst.status}
                                  onChange={(e) => updateInst({ status: e.target.value })}
                                  MenuProps={{ slotProps: {
                                    paper: { sx: { backgroundColor: '#fff' } }
                                  } }}
                                >
                                  <MenuItem value="Pending">Pending</MenuItem>
                                  <MenuItem value="Paid">Paid</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid
                              size={{
                                xs: 3,
                                sm: 1
                              }}>
                              <IconButton
                                size="small"
                                onClick={() => setFormData({
                                  ...formData,
                                  paymentSchedule: formData.paymentSchedule.filter((_, i) => i !== idx),
                                })}
                                sx={{ color: '#ef4444' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Grid>
                          </Grid>
                        );
                      })}
                    </Stack>
                  )}
                </Box>

                {/* Contract & Terms Section */}
                <Box sx={sectionCardSx(isDarkMode)}>
                  <Typography sx={sectionTitleSx(isDarkMode)}>
                    <EventIcon sx={{ color: '#64748b' }} /> Contract &amp; Terms
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth multiline minRows={2} label="Cancellation Policy"
                        value={formData.cancellationPolicy}
                        onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <TextField
                        fullWidth multiline minRows={2} label="Refund Policy"
                        value={formData.refundPolicy}
                        onChange={(e) => setFormData({ ...formData, refundPolicy: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth multiline minRows={2} label="Damage Charges"
                        value={formData.damageCharges}
                        onChange={(e) => setFormData({ ...formData, damageCharges: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth multiline minRows={2} label="Overtime Charges"
                        value={formData.overtimeCharges}
                        onChange={(e) => setFormData({ ...formData, overtimeCharges: e.target.value })}
                      />
                    </Grid>
                    <Grid
                      size={{
                        xs: 12,
                        sm: 4
                      }}>
                      <TextField
                        fullWidth multiline minRows={2} label="Outside Vendor Policy"
                        value={formData.outsideVendorPolicy}
                        onChange={(e) => setFormData({ ...formData, outsideVendorPolicy: e.target.value })}
                      />
                    </Grid>
                    <Grid size={12}>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            checked={formData.termsAccepted}
                            onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                          />
                        )}
                        label="Customer agrees to Terms & Conditions"
                      />
                    </Grid>
                  </Grid>
                </Box>
                </>)}
              </Stack>
              </WizardStepBoundary>
            </Box>
          </motion.div>
        </DialogContent>
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          <Button onClick={handleCloseDialog} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {activeStep > 0 && (
            <Button onClick={handleBack} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
              Back
            </Button>
          )}
          {activeStep < BOOKING_STEPS.length - 1 ? (
            <Button key="wizard-next" onClick={handleNext} variant="contained" sx={primaryButtonSx}>
              Next
            </Button>
          ) : (
            <Button
              key="wizard-submit"
              type="submit"
              form="marriage-form"
              variant="contained"
              sx={primaryButtonSx}
            >
              {selectedBooking ? 'Update booking' : 'Create booking'}
            </Button>
          )}
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
      <AdvancePaymentsDialog
        open={paymentsOpen}
        onClose={() => { setPaymentsOpen(false); setPaymentsBooking(null); }}
        booking={paymentsBooking}
        onUpdated={(fresh) => {
          // Reflect the new advance/remaining in the list without a refetch.
          setBookings((prev) => prev.map((b) => (b._id === fresh._id ? { ...b, ...fresh } : b)));
          setPaymentsBooking(fresh);
        }}
      />
      <FinalizeBillingDialog
        open={finalizeOpen}
        onClose={() => { setFinalizeOpen(false); setFinalizeBooking(null); }}
        booking={finalizeBooking}
        onUpdated={(fresh) => {
          setBookings((prev) => prev.map((b) => (b._id === fresh._id ? { ...b, ...fresh } : b)));
          showSnackbar('Billing finalized with actual plates', 'success');
        }}
      />
    </PageLayout>
  );
};



// Export Banquet Hall Booking
export default BanquetHallBooking;