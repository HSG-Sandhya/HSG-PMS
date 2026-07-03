// One unified booking entry: a segmented toggle that switches the New Booking
// dialog between Individual / Group / Company forms. Rendered at the top of
// each booking dialog body so the three flows feel like a single form.
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';

const OPTIONS = [
  { value: 'individual', label: 'Individual', icon: <PersonIcon fontSize="small" />, hint: 'A single guest or walk-in reservation.' },
  { value: 'group', label: 'Group', icon: <GroupsIcon fontSize="small" />, hint: 'Block of rooms for a tour, wedding or party under one coordinator.' },
  { value: 'company', label: 'Company', icon: <BusinessIcon fontSize="small" />, hint: 'Corporate account with contract rates, credit billing & GST invoice.' },
];

const BookingTypeSelector = ({ value = 'individual', onChange, disabled = false }) => {
  const active = OPTIONS.find((o) => o.value === value);
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography sx={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, mb: 1 }}>
        Booking type
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={value}
        onChange={(e, v) => { if (v) onChange?.(v); }}
        disabled={disabled}
        sx={{
          gap: 1,
          '& .MuiToggleButton-root': {
            flex: 1,
            border: '1.5px solid',
            borderColor: 'divider',
            borderRadius: '12px !important',
            textTransform: 'none',
            fontWeight: 700,
            letterSpacing: 0,
            gap: 0.75,
            py: 1.1,
            color: 'text.secondary',
          },
          '& .MuiToggleButton-root.Mui-selected': {
            color: 'var(--app-primary)',
            borderColor: 'var(--app-primary)',
            background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.10)',
          },
          '& .MuiToggleButton-root.Mui-selected:hover': {
            background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.16)',
          },
        }}
      >
        {OPTIONS.map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.icon}{o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {active?.hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          {active.hint}
        </Typography>
      )}
    </Box>
  );
};

export default BookingTypeSelector;
