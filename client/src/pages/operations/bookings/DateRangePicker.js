import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import {
  format, parseISO, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth,
  isWithinInterval, subDays, isValid,
} from 'date-fns';
import { EASE_OUT } from './constants';

const toISO = (d) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromISO = (s) => {
  if (!s) return null;
  const d = typeof s === 'string' ? parseISO(s) : s;
  return isValid(d) ? d : null;
};
const pretty = (d) => format(d, 'd MMM');

/**
 * Modern range calendar for the bookings filter bar. A compact trigger opens a
 * popover with quick presets, month navigation and click-to-pick range
 * selection (start → end) with a highlighted span. Emits ISO yyyy-MM-dd strings.
 */
const DateRangePicker = ({ from, to, onChange, darkMode = false, label = 'Dates' }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromISO(from) || new Date());
  const [start, setStart] = useState(() => fromISO(from));
  const [end, setEnd] = useState(() => fromISO(to));
  const [hoverDay, setHoverDay] = useState(null);
  const rootRef = useRef(null);

  // Keep internal selection in sync when the parent resets (e.g. Clear button).
  useEffect(() => { setStart(fromISO(from)); setEnd(fromISO(to)); }, [from, to]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const surface = darkMode ? 'rgba(24, 28, 38, 0.98)' : 'rgba(255, 255, 255, 0.99)';
  const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)';
  const textPrimary = darkMode ? '#f3f4f6' : '#1e293b';
  const textMeta = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const triggerBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const triggerBgOpen = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.10)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.06)';
  const rangeBg = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.16)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.10)';

  const hasValue = !!(start || end);
  const triggerText = (() => {
    if (start && end) return `${pretty(start)} – ${pretty(end)}`;
    if (start) return `${pretty(start)} – …`;
    return 'All dates';
  })();

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(view), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(view), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [view]);

  // The end used for highlighting while the user hovers to pick the second date.
  const previewEnd = end || (start && hoverDay && hoverDay > start ? hoverDay : null);

  const commit = (s, e) => {
    setStart(s); setEnd(e);
    onChange({ from: toISO(s), to: toISO(e || s) });
  };

  const pickDay = (day) => {
    if (!start || (start && end)) { setStart(day); setEnd(null); return; }
    if (day < start) { setStart(day); setEnd(null); return; }
    commit(start, day);
  };

  const applyPreset = (key) => {
    const today = new Date();
    let s = null; let e = null;
    if (key === 'today') { s = today; e = today; }
    else if (key === '7d') { s = subDays(today, 6); e = today; }
    else if (key === 'month') { s = startOfMonth(today); e = endOfMonth(today); }
    else if (key === 'lastMonth') { const m = subMonths(today, 1); s = startOfMonth(m); e = endOfMonth(m); }
    else if (key === 'all') { commit(null, null); setView(today); return; }
    setView(s);
    commit(s, e);
  };

  const clearAll = () => { setStart(null); setEnd(null); onChange({ from: '', to: '' }); };

  const presets = [
    ['today', 'Today'], ['7d', 'Last 7 days'], ['month', 'This month'],
    ['lastMonth', 'Last month'], ['all', 'All time'],
  ];

  return (
    <Box ref={rootRef} sx={{ position: 'relative', minWidth: 180 }}>
      <Typography component="label" sx={{
        position: 'absolute', top: -8, left: 12, px: 0.75,
        background: surface, color: 'var(--app-primary)',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        zIndex: 1, borderRadius: '4px',
      }}>{label}</Typography>

      <Box
        component="button" type="button" onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open}
        sx={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 1.25,
          px: 1.75, py: 1.25, cursor: 'pointer', font: 'inherit', textAlign: 'left',
          background: open ? triggerBgOpen : triggerBg,
          border: `1.5px solid ${open ? 'var(--app-primary)' : border}`,
          borderRadius: '10px', color: textPrimary,
          transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
          boxShadow: open ? '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.14)' : '0 1px 2px rgba(15,23,42,0.04)',
          '&:hover': { borderColor: 'var(--app-primary)' },
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--app-primary)', flexShrink: 0 }}>
          <CalendarMonthIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2, color: hasValue ? textPrimary : textMeta,
                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {triggerText}
          </Box>
          <Box sx={{ mt: 0.25, fontSize: 11, color: textMeta, letterSpacing: '0.04em' }}>By stay dates</Box>
        </Box>
        {hasValue && (
          <Box
            component="span" role="button" aria-label="Clear dates"
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
            sx={{
              width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', flexShrink: 0,
              background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)', color: textPrimary,
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { background: 'var(--app-primary)', color: '#fff' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
      </Box>

      <AnimatePresence>
        {open && (
          <Box
            component={motion.div} role="dialog"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            sx={{
              position: 'absolute', left: 0, top: 'calc(100% + 8px)', zIndex: 1300,
              width: 300, p: 1.5, background: surface,
              border: `1px solid ${border}`, borderRadius: '14px',
              boxShadow: darkMode
                ? '0 24px 60px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--app-primary-rgb, 99,102,241), 0.18)'
                : '0 24px 60px -16px rgba(15,23,42,0.22), 0 0 0 1px rgba(var(--app-primary-rgb, 99,102,241), 0.14)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              transformOrigin: 'top center',
            }}
          >
            {/* Presets */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              {presets.map(([key, lbl]) => (
                <Box
                  key={key} component="button" type="button" onClick={() => applyPreset(key)}
                  sx={{
                    all: 'unset', cursor: 'pointer',
                    px: 1.25, py: 0.5, borderRadius: '999px',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    color: textPrimary, border: `1px solid ${border}`,
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: 'var(--app-primary)', color: 'var(--app-primary)', background: triggerBgOpen },
                  }}
                >{lbl}</Box>
              ))}
            </Box>

            {/* Month nav */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box component="button" type="button" onClick={() => setView((v) => subMonths(v, 1))}
                   sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', p: 0.5, borderRadius: '8px', color: 'var(--app-primary)', '&:hover': { background: triggerBgOpen } }}>
                <ChevronLeftIcon fontSize="small" />
              </Box>
              <Box sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: textPrimary }}>
                {format(view, 'MMMM yyyy')}
              </Box>
              <Box component="button" type="button" onClick={() => setView((v) => addMonths(v, 1))}
                   sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', p: 0.5, borderRadius: '8px', color: 'var(--app-primary)', '&:hover': { background: triggerBgOpen } }}>
                <ChevronRightIcon fontSize="small" />
              </Box>
            </Box>

            {/* Weekday header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Box key={i} sx={{ textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: textMeta, py: 0.5 }}>{d}</Box>
              ))}
            </Box>

            {/* Day grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '2px' }} onMouseLeave={() => setHoverDay(null)}>
              {days.map((day) => {
                const inMonth = isSameMonth(day, view);
                const isStart = start && isSameDay(day, start);
                const isEnd = previewEnd && isSameDay(day, previewEnd);
                const inRange = start && previewEnd && isWithinInterval(day, {
                  start: start < previewEnd ? start : previewEnd,
                  end: start < previewEnd ? previewEnd : start,
                });
                const isEdge = isStart || isEnd;
                return (
                  <Box
                    key={day.toISOString()} component="button" type="button"
                    onClick={() => pickDay(day)} onMouseEnter={() => setHoverDay(day)}
                    sx={{
                      all: 'unset', cursor: 'pointer', position: 'relative',
                      height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      // soft range band behind the cells
                      background: inRange && !isEdge ? rangeBg : 'transparent',
                      borderTopLeftRadius: isStart || !inRange ? '8px' : 0,
                      borderBottomLeftRadius: isStart || !inRange ? '8px' : 0,
                      borderTopRightRadius: isEnd || !inRange ? '8px' : 0,
                      borderBottomRightRadius: isEnd || !inRange ? '8px' : 0,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Box sx={{
                      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', fontSize: 13, fontWeight: isEdge ? 800 : 600,
                      color: isEdge ? '#fff' : (inMonth ? textPrimary : textMeta),
                      background: isEdge ? 'var(--app-primary)' : 'transparent',
                      boxShadow: isEdge ? '0 6px 14px -6px rgba(var(--app-primary-rgb, 99,102,241), 0.8)' : 'none',
                      opacity: inMonth ? 1 : 0.4,
                      transition: 'background 0.15s ease, color 0.15s ease',
                      '&:hover': { background: isEdge ? 'var(--app-primary)' : triggerBgOpen },
                    }}>
                      {format(day, 'd')}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Footer */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.25, pt: 1, borderTop: `1px solid ${border}` }}>
              <Box component="button" type="button" onClick={clearAll}
                   sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: textMeta, '&:hover': { color: 'var(--app-primary)' } }}>
                Clear
              </Box>
              <Box component="button" type="button" onClick={() => setOpen(false)}
                   sx={{ all: 'unset', cursor: 'pointer', px: 2, py: 0.75, borderRadius: '999px',
                          fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: '#fff', background: 'var(--app-primary)',
                          boxShadow: '0 8px 18px -8px rgba(var(--app-primary-rgb, 99,102,241), 0.7)' }}>
                Done
              </Box>
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default DateRangePicker;
