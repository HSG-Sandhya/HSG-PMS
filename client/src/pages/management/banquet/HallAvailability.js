import { Box, Typography, Skeleton } from '@mui/material';
import { MeetingRoom, PeopleAltOutlined } from '@mui/icons-material';
import {
  BQ, glassCard, textPrimary, textSecondary, money, isSameDay, eventStart, isActiveBooking,
} from './banquetDash';

// Today's availability for a hall, derived from active bookings on today's date.
const statusOf = (hall, bookings) => {
  if (hall.isAvailable === false) return { label: 'Maintenance', color: BQ.warning };
  const booked = bookings.some((b) => isActiveBooking(b)
    && String(b.hallId?._id || b.hallId) === String(hall._id)
    && isSameDay(eventStart(b), new Date()));
  return booked ? { label: 'Booked', color: BQ.danger } : { label: 'Available', color: BQ.success };
};

/**
 * Hall availability cards — capacity, today's status (Available / Booked /
 * Maintenance) and day rate for each banquet hall.
 */
const HallAvailability = ({ halls = [], bookings = [], isDark = false, loading = false, onSelect }) => (
  <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <MeetingRoom sx={{ color: 'var(--app-primary)' }} />
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Hall Availability</Typography>
      <Typography sx={{ ml: 'auto', fontSize: 12, color: textSecondary(isDark) }}>Today</Typography>
    </Box>

    {loading ? (
      <Box>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={92} sx={{ mb: 1.25, borderRadius: 2 }} />)}</Box>
    ) : halls.length === 0 ? (
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 5, textAlign: 'center' }}>
        <Box>
          <MeetingRoom sx={{ fontSize: 46, color: textSecondary(isDark), opacity: 0.5 }} />
          <Typography sx={{ mt: 1, color: textSecondary(isDark), fontWeight: 600 }}>No halls configured</Typography>
        </Box>
      </Box>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, overflowY: 'auto', maxHeight: 520, pr: 0.5, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
        {halls.map((hall) => {
          const s = statusOf(hall, bookings);
          return (
            <Box
              key={hall._id}
              onClick={() => onSelect?.(hall)}
              sx={{
                p: 1.5, borderRadius: '14px', cursor: onSelect ? 'pointer' : 'default',
                background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.05)'}`,
                borderTop: `3px solid ${s.color}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 26px -16px ${s.color}` },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary(isDark), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hall.name}
                </Typography>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.9, py: 0.3, borderRadius: '999px',
                  background: `${s.color}1f`, color: s.color, fontSize: 11.5, fontWeight: 800, flexShrink: 0,
                }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
                  {s.label}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
                <Typography sx={{ fontSize: 12.5, color: textSecondary(isDark), display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <PeopleAltOutlined sx={{ fontSize: 15 }} /> {hall.capacity || 0} guests
                </Typography>
                {hall.pricePerDay ? (
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: BQ.gold }}>
                    {money(hall.pricePerDay)}<span style={{ fontSize: 11, fontWeight: 600 }}>/day</span>
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>
    )}
  </Box>
);

export default HallAvailability;
