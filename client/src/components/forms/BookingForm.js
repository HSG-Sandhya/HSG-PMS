import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Grid, Stack, GlobalStyles, TextField, MenuItem, Divider } from '@mui/material';
import { parseISO, isValid } from 'date-fns';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ExploreIcon from '@mui/icons-material/Explore';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import PaymentIcon from '@mui/icons-material/Payment';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../hooks/useBilling';
import { calcGst, calcBreakfast, clampDiscount } from '../../utils/billing';
import {
  formatAadhaar,
  formatPassport,
  formatDrivingLicense,
  formatVoterId,
  formatPanCard,
} from './bookingForm/idFormatters';
import GuestInfoStep from './bookingForm/GuestInfoStep';
import TravelDetailsStep from './bookingForm/TravelDetailsStep';
import RoomStayStep from './bookingForm/RoomStayStep';
import PaymentStep from './bookingForm/PaymentStep';
import { currentTimeHHmm } from './bookingForm/stepConstants';
import { PremiumSection } from './bookingForm/premium';
import BookingMetaBar from './bookingForm/BookingMetaBar';
import RoomSelectionGrid from './bookingForm/RoomSelectionGrid';
import ServicesPicker from './bookingForm/ServicesPicker';
import AadhaarCapture from './bookingForm/AadhaarCapture';
import ExtraChargesEditor from './bookingForm/ExtraChargesEditor';
import ReservationSummary from './bookingForm/ReservationSummary';
import { sendWhatsApp } from './bookingForm/bookingDocs';

// The API returns booking.roomId populated as an object ({ _id, roomNumber… }),
// but the form state and the room <Select> key on the plain string _id. Without
// this, edit mode compares an object to a string, finds no match, and blanks the
// already-selected room.
const roomIdOf = (booking) =>
  booking?.roomId && typeof booking.roomId === 'object'
    ? booking.roomId._id
    : booking?.roomId || '';

/**
 * Resolve { district, state } from a 6-digit Indian PIN code.
 * Tries two providers in order and silently returns null if both fail
 * (network outage, expired upstream SSL cert, browser extension
 * interference, etc.). Uses axios so MetaMask's fetch hook can't inject
 * a parallel unhandled rejection.
 */
const lookupPincode = async (pincode) => {
  const timeout = 5000;
  // Provider 1 — postalpincode.in (rich data, sometimes has cert issues)
  try {
    const { data } = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, { timeout });
    if (data?.[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { district: po.District, state: po.State };
    }
  } catch { /* fall through to fallback */ }
  // Provider 2 — Zippopotam (open data, generally stable cert)
  try {
    const { data } = await axios.get(`https://api.zippopotam.us/in/${pincode}`, { timeout });
    const place = data?.places?.[0];
    if (place) {
      return { district: place['place name'], state: place.state };
    }
  } catch { /* both failed — caller falls back to manual entry */ }
  return null;
};

