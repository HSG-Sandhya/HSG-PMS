import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Box,
  Avatar,
  Chip,
  Stack,
  Tooltip,
  useTheme,
} from '@mui/material';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import EmailIcon from '@mui/icons-material/EmailOutlined';
import PhoneIcon from '@mui/icons-material/PhoneOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import RoomIcon from '@mui/icons-material/MeetingRoom';
import PaymentIcon from '@mui/icons-material/PaymentOutlined';
import SourceIcon from '@mui/icons-material/Public';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  labelSx,
  valueSx,
  actionsBarSx,
  secondaryButtonSx,
} from './formStyles';
import { useBilling, useCurrency } from '../../hooks/useBilling';

const safeParse = (input) => {
  if (!input) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'string') {
    const parsed = parseISO(input);
    return isValid(parsed) ? parsed : null;
  }
  return null;
};

const StatusPill = ({ status }) => {
  if (!status || status === '-') return <Typography variant="body2" color="text.secondary">—</Typography>;
  const positive = ['paid', 'completed', 'confirmed', 'checked-in', 'checked in'];
  const warning = ['pending', 'partial', 'reserved'];
  const value = String(status).toLowerCase();
  const color = positive.includes(value) ? 'success' : warning.includes(value) ? 'warning' : 'default';
  return (
    <Chip
      label={String(status)}
      color={color}
      size="small"
      sx={{ fontWeight: 600, borderRadius: 999, textTransform: 'capitalize' }}
    />
  );
};

const Row = ({ icon, label, children, isDarkMode }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.25 }}>
    {icon && <Box sx={{ mt: '2px', color: 'primary.main', opacity: 0.7 }}>{icon}</Box>}
    <Box sx={{ flex: 1 }}>
      <Typography sx={labelSx(isDarkMode)}>{label}</Typography>
      <Box sx={{ mt: 0.25 }}>
        {typeof children === 'string' || typeof children === 'number' ? (
          <Typography sx={valueSx(isDarkMode)}>{children || '—'}</Typography>
        ) : (
          children
        )}
      </Box>
    </Box>
  </Box>
);

