import { Box, Typography, Skeleton } from '@mui/material';
import { EventOutlined, PeopleAltOutlined, PlaceOutlined } from '@mui/icons-material';
import {
  glassCard, textPrimary, textSecondary, eventColor, STATUS_META, PAYMENT_META,
  hallLabel, eventStart, startOfDay, isSameDay,
} from './banquetDash';

const Pill = ({ label, color }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.4,
    px: 0.85, py: 0.25, borderRadius: '999px',
    background: `${color}1f`, color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
  }}>
    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
    {label}
  </Box>
);

const bucketOf = (d) => {
  if (!d) return 'Later';
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  if (d < weekEnd) return 'This Week';
  return 'Later';
};

const ORDER = ['Today', 'Tomorrow', 'This Week', 'Later'];

/**
 * Upcoming events timeline — active bookings from today onward, grouped by
 * Today / Tomorrow / This Week / Later.
 */
const UpcomingEvents = ({ bookings = [], halls = [], isDark = false, loading = false, onSelect }) => {
  const now = startOfDay(new Date());
  const items = bookings
    .filter((b) => b.status !== 'Cancelled')
    .map((b) => ({ b, start: eventStart(b) }))
    .filter((x) => x.start && startOfDay(x.start) >= now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 14);

  const groups = ORDER
    .map((g) => ({ g, rows: items.filter((x) => bucketOf(x.start) === g) }))
    .filter((x) => x.rows.length);

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <EventOutlined sx={{ color: 'var(--app-primary)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Upcoming Events</Typography>
      </Box>

      {loading ? (
        <Box>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={70} sx={{ mb: 1, borderRadius: 2 }} />)}</Box>
      ) : groups.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 5, textAlign: 'center' }}>
          <Box>
            <EventOutlined sx={{ fontSize: 46, color: textSecondary(isDark), opacity: 0.5 }} />
            <Typography sx={{ mt: 1, color: textSecondary(isDark), fontWeight: 600 }}>No upcoming events</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ overflowY: 'auto', maxHeight: 520, pr: 0.5, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
          {groups.map(({ g, rows }) => (
            <Box key={g} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--app-primary)', mb: 1 }}>
                {g}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {rows.map(({ b, start }) => {
                  const color = eventColor(b.eventType);
                  const title = b.eventName || b.eventTitle || b.eventType || 'Event';
                  const time = b.startTime ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : start.toLocaleDateString();
                  return (
                    <Box
                      key={b._id}
                      onClick={() => onSelect?.(b)}
                      sx={{
                        display: 'flex', gap: 1.5, p: 1.25, borderRadius: '12px', cursor: onSelect ? 'pointer' : 'default',
                        background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.6)',
                        border: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.05)'}`,
                        borderLeft: `4px solid ${color}`,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': { transform: 'translateX(3px)', boxShadow: `0 12px 24px -14px ${color}` },
                      }}
                    >
                      <Box sx={{ minWidth: 66, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1.1 }}>{time}</Typography>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: textSecondary(isDark), textTransform: 'uppercase' }}>{b.eventType}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary(isDark), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
                          <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark), display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                            <PlaceOutlined sx={{ fontSize: 14 }} /> {hallLabel(b, halls)}
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark), display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                            <PeopleAltOutlined sx={{ fontSize: 14 }} /> {b.guestCount || 0} guests
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                          <Pill label={b.status} color={(STATUS_META[b.status] || {}).color || '#64748b'} />
                          <Pill label={b.paymentStatus || 'Pending'} color={(PAYMENT_META[b.paymentStatus] || {}).color || '#64748b'} />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default UpcomingEvents;