const BookingForm = ({
  formData,
  setFormData,
  handleInputChange,
  handleRoomChange,
  handlePaidAmountChange,
  handleSubmit,
  rooms,
  booking,
  onCancel,
}) => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const billing = useBilling();
  const isDarkMode = settings?.theme?.darkMode;
  const accentColor = settings?.theme?.accentColor || '#F59E42';
  const fontFamily = settings?.theme?.fontFamily;
  const fontSize = settings?.theme?.fontSize;
  const inputStyle = settings?.theme?.inputStyle || 'outlined';
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardFileBack, setIdCardFileBack] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [aadharError, setAadharError] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  // Bumping this (to a fresh timestamp) requests a submit on the next commit,
  // after any status change has flushed — see the effect below.
  const [pendingSubmit, setPendingSubmit] = useState(0);

  // Parse concatenated address in formData whenever it changes
  useEffect(() => {
    if (formData.streetName && formData.streetName.includes(',') &&
        (!formData.area || !formData.district || !formData.state || !formData.pincode)) {

      const addressParts = formData.streetName.split(',').map(part => part.trim());
      if (addressParts.length >= 3) {
        const parsedFields = {
          streetName: addressParts[0] || '',
          area: addressParts[1] || '',
          district: addressParts[2] || '',
          state: addressParts[3] || '',
          pincode: addressParts[4] || ''
        };

        // Handle state-pincode combination (e.g., "Karnataka-560003")
        if (parsedFields.state && parsedFields.state.includes('-')) {
          const stateParts = parsedFields.state.split('-');
          parsedFields.state = stateParts[0].trim();
          parsedFields.pincode = stateParts[1].trim();
        }

        setFormData(prev => ({
          ...prev,
          ...parsedFields
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.streetName]);

  // Keep the submit-facing Date fields (checkIn/checkOut — what the API and the
  // parent handlers read) in lock-step with the pickers' checkInDate/checkOutDate.
  // Without this, changing the dates left checkIn/checkOut at their stale
  // today/tomorrow defaults, so non-walk-in stays saved the wrong dates.
  useEffect(() => {
    if (!formData.checkInDate && !formData.checkOutDate) return;
    setFormData(prev => {
      let changed = false;
      const next = { ...prev };
      if (prev.checkInDate && prev.checkIn !== prev.checkInDate) { next.checkIn = prev.checkInDate; changed = true; }
      if (prev.checkOutDate && prev.checkOut !== prev.checkOutDate) { next.checkOut = prev.checkOutDate; changed = true; }
      return changed ? next : prev;
    });
  }, [formData.checkInDate, formData.checkOutDate, setFormData]);

  // Single pricing authority (new + edit). Recomputes the bill whenever the
  // room, stay window, rate plan, discount or itemised extras change:
  //   total = room base + breakfast + extras + GST(on room subtotal) − discount.
  // Deps deliberately exclude the amount outputs, so this never loops.
  useEffect(() => {
    const room = rooms.find(r => r._id === formData.roomId);
    if (!room) {
      // New booking with no room picked → clear the bill. On edit, a missing
      // room (e.g. deleted) must NOT wipe the amounts loaded from the booking.
      if (!booking) {
        setFormData(prev => (
          (prev.totalAmount || prev.baseAmount || prev.gstAmount || prev.extraChargesTotal)
            ? { ...prev, totalAmount: 0, baseAmount: 0, breakfastAmount: 0, discountAmount: 0, gstAmount: 0, extraChargesTotal: 0, remainingAmount: 0 }
            : prev
        ));
      }
      return;
    }
    const nights = calculateNights(formData.checkInDate, formData.checkInTime, formData.checkOutDate, formData.checkOutTime);
    const baseAmount = (room.pricePerNight || 0) * nights;
    const breakfastAmount = formData.tariffType === 'breakfast' ? calcBreakfast(nights, billing) : 0;
    const ec = formData.extraCharges || {};
    const extraChargesTotal = ['extraBed', 'extraPerson', 'foodPackage', 'laundry', 'transport', 'other']
      .reduce((s, k) => s + (Number(ec[k]) || 0), 0);
    const subtotal = baseAmount + breakfastAmount;
    // GST is charged on the room subtotal (pre-discount); the discount is a
    // percentage off the base room price only.
    const gstAmount = calcGst(subtotal, billing);
    const discountPct = clampDiscount(formData.discount, billing);
    const discountAmount = baseAmount * (discountPct / 100);
    const totalAmount = Math.round(subtotal + extraChargesTotal + gstAmount - discountAmount);
    const remainingAmount = Math.max(0, totalAmount - (Number(formData.paidAmount) || 0));

    setFormData(prev => ({
      ...prev,
      baseAmount: Math.round(baseAmount),
      breakfastAmount: Math.round(breakfastAmount),
      extraChargesTotal: Math.round(extraChargesTotal),
      gstAmount: Math.round(gstAmount),
      discountAmount: Math.round(discountAmount),
      totalAmount,
      remainingAmount,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, formData.roomId, formData.checkInDate, formData.checkInTime, formData.checkOutDate, formData.checkOutTime, formData.tariffType, formData.discount, formData.extraCharges, formData.paidAmount, rooms, billing]);

  useEffect(() => {

    if (booking) {
      const bookingRoomId = roomIdOf(booking);
      const roomExists = rooms.some(room => room._id === bookingRoomId);

      // Parse address if it's concatenated in streetName
      let parsedBooking = { ...booking };


      if (booking.streetName && booking.streetName.includes(',')) {
        const addressParts = booking.streetName.split(',').map(part => part.trim());

        if (addressParts.length >= 3) {
          parsedBooking = {
            ...booking,
            streetName: addressParts[0] || '',
            area: addressParts[1] || '',
            district: addressParts[2] || '',
            state: addressParts[3] || '',
            pincode: addressParts[4] || ''
          };

          // Extract pincode from state if it contains both (e.g., "Karnataka, 560003")
          if (parsedBooking.state && parsedBooking.state.includes(',')) {
            const stateParts = parsedBooking.state.split(',');
            parsedBooking.state = stateParts[0].trim();
            parsedBooking.pincode = stateParts[1].trim();
          }

        }
      }

      // The API returns Booking.checkIn / Booking.checkOut (matching the
       // Mongo schema), but the form state reads checkInDate / checkOutDate.
       // Map them across when populating from an existing booking so edit
       // mode shows the dates the guest actually chose.
       setFormData({
        ...parsedBooking,
        roomId: roomExists ? bookingRoomId : '',
        checkInDate:  parsedBooking.checkIn  || parsedBooking.checkInDate  || '',
        checkOutDate: parsedBooking.checkOut || parsedBooking.checkOutDate || '',
        checkInTime:  parsedBooking.checkInTime  || currentTimeHHmm(),
        checkOutTime: parsedBooking.checkOutTime || billing.defaultCheckOutTime,
      });
    }
  }, [booking, rooms, setFormData, billing.defaultCheckOutTime]);

  // Defaults: check-in time = now (when the guest is being booked in),
  // check-out 11:00 AM (hotel policy).
  useEffect(() => {
    setFormData(prev => {
      const checkInDate = prev.checkInDate || new Date().toISOString();
      const nextDay = new Date(checkInDate);
      nextDay.setDate(nextDay.getDate() + 1);

      return {
        ...prev,
        checkInTime: prev.checkInTime || currentTimeHHmm(),
        checkOutTime: billing.defaultCheckOutTime,
        checkOutDate: prev.checkOutDate || nextDay.toISOString(),
      };
    });
  }, [setFormData, billing.defaultCheckOutTime]);

  // Initialize default check-in date and time on component mount
  useEffect(() => {
    if (!formData.checkInDate || !formData.checkInTime) {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      setFormData(prev => ({
        ...prev,
        checkInDate: prev.checkInDate || now.toISOString(),
        checkInTime: prev.checkInTime || currentTimeHHmm(),
        checkOutDate: prev.checkOutDate || tomorrow.toISOString(),
        checkOutTime: prev.checkOutTime || billing.defaultCheckOutTime
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Auto-advance checkout date when check-in date changes, but ONLY if
  // the current checkout is missing or is not strictly after the new
  // check-in. This preserves multi-night stays loaded from an existing
  // booking instead of collapsing them to one night.
  useEffect(() => {
    if (!formData.checkInDate) return;
    const checkIn = new Date(formData.checkInDate);
    const currentCheckOut = formData.checkOutDate ? new Date(formData.checkOutDate) : null;
    if (currentCheckOut && currentCheckOut > checkIn) return; // already valid → leave alone

    const nextDay = new Date(checkIn);
    nextDay.setDate(nextDay.getDate() + 1);
    setFormData(prev => ({
      ...prev,
      checkOutDate: nextDay.toISOString(),
    }));
  }, [formData.checkInDate, formData.checkOutDate, setFormData]);

  // Fire the parent submit once a requested status change has been committed.
  // Awaiting keeps the buttons disabled ("Saving…") for the whole request and
  // blocks double-submits; on success the dialog unmounts so the guarded reset
  // is skipped.
  useEffect(() => {
    if (!pendingSubmit) return;
    let cancelled = false;
    (async () => {
      try { await handleSubmit({ preventDefault: () => {} }); }
      finally { if (!cancelled) setPendingSubmit(0); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubmit]);


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIdCardFile(file);
      setFormData({ ...formData, idCardImage: file });
    }
  };

  const handleDateChange = (field, date) => {
    if (date && isValid(date)) {
      const isoString = date.toISOString();

      if (field === 'checkInDate') {
        // Set check-out date to next day; default check-in/out times to policy.
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const checkOutIsoString = nextDay.toISOString();

        setFormData({
          ...formData,
          checkInDate: isoString,
          // Keep the time the operator set (defaulting to now) — changing the
          // date shouldn't snap check-in back to a fixed noon.
          checkInTime: formData.checkInTime || currentTimeHHmm(),
          checkOutDate: checkOutIsoString,
          checkOutTime: billing.defaultCheckOutTime
        });
      } else if (field !== 'checkOutDate') {
        // Prevent manual changes to checkout date
        setFormData({ ...formData, [field]: isoString });
      }
    }
  };

  const handleTimeChange = (field, time) => {
    if (time && isValid(time)) {
      // Convert Date object to HH:MM format (24-hour)
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      setFormData({
        ...formData,
        [field]: timeString
      });
    }
  };

  const validateAadhar = (aadharNumber) => {
    // Strip spaces/separators for validation
    const cleanNumber = aadharNumber.replace(/\D/g, '');

    // Check if it's exactly 12 digits
    if (cleanNumber.length !== 12 || !/^[0-9]{12}$/.test(cleanNumber)) {
      return false;
    }

    // Verhoeff algorithm for Aadhaar validation
    const d = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
    const p = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];

    let c = 0;
    const myArray = cleanNumber.split('').reverse();

    // Verhoeff validation processes the full number (incl. the check digit) with
    // the permutation indexed by p[i % 8] — i starting at 0 for the rightmost
    // digit. (The p[(i+1) % 8] offset is for GENERATING a check digit, not
    // validating; using it here rejected every real Aadhaar.)
    for (let i = 0; i < myArray.length; i++) {
      c = d[c][p[(i % 8)][parseInt(myArray[i])]];
    }

    return c === 0;
  };

  const handleAadharInput = (e) => {
    const formatted = formatAadhaar(e.target.value);
    const digits = formatted.replace(/\D/g, '');

    // Validate Aadhaar once all 12 digits are entered.
    if (digits.length === 12) {
      setAadharError(validateAadhar(formatted) ? '' : 'Invalid Aadhaar number');
    } else {
      setAadharError('');
    }

    setFormData({ ...formData, idCardNumber: formatted });
  };

  const handlePassportInput = (e) => {
    setFormData({ ...formData, idCardNumber: formatPassport(e.target.value) });
  };

  const handleDrivingLicenseInput = (e) => {
    setFormData({ ...formData, idCardNumber: formatDrivingLicense(e.target.value) });
  };

  const handleVoterIdInput = (e) => {
    setFormData({ ...formData, idCardNumber: formatVoterId(e.target.value) });
  };

  const handlePanCardInput = (e) => {
    setFormData({ ...formData, idCardNumber: formatPanCard(e.target.value) });
  };

  const calculateNights = (checkInDate, checkInTime, checkOutDate, checkOutTime) => {
    if (!checkInDate || !checkOutDate) {
      return 1;
    }

    try {
      const checkInDateObj = typeof checkInDate === 'string' ? parseISO(checkInDate) : checkInDate;
      const checkOutDateObj = typeof checkOutDate === 'string' ? parseISO(checkOutDate) : checkOutDate;

      if (!isValid(checkInDateObj) || !isValid(checkOutDateObj)) {
        return 1;
      }

      // Get date part only for base calculation
      const checkInDateOnly = new Date(checkInDateObj.getFullYear(), checkInDateObj.getMonth(), checkInDateObj.getDate());
      const checkOutDateOnly = new Date(checkOutDateObj.getFullYear(), checkOutDateObj.getMonth(), checkOutDateObj.getDate());

      // Calculate base nights as the difference in days
      let nights = Math.floor((checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24));
      nights = Math.max(1, nights);

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
    } catch (error) {
      console.error('Error calculating nights:', error);
      return 1;
    }
  };

  // ── Derived + actions ──────────────────────────────────────────────────────
  const selectedRoom = rooms.find((r) => r._id === formData.roomId) || null;
  const bookingId = formData.bookingId || booking?.bookingId || '';

  const onSelectRoom = (roomId) => handleRoomChange({ target: { value: roomId } });
  const onServicesChange = (arr) => setFormData((prev) => ({ ...prev, additionalServices: arr }));
  const onExtraChargesChange = (next) => setFormData((prev) => ({ ...prev, extraCharges: next }));

  // Aadhaar front/back image setters (null clears) + OCR review apply.
  const setFrontImage = (file) => { setIdCardFile(file); setFormData((prev) => ({ ...prev, idCardImage: file })); };
  const setBackImage = (file) => { setIdCardFileBack(file); setFormData((prev) => ({ ...prev, idCardImageBack: file })); };
  const onAadhaarApply = (fields, aadhaar) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    if (aadhaar) setAadharError(validateAadhar(aadhaar) ? '' : 'Invalid Aadhaar number');
  };

  const onSave = () => setPendingSubmit(Date.now());
  const onConfirm = () => {
    setFormData((prev) => ({ ...prev, bookingStatus: 'Confirmed' }));
    setPendingSubmit(Date.now());
  };
  const onWhatsApp = () => {
    if (!sendWhatsApp({ formData, settings, bookingId })) {
      alert('Enter a valid 10-digit mobile number first.');
    }
  };

  return (
    <>
      <GlobalStyles styles={{
        '.MuiPickersPopper-root .MuiPaper-root': {
          background: isDarkMode ? '#23272f' : '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        },
        'input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        'input[type=number]': {
          MozAppearance: 'textfield',
        },
      }} />
      <Box sx={{
        fontFamily,
        fontSize,
        color: isDarkMode ? 'rgba(241, 245, 249, 0.92)' : 'rgba(15, 23, 42, 0.92)',
      }}>
        <BookingMetaBar
          formData={formData}
          handleInputChange={handleInputChange}
          user={user}
          isEdit={!!booking}
          bookingId={bookingId}
        />

        <Grid container spacing={2.5} sx={{ mt: 0.25 }}>
          {/* Main column — the reservation worksheet */}
          <Grid
            size={{
              xs: 12,
              md: 8
            }}>
            <Stack spacing={2.5}>
              <PremiumSection index={1} icon={<PersonOutlineIcon />} title="Guest Information"
                subtitle="Primary guest, contact & classification">
                <GuestInfoStep
                  formData={formData}
                  handleInputChange={handleInputChange}
                  inputStyle={inputStyle}
                  accentColor={accentColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  emailError={emailError}
                  setEmailError={setEmailError}
                  hideHeader
                />
              </PremiumSection>

              <PremiumSection index={2} icon={<EventAvailableIcon />} title="Stay Details"
                subtitle="Dates, occupancy & guest preferences">
                <RoomStayStep
                  formData={formData}
                  setFormData={setFormData}
                  handleInputChange={handleInputChange}
                  handleRoomChange={handleRoomChange}
                  handleDateChange={handleDateChange}
                  handleTimeChange={handleTimeChange}
                  inputStyle={inputStyle}
                  accentColor={accentColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  rooms={rooms}
                  calculateNights={calculateNights}
                  hideHeader
                  hideRoomSelect
                />
              </PremiumSection>

              <PremiumSection index={3} icon={<MeetingRoomIcon />} title="Room Selection"
                subtitle="Pick an available room for the selected dates">
                <RoomSelectionGrid
                  rooms={rooms}
                  value={formData.roomId}
                  onSelect={onSelectRoom}
                  checkInDate={formData.checkInDate}
                  checkOutDate={formData.checkOutDate}
                />
              </PremiumSection>

              <PremiumSection index={4} icon={<ExploreIcon />} title="Travel & Address"
                subtitle="Origin, purpose of visit & guest address">
                <TravelDetailsStep
                  formData={formData}
                  handleInputChange={handleInputChange}
                  setFormData={setFormData}
                  inputStyle={inputStyle}
                  accentColor={accentColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  pincodeLoading={pincodeLoading}
                  setPincodeLoading={setPincodeLoading}
                  lookupPincode={lookupPincode}
                />
              </PremiumSection>

              <PremiumSection index={5} icon={<RoomServiceIcon />} title="Additional Services"
                subtitle="Pre-arrange services so teams can prepare ahead">
                <ServicesPicker value={formData.additionalServices} onChange={onServicesChange} />
              </PremiumSection>

              <PremiumSection index={6} icon={<PaymentIcon />} title="Pricing, Payment & ID"
                subtitle="Charges, advance, payment mode & identity proof">
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField
                      select fullWidth size="small" label="Rate Plan" name="tariffType"
                      value={formData.tariffType || 'normal'} onChange={handleInputChange}
                      helperText="With Breakfast adds the configured breakfast tariff per night"
                    >
                      <MenuItem value="normal">Room Only</MenuItem>
                      <MenuItem value="breakfast">With Breakfast</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
                <ExtraChargesEditor value={formData.extraCharges} onChange={onExtraChargesChange} />
                <Divider sx={{ my: 2.5 }} />
                <PaymentStep
                  formData={formData}
                  handleInputChange={handleInputChange}
                  handlePaidAmountChange={handlePaidAmountChange}
                  inputStyle={inputStyle}
                  accentColor={accentColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  handleAadharInput={handleAadharInput}
                  handlePassportInput={handlePassportInput}
                  handleDrivingLicenseInput={handleDrivingLicenseInput}
                  handleVoterIdInput={handleVoterIdInput}
                  handlePanCardInput={handlePanCardInput}
                  aadharError={aadharError}
                  handleFileChange={handleFileChange}
                  idCardFile={idCardFile}
                  hideImageUpload={formData.idCardType === 'Aadhaar Card'}
                />
                {formData.idCardType === 'Aadhaar Card' && (
                  <AadhaarCapture
                    frontFile={idCardFile instanceof File ? idCardFile : null}
                    backFile={idCardFileBack}
                    onFront={setFrontImage}
                    onBack={setBackImage}
                    onApply={onAadhaarApply}
                    validateAadhaar={validateAadhar}
                  />
                )}
              </PremiumSection>
            </Stack>
          </Grid>

          {/* Side column — sticky live summary + actions */}
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <ReservationSummary
              formData={formData}
              room={selectedRoom}
              onSave={onSave}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onWhatsApp={onWhatsApp}
              saving={!!pendingSubmit}
            />
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default BookingForm;
