import { useState } from 'react';
import { Box, Typography, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  Celebration as CelebrationIcon,
  Add as AddIcon,
  KeyboardArrowDown,
  Event as EventIcon,
  Diversity3,
  Favorite,
  Cake,
  BusinessCenter,
  Groups2,
} from '@mui/icons-material';
import { BQ, glassCard, textPrimary, textSecondary, moneyShort } from './banquetDash';

const Stat = ({ label, value, color, isDark }) => (
  <Box sx={{
    px: 1.5, py: 0.85, borderRadius: '12px',
    background: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.05)'}`,
    minWidth: 92,
  }}>
    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: textSecondary(isDark) }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 17, fontWeight: 800, color: color || textPrimary(isDark), lineHeight: 1.2 }}>
      {value}
    </Typography>
  </Box>
);

/**
 * Premium banquet dashboard header: brand + title, live event/revenue context,
 * and the primary actions (New Booking dropdown with event presets, Calendar,
 * Reports).
 */
const BanquetHeader = ({
  isDark = false,
  todayEvents = 0,
  upcomingEvents = 0,
  monthlyRevenue = 0,
  onCreate,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const pick = (preset) => { setAnchorEl(null); onCreate?.(preset); };

  const presets = [
    { label: 'Wedding Booking', type: 'Wedding', icon: <Favorite fontSize="small" sx={{ color: BQ.gold }} /> },
    { label: 'Corporate Event', type: 'Corporate', icon: <BusinessCenter fontSize="small" sx={{ color: BQ.blue }} /> },
    { label: 'Birthday Party', type: 'Birthday', icon: <Cake fontSize="small" sx={{ color: BQ.purple }} /> },
    { label: 'Conference', type: 'Conference', icon: <Groups2 fontSize="small" sx={{ color: BQ.blue }} /> },
    { label: 'Social Event', type: 'Party', icon: <Diversity3 fontSize="small" sx={{ color: BQ.indigo }} /> },
  ];

  return (
    <Box sx={{
      ...glassCard(isDark),
      p: { xs: 2, md: 2.5 },
      display: 'flex',
      alignItems: { xs: 'flex-start', lg: 'center' },
      justifyContent: 'space-between',
      flexDirection: { xs: 'column', lg: 'row' },
      gap: 2,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        <Box sx={{
          width: 54, height: 54, borderRadius: '15px', flexShrink: 0,
          display: 'grid', placeItems: 'center', color: '#fff',
          background: `linear-gradient(135deg, ${BQ.primary}, ${BQ.gold})`,
          boxShadow: `0 12px 24px -10px ${BQ.primary}`,
        }}>
          <CelebrationIcon sx={{ fontSize: 30 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, color: 'var(--app-primary)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            Banquet &amp; Event Management
          </Typography>
          <Typography sx={{ fontSize: 13, color: textSecondary(isDark), mb: 1.25 }}>
            Manage weddings, corporate events, parties, conferences and celebrations
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Stat label="Today's Events" value={todayEvents} color={BQ.gold} isDark={isDark} />
            <Stat label="Upcoming" value={upcomingEvents} color={BQ.primary} isDark={isDark} />
            <Stat label="Monthly Revenue" value={moneyShort(monthlyRevenue)} color={BQ.success} isDark={isDark} />
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          endIcon={<KeyboardArrowDown />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2,
            background: `linear-gradient(135deg, ${BQ.primary}, #0f7fc9)`,
            boxShadow: `0 10px 22px -10px ${BQ.primary}`,
            '&:hover': { background: `linear-gradient(135deg, #1ea3f5, ${BQ.primary})` },
          }}
        >
          New Booking
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { borderRadius: '14px', minWidth: 230, mt: 1, backgroundColor: isDark ? '#1e293b' : '#fff' } } }}
        >
          <Typography sx={{ px: 2, py: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: textSecondary(isDark) }}>
            Create Event
          </Typography>
          {presets.map((p) => (
            <MenuItem key={p.type} onClick={() => pick(p.type)}>
              <ListItemIcon>{p.icon}</ListItemIcon>
              <ListItemText>{p.label}</ListItemText>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={() => pick(null)}>
            <ListItemIcon><EventIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Blank Booking…</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default BanquetHeader;
