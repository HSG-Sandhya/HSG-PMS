import { useState } from 'react';
import { Box, Typography, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  CleaningServices as CleaningIcon,
  Add as AddIcon,
  KeyboardArrowDown,
  AssignmentInd,
  Assessment,
  AccessTime,
  Groups,
  MeetingRoom,
  BuildOutlined,
  FactCheckOutlined,
  AutoAwesome,
  CleaningServicesOutlined,
} from '@mui/icons-material';
import { HK, glassCard, textPrimary, textSecondary, currentShift } from './hkConstants';

const InfoChip = ({ icon, children, isDark, color = HK.primary }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.75,
    px: 1.25, py: 0.6, borderRadius: '999px',
    background: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.06)'}`,
    fontSize: 12.5, fontWeight: 600, color: textPrimary(isDark), whiteSpace: 'nowrap',
  }}>
    <Box sx={{ display: 'grid', placeItems: 'center', color }}>{icon}</Box>
    {children}
  </Box>
);

/**
 * Compact, professional dashboard header: brand + title, live shift / staffing
 * context, and the primary action cluster (Create Task menu, Assign Room, View
 * Reports).
 */
const HkHeader = ({
  isDark = false,
  staffAvailable = 0,
  roomsOccupied = 0,
  totalRooms = 0,
  onCreate,
  onAssignRoom,
  onViewReports,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const closeMenu = () => setAnchorEl(null);
  const pick = (preset) => { closeMenu(); onCreate?.(preset); };

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

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
      {/* Brand + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: '14px', flexShrink: 0,
          display: 'grid', placeItems: 'center', color: '#fff',
          background: `linear-gradient(135deg, ${HK.primary}, #0f6fc0)`,
          boxShadow: `0 10px 22px -10px ${HK.primary}`,
        }}>
          <CleaningIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: { xs: 20, md: 23 }, fontWeight: 800, color: 'var(--app-primary)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            Housekeeping Management
          </Typography>
          <Typography sx={{ fontSize: 13, color: textSecondary(isDark), mb: 1 }}>
            Manage room cleaning, inspections, maintenance requests and staff assignments
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <InfoChip icon={<AccessTime sx={{ fontSize: 15 }} />} isDark={isDark}>
              {currentShift()} · {today}
            </InfoChip>
            <InfoChip icon={<Groups sx={{ fontSize: 15 }} />} isDark={isDark} color={HK.success}>
              {staffAvailable} Staff Available
            </InfoChip>
            <InfoChip icon={<MeetingRoom sx={{ fontSize: 15 }} />} isDark={isDark} color={HK.indigo}>
              {roomsOccupied}{totalRooms ? `/${totalRooms}` : ''} Rooms Occupied
            </InfoChip>
          </Box>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          endIcon={<KeyboardArrowDown />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2,
            background: `linear-gradient(135deg, ${HK.primary}, #0f6fc0)`,
            boxShadow: `0 10px 22px -10px ${HK.primary}`,
            '&:hover': { background: `linear-gradient(135deg, #1c9bf5, ${HK.primary})` },
          }}
        >
          Create Task
        </Button>
        <Button
          variant="outlined"
          startIcon={<AssignmentInd />}
          onClick={onAssignRoom}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px',
            color: textPrimary(isDark),
            borderColor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.15)',
            '&:hover': { borderColor: HK.primary, color: HK.primary },
          }}
        >
          Assign Room
        </Button>
        <Button
          variant="outlined"
          startIcon={<Assessment />}
          onClick={onViewReports}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px',
            color: textPrimary(isDark),
            borderColor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.15)',
            '&:hover': { borderColor: HK.primary, color: HK.primary },
          }}
        >
          View Reports
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { borderRadius: '14px', minWidth: 240, mt: 1, backgroundColor: isDark ? '#1e293b' : '#fff' } } }}
        >
          <MenuItem onClick={() => pick('Regular Cleaning')}>
            <ListItemIcon><CleaningServicesOutlined fontSize="small" sx={{ color: HK.info }} /></ListItemIcon>
            <ListItemText>Assign Cleaning Task</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => pick('Maintenance')}>
            <ListItemIcon><BuildOutlined fontSize="small" sx={{ color: HK.warning }} /></ListItemIcon>
            <ListItemText>Add Maintenance Request</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => pick('Inspection')}>
            <ListItemIcon><FactCheckOutlined fontSize="small" sx={{ color: HK.purple }} /></ListItemIcon>
            <ListItemText>Schedule Inspection</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => pick('Deep Cleaning')}>
            <ListItemIcon><AutoAwesome fontSize="small" sx={{ color: HK.success }} /></ListItemIcon>
            <ListItemText>Create Deep Cleaning</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => pick(null)}>
            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Blank Task…</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default HkHeader;
