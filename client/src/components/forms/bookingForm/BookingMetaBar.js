// The reservation "header" — a deep-navy command bar carrying the booking
// identity (ID, timestamp, assigned staff) and the two front-office classifiers
// every PMS needs up top: Booking Source and Booking Status.
import { Box, Grid, Stack, Typography, Select, MenuItem, FormControl } from '@mui/material';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { NAVY, NAVY_2 } from './premium';

const SOURCES = ['Walk-in', 'Website', 'OTA', 'Corporate', 'Travel Agent', 'Referral', 'Phone'];
// Values match the Booking.bookingStatus enum; labels are front-desk friendly.
const STATUSES = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Tentative', label: 'Tentative' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Checked-In', label: 'Checked-in' },
  { value: 'Completed', label: 'Checked-out' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const STATUS_COLOR = {
  Pending: '#f59e0b', Tentative: '#a855f7', Confirmed: '#22c55e',
  'Checked-In': '#3b82f6', Completed: '#64748b', Cancelled: '#ef4444',
};

const lightSelectSx = {
  background: 'rgba(255,255,255,0.96)',
  borderRadius: 2,
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-select': { py: 1.1, fontWeight: 700, fontSize: 14, color: NAVY },
};

const fieldLabelSx = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700, mb: 0.75 };

const BookingMetaBar = ({ formData, handleInputChange, user, isEdit, bookingId }) => {
  const now = new Date();
  const staff = user?.name || user?.username || user?.email || 'Front Desk';
  const status = formData.bookingStatus || 'Pending';

  return (
    <Box
      sx={{
        borderRadius: 3,
        p: { xs: 2.5, sm: 3 },
        color: '#fff',
        background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        boxShadow: '0 18px 40px -24px rgba(15,31,61,0.8)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* subtle gold glow */}
      <Box sx={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--app-primary-rgb),0.35), transparent 70%)' }} />
      <Grid
        container
        spacing={2.5}
        sx={{
          alignItems: "center",
          position: 'relative'
        }}>
        <Grid
          size={{
            xs: 12,
            md: 6
          }}>
          <Stack direction="row" spacing={1.5} sx={{
            alignItems: "center"
          }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(var(--app-primary-rgb),0.18)', color: 'var(--app-primary)', border: '1px solid rgba(var(--app-primary-rgb),0.3)' }}>
              <ConfirmationNumberIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--app-primary)', fontWeight: 800 }}>
                Reservation
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {bookingId || 'Auto-generated'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2.5} sx={{ mt: 1.75, flexWrap: 'wrap', gap: 1 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: "center",
                color: 'rgba(255,255,255,0.85)'
              }}>
              <ScheduleIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: "center",
                color: 'rgba(255,255,255,0.85)'
              }}>
              <PersonOutlineIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{staff}</Typography>
            </Stack>
          </Stack>
        </Grid>

        <Grid
          size={{
            xs: 6,
            md: 3
          }}>
          <Typography sx={fieldLabelSx}>Booking Source</Typography>
          <FormControl fullWidth size="small">
            <Select name="bookingSource" value={formData.bookingSource || 'Walk-in'} onChange={handleInputChange} sx={lightSelectSx}>
              {SOURCES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        <Grid
          size={{
            xs: 6,
            md: 3
          }}>
          <Typography sx={fieldLabelSx}>Status</Typography>
          <FormControl fullWidth size="small">
            <Select
              name="bookingStatus"
              value={status}
              onChange={handleInputChange}
              sx={{
                ...lightSelectSx,
                '& .MuiSelect-select': { py: 1.1, fontWeight: 800, fontSize: 14, color: STATUS_COLOR[status] || NAVY,
                  display: 'flex', alignItems: 'center', gap: 1 },
              }}
              renderValue={(v) => (
                <Stack direction="row" spacing={1} sx={{
                  alignItems: "center"
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[v] || NAVY }} />
                  {STATUSES.find((s) => s.value === v)?.label || v}
                </Stack>
              )}
            >
              {STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value} disabled={!isEdit && (s.value === 'Completed' || s.value === 'Cancelled')}>
                  <Stack direction="row" spacing={1} sx={{
                    alignItems: "center"
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s.value] }} />
                    {s.label}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BookingMetaBar;
