import { Box, Typography, Button } from '@mui/material';
import { Celebration, Add as AddIcon, CheckCircle } from '@mui/icons-material';
import { BQ, glassCard, textPrimary, textSecondary } from './banquetDash';

const CHECKLIST = [
  'Customer details', 'Hall allocation', 'Catering',
  'Decoration', 'Payments', 'Event timeline',
];

/**
 * Rich empty state shown when there are no bookings yet — sells the workflow
 * and drops the user straight into creating their first event.
 */
const BanquetEmptyState = ({ isDark = false, onCreate }) => (
  <Box sx={{ ...glassCard(isDark), p: { xs: 3, md: 5 }, textAlign: 'center', display: 'grid', placeItems: 'center' }}>
    <Box sx={{
      width: 88, height: 88, borderRadius: '24px', display: 'grid', placeItems: 'center', color: '#fff', mb: 2,
      background: `linear-gradient(135deg, ${BQ.primary}, ${BQ.gold})`,
      boxShadow: `0 18px 34px -14px ${BQ.primary}`,
    }}>
      <Celebration sx={{ fontSize: 46 }} />
    </Box>
    <Typography sx={{ fontSize: { xs: 20, md: 23 }, fontWeight: 800, color: textPrimary(isDark), letterSpacing: '-0.4px' }}>
      Start managing your events professionally
    </Typography>
    <Typography sx={{ fontSize: 14, color: textSecondary(isDark), mt: 0.75, maxWidth: 520 }}>
      Create your first banquet booking and manage the whole event lifecycle in one place.
    </Typography>

    <Box sx={{
      display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, auto)' },
      gap: 1.25, justifyContent: 'center', my: 3,
    }}>
      {CHECKLIST.map((item) => (
        <Box key={item} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <CheckCircle sx={{ fontSize: 18, color: BQ.success }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: textPrimary(isDark) }}>{item}</Typography>
        </Box>
      ))}
    </Box>

    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => onCreate?.()}
      sx={{
        textTransform: 'none', fontWeight: 700, borderRadius: '14px', px: 3, py: 1.25,
        background: `linear-gradient(135deg, ${BQ.primary}, #0f7fc9)`,
        boxShadow: `0 12px 26px -10px ${BQ.primary}`,
        '&:hover': { background: `linear-gradient(135deg, #1ea3f5, ${BQ.primary})` },
      }}
    >
      Create First Event
    </Button>
  </Box>
);

export default BanquetEmptyState;
