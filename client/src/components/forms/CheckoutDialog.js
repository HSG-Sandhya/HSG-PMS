import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Divider,
  Stack,
  Chip,
  useTheme,
  InputAdornment,
} from '@mui/material';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import HotelIcon from '@mui/icons-material/HotelOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTimeOutlined';
import api from '../../api';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  labelSx,
  valueSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from './formStyles';
import AppDatePicker from './AppDatePicker';
import AppTimePicker from './AppTimePicker';
import { useBilling } from '../../hooks/useBilling';
import { currencySym } from '../../utils/billing';

const toDate = (input) => {
  if (!input) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'string') {
    const parsed = input.includes('T') ? parseISO(input) : new Date(input);
    return isValid(parsed) ? parsed : null;
  }
  const fallback = new Date(input);
  return isValid(fallback) ? fallback : null;
};

const safeFormat = (input, pattern) => {
  const date = toDate(input);
  return date ? format(date, pattern) : '—';
};

const moneyRow = (label, value, opts = {}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, ...opts.sx }}>
    <Typography sx={{ fontSize: 13, color: opts.muted ? 'text.secondary' : 'inherit' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 13, fontWeight: opts.bold ? 700 : 500, color: opts.color || 'inherit' }}>
      {value}
    </Typography>
  </Box>
);