const BookingDetailsDialog = ({ open, onClose, booking }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const billing = useBilling();
  const fmt = useCurrency();

  if (!booking) return null;

  const checkInDate = safeParse(booking.checkIn);
  const checkOutDate = safeParse(booking.checkOut);
  const createdAt = safeParse(booking.createdAt);
  const updatedAt = safeParse(booking.updatedAt);

  const guest = booking.guestInfo || booking;
  const nights =
    checkInDate && checkOutDate ? differenceInCalendarDays(checkOutDate, checkInDate) : null;
  const idCardImage = booking.idCardImage || booking.idCardUrl;
  // Bookings store adults/children, not numGuests/guestsCount — derive a summary
  // from those (falling back to the legacy fields just in case).
  const adults = Number(booking.adults) || 0;
  const children = Number(booking.children) || 0;
  const numGuests = adults || children
    ? `${adults || 1} adult${(adults || 1) > 1 ? 's' : ''}${children ? ` · ${children} child${children > 1 ? 'ren' : ''}` : ''}`
    : (booking.numGuests || booking.guestsCount || '—');
  const specialRequests = booking.specialRequests || booking.notes || '—';
  const roomPrice = booking.roomId?.price || booking.roomPrice;
  const discount = booking.discount || booking.payment?.discount || 0;
  const paymentMethod = booking.payment?.method || booking.paymentMethod || '—';
  const bookingSource = booking.source || '—';
  const fullName = `${guest.firstName || guest.guestName || 'Guest'} ${guest.lastName || ''}`.trim();
  const initials = (guest.firstName || guest.guestName || '?').charAt(0).toUpperCase();
  const address = [guest.streetName || booking.streetName, guest.area || booking.area, guest.district || booking.district, guest.state || booking.state, guest.pincode || booking.pincode]
    .filter(Boolean)
    .join(', ');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: dialogPaperSx(isDarkMode) }}
      BackdropProps={{ sx: dialogBackdropSx }}
    >
      {/* Header */}
      <Box sx={headerWrapSx(isDarkMode)}>
        <Stack direction="row" alignItems="center" spacing={2.5}>
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
            {initials || <PersonIcon />}
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
              {fullName}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              Guest ID · {booking.customerId || '—'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <StatusPill status={booking.bookingStatus || booking.status} />
            <StatusPill status={booking.payment?.status || booking.paymentStatus} />
          </Stack>
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
        <Grid container spacing={2.5}>
          {/* Guest */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>
                <PersonIcon fontSize="inherit" />
                Guest Information
              </Typography>
              <Row icon={<PhoneIcon fontSize="small" />} label="Phone" isDarkMode={isDarkMode}>
                {guest.phone || booking.phone || '—'}
              </Row>
              <Row icon={<EmailIcon fontSize="small" />} label="Email" isDarkMode={isDarkMode}>
                {guest.email || booking.email || '—'}
              </Row>
              <Row icon={<HomeIcon fontSize="small" />} label="Address" isDarkMode={isDarkMode}>
                {address || '—'}
              </Row>
              <Row icon={<EventNoteIcon fontSize="small" />} label="Special Requests" isDarkMode={isDarkMode}>
                {specialRequests}
              </Row>
              <Row icon={<ImageIcon fontSize="small" />} label="ID Card" isDarkMode={isDarkMode}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography sx={valueSx(isDarkMode)}>
                    {booking.idCardType || '—'} {booking.idCardNumber ? `· ${booking.idCardNumber}` : ''}
                  </Typography>
                  {idCardImage && (
                    <Tooltip title="View ID card">
                      <Box
                        component="img"
                        src={idCardImage}
                        alt="ID card"
                        sx={{
                          width: 44,
                          height: 28,
                          objectFit: 'cover',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: isDarkMode ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.15)',
                        }}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </Row>
            </Box>
          </Grid>

          {/* Booking */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>
                <RoomIcon fontSize="inherit" />
                Booking Information
              </Typography>
              <Row icon={<RoomIcon fontSize="small" />} label="Room" isDarkMode={isDarkMode}>
                {`${booking.roomId?.roomNumber || booking.roomNumber || '—'}${booking.roomId?.type || booking.roomType ? ` · ${booking.roomId?.type || booking.roomType}` : ''}`}
              </Row>
              <Row label="Rate" isDarkMode={isDarkMode}>
                {roomPrice != null ? fmt(roomPrice) : '—'}
              </Row>
              <Row label="Guests" isDarkMode={isDarkMode}>
                {numGuests}
              </Row>
              <Row label="Stay duration" isDarkMode={isDarkMode}>
                {nights == null ? '—' : `${nights} night${nights === 1 ? '' : 's'}`}
              </Row>
              <Row label="Check-in" isDarkMode={isDarkMode}>
                {checkInDate
                  ? `${format(checkInDate, 'dd MMM yyyy')} · ${booking.checkInTime || billing.defaultCheckInTime}`
                  : '—'}
              </Row>
              <Row label="Check-out" isDarkMode={isDarkMode}>
                {checkOutDate
                  ? `${format(checkOutDate, 'dd MMM yyyy')} · ${booking.checkOutTime || billing.defaultCheckOutTime}`
                  : '—'}
              </Row>
              <Row icon={<PaymentIcon fontSize="small" />} label="Payment" isDarkMode={isDarkMode}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Typography sx={valueSx(isDarkMode)}>
                    Total {fmt(booking.payment?.totalAmount || booking.totalAmount || 0)}
                  </Typography>
                  <Typography sx={{ ...valueSx(isDarkMode), color: 'success.main' }}>
                    Paid {fmt(booking.payment?.paidAmount || booking.paidAmount || 0)}
                  </Typography>
                  {discount ? (
                    <Typography sx={{ ...valueSx(isDarkMode), color: 'warning.main' }}>
                      Discount {fmt(discount)}
                    </Typography>
                  ) : null}
                </Stack>
              </Row>
              <Row label="Payment method" isDarkMode={isDarkMode}>
                {paymentMethod}
              </Row>
              <Row icon={<SourceIcon fontSize="small" />} label="Source" isDarkMode={isDarkMode}>
                {bookingSource}
              </Row>
            </Box>
          </Grid>

          {/* Audit */}
          <Grid item xs={12}>
            <Box
              sx={{
                ...sectionCardSx(isDarkMode),
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={labelSx(isDarkMode)}>
                Created · {createdAt ? format(createdAt, 'dd MMM yyyy · HH:mm') : '—'}
              </Typography>
              <Typography variant="caption" sx={labelSx(isDarkMode)}>
                Last updated · {updatedAt ? format(updatedAt, 'dd MMM yyyy · HH:mm') : '—'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={actionsBarSx(isDarkMode)}>
        <Button onClick={onClose} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BookingDetailsDialog;
