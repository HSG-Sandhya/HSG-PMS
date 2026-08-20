import { useState, useEffect, useMemo } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Switch,
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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
  // Whether the room-service bill is settled on this invoice. Off means the
  // food is collected separately (guest pays the outlet, company tab, comped):
  // the orders stay untouched, they just leave this bill and this invoice.
  const [includeRestaurant, setIncludeRestaurant] = useState(true);
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [actualNights, setActualNights] = useState(0);
  // Late checkout is charged only if the front desk types an amount here.
  const [lateCheckoutCharge, setLateCheckoutCharge] = useState('');
  // Room tariff actually agreed for this stay. Guests bargain at the desk, so
  // the rate is editable here and the whole bill (GST included) re-prices off
  // it. `tariffMode` says whether the typed figure is the taxable tariff or the
  // all-in number the guest was quoted ("₹1,500 total"), which is backed out to
  // its taxable base so GST is never charged on top of an inclusive price.
  const [tariffInput, setTariffInput] = useState('');
  const [tariffMode, setTariffMode] = useState('exclusive');

  // Nights stayed, from the dates alone. A late departure no longer silently
  // adds a night — the desk decides what (if anything) to charge, in the Late
  // checkout field below.
  const calculateNights = (date) => {
    if (!booking || !date) return;
    const checkInDate = toDate(booking.checkIn);
    const checkoutDate = toDate(date);
    if (!checkInDate || !checkoutDate) return;

    const timeDiff = checkoutDate.getTime() - checkInDate.getTime();
    let nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (nights <= 0) nights = differenceInDays(checkoutDate, checkInDate);
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
    setLateCheckoutCharge('');
    setTariffInput('');
    setTariffMode('exclusive');
    calculateNights(initDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  // The tariff the desk starts from: the rate already agreed on this booking (a
  // re-opened checkout, or a rate negotiated at check-in), else the room's list
  // price, else the rate implied by the booking total when the room record
  // carries no price. Always the taxable figure — GST is added on top of it.
  const listTariff = useMemo(() => {
    const agreed = Number(booking?.roomRate) || 0;
    if (agreed > 0) return round2(agreed);
    const price = Number(room?.pricePerNight) || 0;
    if (price > 0) return round2(price);
    const nights = Number(booking?.nights) || actualNights || 1;
    const total = Number(booking?.totalAmount) || 0;
    return total > 0 ? round2(total / (1 + roomGstFrac) / nights) : 0;
  }, [booking, room, actualNights, roomGstFrac]);

  // Blank / nonsense in the tariff field means "no bargain" — bill the list
  // tariff. A figure typed in "incl. GST" mode is the all-in price the guest
  // agreed to, so the taxable tariff is backed out of it.
  const typedTariff = parseFloat(tariffInput);
  const enteredTariff = Number.isFinite(typedTariff) && typedTariff >= 0 ? typedTariff : null;
  const baseTariff = enteredTariff === null
    ? listTariff
    : round2(tariffMode === 'inclusive' ? enteredTariff / (1 + roomGstFrac) : enteredTariff);
  const tariffNegotiated = baseTariff !== listTariff;

  const roomBaseAmount = round2(baseTariff * actualNights);
  const roomGstAmount = round2(roomBaseAmount * roomGstFrac);
  const adjustedAmount = round2(roomBaseAmount + roomGstAmount);
  // Once the nights are known the re-priced figure IS the room bill, even when
  // it comes to zero (a comped room) — only fall back to the booking's stored
  // total before that first calculation lands.
  const roomTotal = actualNights > 0 ? adjustedAmount : Number(booking?.totalAmount) || 0;

  // Food bill — order.totalAmount is already GST-INCLUSIVE (base + POS GST) and
  // equals the printed invoice's F&B total, so the charge is the sum as-is. We do
  // NOT re-add GST; we only split the base/GST back out for the on-screen breakdown.
  const restaurantOrdersTotal = restaurantOrders.reduce(
    (total, order) => total + (order.totalAmount || 0),
    0,
  );
  // Excluding the food bill zeroes it out of every figure below, so the balance
  // due, the amount collected and the printed invoice all agree.
  const restaurantCharges = includeRestaurant ? restaurantOrdersTotal : 0;
  const restaurantSubtotal = billing.posGstRate > 0
    ? Math.round((restaurantCharges / (1 + billing.posGstRate / 100)) * 100) / 100
    : restaurantCharges;
  const restaurantGst = Math.round((restaurantCharges - restaurantSubtotal) * 100) / 100;
  // Blank / zero / nonsense means no late charge at all — nothing is added.
  const lateFee = Math.max(0, parseFloat(lateCheckoutCharge) || 0);
  const totalWithRestaurant = roomTotal + restaurantCharges + lateFee;
  const remainingWithRestaurant = totalWithRestaurant - (booking?.paidAmount || 0);
  // A blank or non-numeric field means "collect nothing", not NaN — NaN would
  // poison the booking's paidAmount on the way through.
  const amountToCollect = Math.max(0, parseFloat(paymentAmount) || 0);
  // Only a bill with money still owed needs a payment before the guest can leave.
  // A settled (or overpaid) booking checks out with nothing to collect.
  const balanceDue = remainingWithRestaurant > 0;
  const canComplete = !balanceDue || amountToCollect > 0;

  // Never pre-fill a negative amount: an overpaid booking has nothing to collect,
  // and a negative payment would be subtracted from what the guest has paid.
  useEffect(() => {
    setPaymentAmount(Math.max(0, Math.round(remainingWithRestaurant * 100) / 100));
  }, [remainingWithRestaurant]);

  useEffect(() => {
    if (open && !checkoutTime) {
      setCheckoutTime(format(new Date(), 'HH:mm'));
    }
  }, [open, checkoutTime]);

  // Re-opening checkout for a booking should show the choice made last time
  // (defaults to billing the food, which is what every existing booking did).
  useEffect(() => {
    if (open) {
      setIncludeRestaurant(booking?.includeRestaurantInInvoice !== false);
    }
  }, [open, booking?.includeRestaurantInInvoice]);

  const handlePaymentComplete = () => {
    const checkoutDateTime = new Date(`${checkoutDate}T${checkoutTime}`);
    onPaymentComplete({
      method: paymentMethod,
      amount: amountToCollect,
      reference: paymentReference,
      date: new Date(),
      checkoutDate: checkoutDateTime,
      actualNights,
      adjustedAmount,
      restaurantCharges,
      // Persisted on the booking so a re-printed invoice makes the same choice
      // the desk made at checkout.
      includeRestaurantInInvoice: includeRestaurant,
      lateCheckoutFee: lateFee,
      // The agreed per-night tariff and its GST split, so the booking (and the
      // invoice printed off it) shows the rate the guest actually paid rather
      // than the room's list price.
      roomRate: baseTariff,
      roomBaseAmount,
      roomGstAmount,
      // Room nights + the manual late charge; the room total the booking stores
      // has to carry the late fee, because that is what the guest is billed.
      roomTotalWithLateFee: roomTotal + lateFee,
      totalWithRestaurant,
    });
  };

  if (!booking || !room) return null;

  // Derived for display
  // Informational only — nothing here changes the bill. A late departure is
  // charged if, and only if, someone types an amount into "Late checkout charge".
  const checkoutTimeBucket = (() => {
    if (!checkoutTime) return null;
    const [h, m] = checkoutTime.split(':').map((n) => parseInt(n, 10));
    const mins = h * 60 + m;
    if (mins <= 11 * 60) return { label: 'On-time checkout · before 11:00 AM', color: 'success' };
    if (mins <= 12 * 60) return { label: 'Grace window · 11:00 – 12:00', color: 'info' };
    return { label: 'Late checkout · add a charge below if applicable', color: 'warning' };
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: { sx: dialogBackdropSx },
        paper: { sx: dialogPaperSx(isDarkMode) }
      }}>
      <Box sx={headerWrapSx(isDarkMode)}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between"
          }}>
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
                color: balanceDue ? 'error.main' : 'success.main',
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
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
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
              {roomTotal !== booking.totalAmount && booking.totalAmount ? (
                moneyRow(
                  'Original room charges',
                  `${currencySym()}${Number(booking.totalAmount).toFixed(2)}`,
                  { muted: true, sx: { textDecoration: 'line-through' } },
                )
              ) : null}
              {moneyRow(
                `Room ${actualNights} night${actualNights === 1 ? '' : 's'} × ${currencySym()}${baseTariff.toFixed(2)}`,
                `${currencySym()}${roomBaseAmount.toFixed(2)}`,
              )}
              {tariffNegotiated && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`Negotiated rate · list ${currencySym()}${listTariff.toFixed(2)}/night`}
                  sx={{ borderRadius: 999, my: 0.5 }}
                />
              )}
              {moneyRow(
                `GST (${billing.roomGstRate}%)`,
                `${currencySym()}${roomGstAmount.toFixed(2)}`,
                { muted: true },
              )}
              {moneyRow(
                'Room total (incl. GST)',
                `${currencySym()}${roomTotal.toFixed(2)}`,
                { bold: true },
              )}
              {lateFee > 0 && moneyRow('Late checkout charge', `${currencySym()}${lateFee.toFixed(2)}`)}
              {restaurantOrdersTotal > 0 && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                      Bill food to this room
                    </Typography>
                    <Switch
                      size="small"
                      checked={includeRestaurant}
                      onChange={(e) => setIncludeRestaurant(e.target.checked)}
                    />
                  </Box>
                  {includeRestaurant ? (
                    <>
                      {moneyRow('Food & beverage', `${currencySym()}${restaurantSubtotal.toFixed(2)}`)}
                      {moneyRow(`Food GST (${billing.posGstRate}%)`, `${currencySym()}${restaurantGst.toFixed(2)}`, { muted: true })}
                      {moneyRow('Food total (incl. GST)', `${currencySym()}${restaurantCharges.toFixed(2)}`, { bold: true })}
                    </>
                  ) : (
                    // Still shown, so the desk can see what is being left off and
                    // knows there is a food bill to collect elsewhere.
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic', mt: 0.5 }}>
                      {currencySym()}{restaurantOrdersTotal.toFixed(2)} of food excluded — settled separately,
                      and left off the room invoice.
                    </Typography>
                  )}
                </>
              )}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow('Total', `${currencySym()}${totalWithRestaurant.toFixed(2)}`, { bold: true })}
              {moneyRow('Paid', `- ${currencySym()}${(booking.paidAmount || 0).toFixed(2)}`, { color: 'success.main' })}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow(
                'Balance due',
                `${currencySym()}${remainingWithRestaurant.toFixed(2)}`,
                { bold: true, color: balanceDue ? 'error.main' : 'success.main' },
              )}
            </Box>
          </Grid>

          {/* Payment */}
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>Checkout details</Typography>

              <Stack spacing={2} sx={{ mb: 2.5 }}>
                <AppDatePicker
                  label="Checkout date"
                  value={checkoutDate}
                  onChange={(newDate) => {
                    setCheckoutDate(newDate);
                    setCheckoutTime(format(new Date(), 'HH:mm'));
                    if (booking && newDate) calculateNights(newDate);
                  }}
                />
                <AppTimePicker
                  label="Checkout time"
                  value={checkoutTime || ''}
                  onChange={(newTime) => setCheckoutTime(newTime)}
                />
                <Box>
                  <TextField
                    label="Room tariff / night"
                    type="number"
                    fullWidth
                    value={tariffInput}
                    onChange={(e) => setTariffInput(e.target.value)}
                    placeholder={listTariff ? listTariff.toFixed(2) : '0'}
                    helperText={
                      tariffNegotiated
                        ? `Billing ${currencySym()}${baseTariff.toFixed(2)} + GST = ${currencySym()}${round2(baseTariff * (1 + roomGstFrac)).toFixed(2)}/night · list ${currencySym()}${listTariff.toFixed(2)}`
                        : `Leave blank for the list rate (${currencySym()}${listTariff.toFixed(2)} + GST = ${currencySym()}${round2(listTariff * (1 + roomGstFrac)).toFixed(2)}/night).`
                    }
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment>,
                      },
                      htmlInput: { min: 0, step: 50 },
                    }}
                  />
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={tariffMode}
                    onChange={(e, next) => next && setTariffMode(next)}
                    sx={{ mt: 1 }}
                  >
                    <ToggleButton value="exclusive" sx={{ textTransform: 'none', fontSize: 12, px: 1.5 }}>
                      + GST on top
                    </ToggleButton>
                    <ToggleButton value="inclusive" sx={{ textTransform: 'none', fontSize: 12, px: 1.5 }}>
                      GST included
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <TextField
                  label="Late checkout charge"
                  type="number"
                  fullWidth
                  value={lateCheckoutCharge}
                  onChange={(e) => setLateCheckoutCharge(e.target.value)}
                  placeholder="0"
                  helperText="Optional — added to the total only if you enter an amount."
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment>,
                    },
                    htmlInput: { min: 0, step: 50 },
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
                helperText={balanceDue ? ' ' : 'Bill is settled — nothing left to collect.'}
                sx={{ mb: paymentMethod !== 'Cash' ? 2 : 0 }}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment>,
                  },
                  htmlInput: { min: 0, step: 50 },
                }}
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
          disabled={!canComplete}
          sx={primaryButtonSx}
        >
          Complete checkout
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CheckoutDialog;
