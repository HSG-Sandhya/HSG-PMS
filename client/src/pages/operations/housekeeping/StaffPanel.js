import { Box, Typography, Avatar, LinearProgress, Skeleton } from '@mui/material';
import { Groups, AccessTime } from '@mui/icons-material';
import { HK, glassCard, textPrimary, textSecondary, initials, currentShift } from './hkConstants';

/**
 * Staff assignment panel. `staff` rows are pre-computed by the parent:
 * { _id, name, role, assigned, completed }. A workload bar shows each member's
 * assigned load relative to the busiest person.
 */
const StaffPanel = ({ staff = [], isDark = false, loading = false }) => {
  const maxLoad = Math.max(1, ...staff.map((s) => s.assigned || 0));
  const shift = currentShift();

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Groups sx={{ color: 'var(--app-primary)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Available Staff</Typography>
        <Box sx={{ ml: 'auto', px: 1, py: 0.25, borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#059669', fontSize: 12.5, fontWeight: 800 }}>
          {staff.length}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: textSecondary(isDark), mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTime sx={{ fontSize: 14 }} /> {shift}
      </Typography>

      {loading ? (
        <Box>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1, borderRadius: 2 }} />
          ))}
        </Box>
      ) : staff.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 4, textAlign: 'center' }}>
          <Box>
            <Groups sx={{ fontSize: 44, color: textSecondary(isDark), opacity: 0.5 }} />
            <Typography sx={{ mt: 1, color: textSecondary(isDark), fontWeight: 600 }}>No staff on shift</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 460, pr: 0.5, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
          {staff.map((s) => (
            <Box
              key={s._id}
              sx={{
                p: 1.25, borderRadius: '12px',
                background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.05)'}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 24px -14px rgba(15,23,42,0.35)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Avatar sx={{ width: 40, height: 40, fontSize: 14, fontWeight: 800, bgcolor: 'var(--app-primary)' }}>
                  {initials(s.name)}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary(isDark), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.role || 'Housekeeping'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: HK.primary, lineHeight: 1 }}>{s.assigned}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: textSecondary(isDark) }}>assigned</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.round(((s.assigned || 0) / maxLoad) * 100)}
                  sx={{
                    flex: 1, height: 6, borderRadius: 3,
                    backgroundColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)',
                    '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: HK.primary },
                  }}
                />
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                  {s.completed} done
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default StaffPanel;
