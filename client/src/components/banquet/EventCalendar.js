import { useState, useMemo } from 'react';
import { Box, Typography, IconButton, Chip, Stack, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CelebrationIcon from '@mui/icons-material/Celebration';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const STATUS_COLOR = {
  Confirmed: '#10B981',
  Pending: '#F59E0B',
  Completed: '#3B82F6',
  Cancelled: '#9CA3AF',
};

/**
 * Month-grid event calendar for banquet bookings.
 * Props:
 *   bookings   — array of BanquetBooking (with eventDate, status, etc.)
 *   month,year — controlled current month (1-12) + year
 *   onPrev,onNext — month navigation
 *   onSelectDate(dateStr) — clicking an empty day (e.g. to start a booking)
 *   onSelectBooking(booking) — clicking an event chip
 */
const EventCalendar = ({ bookings = [], month, year, onPrev, onNext, onSelectDate, onSelectBooking }) => {
  const [hoverDay, setHoverDay] = useState(null);

  // Group bookings by their event day (spanning multi-day events across days).
  const byDay = useMemo(() => {
    const map = {};
    (Array.isArray(bookings) ? bookings : []).forEach((b) => {
      if (!b.eventDate) return;
      const start = new Date(b.eventDate);
      const end = b.endDate ? new Date(b.endDate) : start;
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const stop = new Date(end);
      stop.setHours(0, 0, 0, 0);
      // cap multi-day spans to ~10 days to avoid runaway loops on bad data
      let guard = 0;
      while (cur <= stop && guard < 32) {
        const key = ymd(cur);
        (map[key] = map[key] || []).push(b);
        cur.setDate(cur.getDate() + 1);
        guard += 1;
      }
    });
    return map;
  }, [bookings]);

  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = ymd(new Date());

  // Build the 6x7 grid of cells (leading blanks + days).
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Box>
      {/* Month nav */}
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2
        }}>
        <IconButton onClick={onPrev} sx={{ color: 'var(--app-primary)' }}><ChevronLeftIcon /></IconButton>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            color: 'var(--app-primary)'
          }}>
          {MONTHS[month - 1]} {year}
        </Typography>
        <IconButton onClick={onNext} sx={{ color: 'var(--app-primary)' }}><ChevronRightIcon /></IconButton>
      </Stack>
      {/* Weekday header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {WEEKDAYS.map((w) => (
          <Typography key={w} variant="caption" align="center"
            sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase' }}>
            {w}
          </Typography>
        ))}
      </Box>
      {/* Day grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (day === null) return <Box key={`b-${idx}`} sx={{ minHeight: 96 }} />;
          const key = ymd(new Date(year, month - 1, day));
          const events = byDay[key] || [];
          const isToday = key === todayKey;
          return (
            <Box
              key={key}
              onMouseEnter={() => setHoverDay(key)}
              onMouseLeave={() => setHoverDay(null)}
              onClick={() => events.length === 0 && onSelectDate?.(key)}
              sx={{
                minHeight: 96, p: 1, borderRadius: 2.5, cursor: events.length === 0 ? 'pointer' : 'default',
                border: '1px solid',
                borderColor: isToday ? 'var(--app-primary)' : 'divider',
                background: isToday
                  ? 'rgba(var(--app-primary-rgb,99,102,241),0.08)'
                  : (hoverDay === key
                      ? 'rgba(var(--app-primary-rgb,99,102,241),0.05)'
                      : 'rgba(255,255,255,var(--app-surface-alpha,0.03))'),
                transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.18s ease, box-shadow 0.2s ease',
                display: 'flex', flexDirection: 'column', gap: 0.5,
                '&:hover': {
                  borderColor: 'var(--app-primary)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 10px 24px -12px rgba(var(--app-primary-rgb,99,102,241),0.5)',
                },
              }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: isToday ? 800 : 600,
                    color: isToday ? 'var(--app-primary)' : 'text.primary'
                  }}>
                  {day}
                </Typography>
                {events.length > 0 && (
                  <Chip size="small" label={events.length}
                    sx={{ height: 16, fontSize: 10, fontWeight: 700,
                      background: 'rgba(var(--app-primary-rgb,99,102,241),0.14)', color: 'var(--app-primary)' }} />
                )}
              </Stack>
              <Stack spacing={0.4} sx={{ overflow: 'hidden' }}>
                {events.slice(0, 3).map((ev) => (
                  <Tooltip key={ev._id} title={`${ev.customerName} · ${ev.eventType} · ${ev.startTime || ''}`}>
                    <Box
                      onClick={(e) => { e.stopPropagation(); onSelectBooking?.(ev); }}
                      sx={{
                        cursor: 'pointer', px: 0.75, py: 0.25, borderRadius: 1,
                        fontSize: 10.5, fontWeight: 700, color: '#fff',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        background: STATUS_COLOR[ev.status] || '#6366F1',
                        '&:hover': { filter: 'brightness(1.08)' },
                      }}
                    >
                      {ev.eventName || ev.eventType} · {ev.customerName?.split(' ')[0]}
                    </Box>
                  </Tooltip>
                ))}
                {events.length > 3 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', pl: 0.5 }}>
                    +{events.length - 3} more
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
      {/* Legend */}
      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLOR).map(([label, color]) => (
          <Stack key={label} direction="row" spacing={0.75} sx={{
            alignItems: "center"
          }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>{label}</Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={0.75} sx={{
          alignItems: "center"
        }}>
          <CelebrationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>Click a free day to book</Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

export default EventCalendar;
