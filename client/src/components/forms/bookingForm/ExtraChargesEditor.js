// Itemised priced add-ons (extra bed, extra person, F&B, laundry, transport,
// other). Each is a rupee amount; the live sum feeds Booking.extraChargesTotal
// and the reservation total.
import { Grid, TextField, InputAdornment, Stack, Chip, Typography } from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { currencySym } from '../../../utils/billing';

export const EXTRA_FIELDS = [
  { key: 'extraBed', label: 'Extra bed', icon: <HotelIcon fontSize="small" color="action" /> },
  { key: 'extraPerson', label: 'Extra person', icon: <PersonAddAlt1Icon fontSize="small" color="action" /> },
  { key: 'foodPackage', label: 'Food package', icon: <RestaurantIcon fontSize="small" color="action" /> },
  { key: 'laundry', label: 'Laundry', icon: <LocalLaundryServiceIcon fontSize="small" color="action" /> },
  { key: 'transport', label: 'Transport', icon: <AirportShuttleIcon fontSize="small" color="action" /> },
  { key: 'other', label: 'Other services', icon: <MoreHorizIcon fontSize="small" color="action" /> },
];

export const extrasTotal = (extras = {}) =>
  EXTRA_FIELDS.reduce((s, f) => s + (Number(extras[f.key]) || 0), 0);

const ExtraChargesEditor = ({ value = {}, onChange }) => {
  const sym = currencySym();
  // Store 0 (a real number) for cleared fields — sending '' to a Number schema
  // path would trip a Mongoose CastError on save.
  const set = (key, v) => onChange({ ...value, [key]: v === '' ? 0 : Number(v) });
  const total = extrasTotal(value);

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Additional charges
        </Typography>
        <Chip size="small" label={`+ ${sym}${total.toLocaleString('en-IN')}`}
          sx={{ fontWeight: 800, color: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb),0.10)' }} />
      </Stack>
      <Grid container spacing={2}>
        {EXTRA_FIELDS.map((f) => (
          <Grid item xs={6} sm={4} key={f.key}>
            <TextField
              fullWidth size="small" type="number" label={f.label}
              value={value[f.key] ? value[f.key] : ''}
              onChange={(e) => set(f.key, e.target.value)}
              inputProps={{ min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">{f.icon}</InputAdornment> }}
            />
          </Grid>
        ))}
      </Grid>
    </>
  );
};

export default ExtraChargesEditor;
