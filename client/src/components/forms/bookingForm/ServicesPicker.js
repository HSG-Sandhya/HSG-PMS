// Toggleable service-preference chips (non-priced). Selections persist to
// Booking.additionalServices so housekeeping/F&B can prep ahead of arrival.
import { Box, Stack, Typography } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CelebrationIcon from '@mui/icons-material/Celebration';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SpaIcon from '@mui/icons-material/Spa';

const SERVICES = [
  { value: 'Restaurant', icon: <RestaurantIcon fontSize="small" /> },
  { value: 'Banquet', icon: <CelebrationIcon fontSize="small" /> },
  { value: 'Laundry', icon: <LocalLaundryServiceIcon fontSize="small" /> },
  { value: 'Pickup & Drop', icon: <AirportShuttleIcon fontSize="small" /> },
  { value: 'Room Decoration', icon: <AutoAwesomeIcon fontSize="small" /> },
  { value: 'Special Amenities', icon: <SpaIcon fontSize="small" /> },
];

const ServicesPicker = ({ value = [], onChange }) => {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
      {SERVICES.map((s) => {
        const on = selected.includes(s.value);
        return (
          <Stack
            key={s.value}
            role="button"
            direction="row"
            spacing={0.9}
            onClick={() => toggle(s.value)}
            sx={{
              alignItems: "center",
              cursor: 'pointer',
              px: 1.75,
              py: 1,
              borderRadius: '999px',
              userSelect: 'none',
              transition: 'all 0.18s ease',
              border: '1.5px solid',
              borderColor: on ? 'var(--app-primary)' : 'divider',
              color: on ? 'var(--app-primary)' : 'text.secondary',
              background: on ? 'rgba(var(--app-primary-rgb),0.10)' : 'transparent',
              fontWeight: 700,
              '&:hover': { borderColor: 'var(--app-primary)' }
            }}>
            {s.icon}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.value}</Typography>
          </Stack>
        );
      })}
    </Box>
  );
};

export default ServicesPicker;