const CheckoutDialog = ({ open, onClose, booking, room, onPaymentComplete }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const billing = useBilling();
  const roomGstFrac = billing.roomGstRate / 100;

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [actualNights, setActualNights] = useState(0);
  const [adjustedAmount, setAdjustedAmount] = useState(0);

  const calculateNights = (date, time) => {
    if (!booking || !date || !time) return;
    const checkInDate = toDate(booking.checkIn);
    const checkoutDate = toDate(date);
    if (!checkInDate || !checkoutDate) return;

    const timeDiff = checkoutDate.getTime() - checkInDate.getTime();
    let nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (nights <= 0) nights = differenceInDays(checkoutDate, checkInDate);

    const [checkoutHour, checkoutMinute] = time.split(':').map((n) => parseInt(n, 10));
    const checkoutTimeInMinutes = checkoutHour * 60 + checkoutMinute;
    const twelvePMInMinutes = 12 * 60;
    if (nights === 0) nights = 1;
    if (checkoutTimeInMinutes > twelvePMInMinutes) nights += 1;
    setActualNights(Math.max(1, nights));
  };

  useEffect(() => {
    if (!booking) return;
    const fetchRestaurantOrders = async () => {
      try {
        const response = await api.restaurant.getOrdersByBooking(booking._id);
        setRestaurantOrders(response.data || []);
      } catch {
        setRestaurantOrders([]);
      }
    };
    fetchRestaurantOrders();

    // Default the checkout to TODAY — the guest is leaving now — not the
    // booking's planned checkout date. This bills the actual nights stayed, so
    // an overstay (e.g. checked in 30 Jun, leaving 2 Jul) counts every night
    // instead of stopping at the originally-planned date. Never before check-in.
    const now = new Date();
    const checkInObj = toDate(booking.checkIn);
    const effectiveCheckout = checkInObj && now < checkInObj ? checkInObj : now;
    const initDate = format(effectiveCheckout, 'yyyy-MM-dd');
    const initTime = format(now, 'HH:mm');
    setCheckoutDate(initDate);
    setCheckoutTime(initTime);
    calculateNights(initDate, initTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  useEffect(() => {
    if (booking && actualNights > 0 && room) {
      const baseRoomPrice = room.pricePerNight || 0;
      const baseAmount = baseRoomPrice * actualNights;
      const gstAmount = baseAmount * roomGstFrac;
      setAdjustedAmount(baseAmount + gstAmount);
    }
  }, [actualNights, booking, room, roomGstFrac]);

  // Food bill — order.totalAmount is the GST-exclusive base. We add the
  // configured POS GST on top so the checkout total matches the printed invoice
  // (which also applies GST via RestaurantCalculationUtils).
  const restaurantSubtotal = restaurantOrders.reduce(
    (total, order) => total + (order.totalAmount || 0),
    0,
  );
  const restaurantGst = Math.round(restaurantSubtotal * (billing.posGstRate / 100) * 100) / 100;
  const restaurantCharges = restaurantSubtotal + restaurantGst;
  const totalWithRestaurant = (adjustedAmount || booking?.totalAmount || 0) + restaurantCharges;
  const remainingWithRestaurant = totalWithRestaurant - (booking?.paidAmount || 0);

  useEffect(() => {
    setPaymentAmount(remainingWithRestaurant);
  }, [remainingWithRestaurant]);

  useEffect(() => {
    if (open && !checkoutTime) {
      setCheckoutTime(format(new Date(), 'HH:mm'));
    }
  }, [open, checkoutTime]);

  const handlePaymentComplete = () => {
    const checkoutDateTime = new Date(`${checkoutDate}T${checkoutTime}`);
    onPaymentComplete({
      method: paymentMethod,
      amount: parseFloat(paymentAmount),
      reference: paymentReference,
      date: new Date(),
      checkoutDate: checkoutDateTime,
      actualNights,
      adjustedAmount,
      restaurantCharges,
      totalWithRestaurant,
    });
  };

  if (!booking || !room) return null;

  // Derived for display
  const checkoutTimeBucket = (() => {
    if (!checkoutTime) return null;
    const [h, m] = checkoutTime.split(':').map((n) => parseInt(n, 10));
    const mins = h * 60 + m;
    if (mins <= 11 * 60) return { label: 'On-time checkout · before 11:00 AM', color: 'success' };
    if (mins <= 12 * 60) return { label: 'Grace window · 11:00 – 12:00, no extra charge', color: 'info' };
    return { label: 'Late checkout · extra night charged', color: 'warning' };
  })();

  const balancePositive = remainingWithRestaurant > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: dialogPaperSx(isDarkMode) }}
      BackdropProps={{ sx: dialogBackdropSx }}
    >
      <Box sx={headerWrapSx(isDarkMode)}>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 600 }}>
              Checkout
            </Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', mt: 0.5 }}>
              {booking.guestName || 'Guest'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                icon={<HotelIcon sx={{ fontSize: 16 }} />}
                label={`${room.roomNumber} · ${room.type}`}
                size="small"
                sx={{ borderRadius: 999 }}
              />
              <Chip
                icon={<EventIcon sx={{ fontSize: 16 }} />}
                label={`${safeFormat(booking.checkIn, 'dd MMM')} → ${safeFormat(booking.checkOut, 'dd MMM yyyy')}`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 999 }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={labelSx(isDarkMode)}>Balance due</Typography>
            <Typography
              sx={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: balancePositive ? 'error.main' : 'success.main',
              }}
            >
              {currencySym()}{remainingWithRestaurant.toFixed(2)}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
        <Grid container spacing={2.5}>
          {/* Summary */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>Stay summary</Typography>

              <Stack spacing={0.5} sx={{ mb: 2 }}>
                <Typography sx={valueSx(isDarkMode)}>
                  {actualNights} night{actualNights === 1 ? '' : 's'} · {format(toDate(booking.checkIn) || new Date(), 'dd MMM')} → {checkoutDate || '—'}
                </Typography>
                {checkoutTimeBucket && (
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                    size="small"
                    color={checkoutTimeBucket.color}
                    variant="outlined"
                    label={checkoutTimeBucket.label}
                    sx={{ borderRadius: 999, alignSelf: 'flex-start', mt: 0.5 }}
                  />
                )}
              </Stack>

              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />

              <Typography sx={sectionTitleSx(isDarkMode)}>Charges</Typography>
              {adjustedAmount !== booking.totalAmount && booking.totalAmount ? (
                moneyRow(
                  'Original room charges',
                  `${currencySym()}${Number(booking.totalAmount).toFixed(2)}`,
                  { muted: true, sx: { textDecoration: 'line-through' } },
                )
              ) : null}
              {moneyRow(
                `Room ${actualNights} night${actualNights === 1 ? '' : 's'}`,
                `${currencySym()}${room?.pricePerNight ? (room.pricePerNight * actualNights).toFixed(2) : ((adjustedAmount || booking.totalAmount) / (1 + roomGstFrac)).toFixed(2)}`,
              )}
              {moneyRow(
                `GST (${billing.roomGstRate}%)`,
                `${currencySym()}${room?.pricePerNight ? (room.pricePerNight * actualNights * roomGstFrac).toFixed(2) : (((adjustedAmount || booking.totalAmount) * roomGstFrac) / (1 + roomGstFrac)).toFixed(2)}`,
                { muted: true },
              )}
              {moneyRow(
                'Room total (incl. GST)',
                `${currencySym()}${(adjustedAmount || booking.totalAmount || 0).toFixed(2)}`,
                { bold: true },
              )}
              {restaurantSubtotal > 0 && (
                <>
                  {moneyRow('Food & beverage', `${currencySym()}${restaurantSubtotal.toFixed(2)}`)}
                  {moneyRow(`Food GST (${billing.posGstRate}%)`, `${currencySym()}${restaurantGst.toFixed(2)}`, { muted: true })}
                  {moneyRow('Food total (incl. GST)', `${currencySym()}${restaurantCharges.toFixed(2)}`, { bold: true })}
                </>
              )}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow('Total', `${currencySym()}${totalWithRestaurant.toFixed(2)}`, { bold: true })}
              {moneyRow('Paid', `- ${currencySym()}${(booking.paidAmount || 0).toFixed(2)}`, { color: 'success.main' })}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow(
                'Balance due',
                `${currencySym()}${remainingWithRestaurant.toFixed(2)}`,
                { bold: true, color: balancePositive ? 'error.main' : 'success.main' },
              )}
            </Box>
          </Grid>

          {/* Payment */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>Checkout details</Typography>

              <Stack spacing={2} sx={{ mb: 2.5 }}>
                <AppDatePicker
                  label="Checkout date"
                  value={checkoutDate}
                  onChange={(newDate) => {
                    const currentTime = format(new Date(), 'HH:mm');
                    setCheckoutDate(newDate);
                    setCheckoutTime(currentTime);
                    if (booking && newDate) calculateNights(newDate, currentTime);
                  }}
                />
                <AppTimePicker
                  label="Checkout time"
                  value={checkoutTime || ''}
                  onChange={(newTime) => {
                    setCheckoutTime(newTime);
                    if (booking && checkoutDate) calculateNights(checkoutDate, newTime);
                  }}
                />
              </Stack>

              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />

              <Typography sx={sectionTitleSx(isDarkMode)}>Payment</Typography>

              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend" sx={{ fontSize: 12, mb: 0.5 }}>
                  Method
                </FormLabel>
                <RadioGroup row value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <FormControlLabel value="Cash" control={<Radio />} label="Cash" />
                  <FormControlLabel value="Card" control={<Radio />} label="Card" />
                  <FormControlLabel value="UPI" control={<Radio />} label="UPI" />
                </RadioGroup>
              </FormControl>

              <TextField
                label="Amount"
                type="number"
                fullWidth
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment>,
                }}
                sx={{ mb: paymentMethod !== 'Cash' ? 2 : 0 }}
              />

              {paymentMethod !== 'Cash' && (
                <TextField
                  label="Reference / Transaction ID"
                  fullWidth
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={actionsBarSx(isDarkMode)}>
        <Button onClick={onClose} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
          Cancel
        </Button>
        <Button
          onClick={handlePaymentComplete}
          variant="contained"
          disabled={!paymentAmount || paymentAmount <= 0}
          sx={primaryButtonSx}
        >
          Complete checkout
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CheckoutDialog;
