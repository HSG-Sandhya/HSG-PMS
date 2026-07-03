import { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { EASE_OUT, STATUS_OPTIONS } from './constants';

/**
 * Editorial dropdown for the bookings status filter. MUI-native styling
 * with framer-motion entry, status dot per option, hover tint and a
 * brass check on the selected row. Closes on outside-click / Escape.
 */
export const StatusFilter = ({ value, onChange, darkMode = false, options = STATUS_OPTIONS, label = 'Status' }) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const surface = darkMode ? 'rgba(30, 35, 45, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)';
  const textPrimary = darkMode ? '#f3f4f6' : '#1e293b';
  const textMeta = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const triggerBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const triggerBgOpen = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.10)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.06)';
  const hoverBg = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const selectedBg = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.18)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.10)';

  return (
    <Box ref={rootRef} sx={{ position: 'relative', minWidth: 170, width: '100%' }}>
      <Typography
        component="label"
        sx={{
          position: 'absolute', top: -8, left: 12, px: 0.75,
          background: surface, color: 'var(--app-primary)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          zIndex: 1, borderRadius: '4px',
        }}
      >
        {label}
      </Typography>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        sx={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
          px: 1.75, py: 1.25, cursor: 'pointer',
          background: open ? triggerBgOpen : triggerBg,
          border: `1.5px solid ${open ? 'var(--app-primary)' : border}`,
          borderRadius: '10px',
          color: textPrimary,
          font: 'inherit', textAlign: 'left',
          transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
          boxShadow: open
            ? '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.14)'
            : '0 1px 2px rgba(15,23,42,0.04)',
          '&:hover': { borderColor: 'var(--app-primary)' },
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selected.dot, flexShrink: 0,
                   boxShadow: `0 0 8px ${selected.dot === 'var(--app-primary)' ? 'rgba(var(--app-primary-rgb, 99,102,241), 0.55)' : selected.dot}` }} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2, color: textPrimary,
                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.label}
          </Box>
          <Box sx={{ mt: 0.25, fontSize: 11, color: textMeta, letterSpacing: '0.04em' }}>
            {selected.hint}
          </Box>
        </Box>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          style={{ display: 'inline-flex', color: 'var(--app-primary)' }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </motion.span>
      </Box>

      <AnimatePresence>
        {open && (
          <Box
            component={motion.ul}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            sx={{
              listStyle: 'none', m: 0, p: 0.5,
              position: 'absolute', left: 0, right: 0, top: 'calc(100% + 8px)',
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: '12px',
              boxShadow: darkMode
                ? '0 24px 60px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--app-primary-rgb, 99,102,241), 0.18)'
                : '0 24px 60px -16px rgba(15,23,42,0.20), 0 0 0 1px rgba(var(--app-primary-rgb, 99,102,241), 0.14)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 1300,
              overflow: 'hidden',
              transformOrigin: 'top center',
            }}
          >
            {options.map((o, i) => {
              const isSelected = o.value === selected.value;
              const isHover = hover === o.value;
              return (
                <Box
                  component={motion.li}
                  key={o.value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04, ease: EASE_OUT }}
                  onMouseEnter={() => setHover(o.value)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  role="option"
                  aria-selected={isSelected}
                  sx={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1.1, borderRadius: '8px', cursor: 'pointer',
                    background: isSelected ? selectedBg : (isHover ? hoverBg : 'transparent'),
                    transition: 'background 0.2s ease',
                    color: textPrimary,
                  }}
                >
                  <motion.span
                    aria-hidden
                    initial={false}
                    animate={{ scaleY: (isHover || isSelected) ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    style={{
                      position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
                      background: 'var(--app-primary)', borderRadius: '0 3px 3px 0',
                      transformOrigin: 'center',
                    }}
                  />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: o.dot, flexShrink: 0,
                             boxShadow: `0 0 8px ${o.dot === 'var(--app-primary)' ? 'rgba(var(--app-primary-rgb, 99,102,241), 0.55)' : o.dot}` }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2,
                               color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.label}
                    </Box>
                    <Box sx={{ mt: 0.25, fontSize: 11, color: textMeta, letterSpacing: '0.04em' }}>
                      {o.hint}
                    </Box>
                  </Box>
                  <motion.span
                    animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.7 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    style={{ display: 'inline-flex', color: 'var(--app-primary)' }}
                  >
                    <CheckIcon fontSize="small" />
                  </motion.span>
                </Box>
              );
            })}
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
};

/**
 * Editorial search input. Shares chrome with StatusFilter so the two
 * controls feel like a matched pair on the bookings page.
 */
export const SearchField = ({
  value,
  onChange,
  darkMode = false,
  label = 'Search',
  hint = 'By guest name or room',
  placeholder = 'Type a name, room…',
}) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const surface = darkMode ? 'rgba(30, 35, 45, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)';
  const textPrimary = darkMode ? '#f3f4f6' : '#1e293b';
  const textMeta = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const triggerBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const focusBg = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.10)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.06)';
  const hasValue = value && value.length > 0;
  const active = focused || hasValue;

  return (
    <Box sx={{ position: 'relative', minWidth: 220 }}>
      <Typography
        component="label"
        onClick={() => inputRef.current?.focus()}
        sx={{
          position: 'absolute', top: -8, left: 12, px: 0.75,
          background: surface, color: 'var(--app-primary)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          zIndex: 1, borderRadius: '4px', cursor: 'text',
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
          px: 1.75, py: 1.25,
          background: active ? focusBg : triggerBg,
          border: `1.5px solid ${active ? 'var(--app-primary)' : border}`,
          borderRadius: '10px',
          color: textPrimary,
          transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
          boxShadow: focused
            ? '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.14)'
            : '0 1px 2px rgba(15,23,42,0.04)',
          '&:hover': { borderColor: 'var(--app-primary)' },
        }}
      >
        <motion.span
          animate={{
            scale: focused ? 1.08 : 1,
            color: active ? 'var(--app-primary)' : textMeta,
          }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          style={{ display: 'inline-flex', flexShrink: 0 }}
        >
          <SearchIcon fontSize="small" />
        </motion.span>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            component="input"
            ref={inputRef}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            sx={{
              all: 'unset',
              width: '100%',
              fontSize: 14, fontWeight: 600, lineHeight: 1.2,
              color: textPrimary,
              '&::placeholder': { color: textMeta, fontWeight: 500 },
            }}
          />
          <Box sx={{ mt: 0.25, fontSize: 11, color: textMeta, letterSpacing: '0.04em' }}>
            {hint}
          </Box>
        </Box>
        <AnimatePresence>
          {hasValue && (
            <Box
              component={motion.button}
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => { onChange(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
              sx={{
                all: 'unset', cursor: 'pointer',
                width: 22, height: 22, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', flexShrink: 0,
                background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                color: textPrimary,
                transition: 'background 0.2s ease, color 0.2s ease',
                '&:hover': { background: 'var(--app-primary)', color: '#fff' },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

/**
 * Editorial date input — shares chrome with SearchField / StatusFilter so the
 * bookings filter bar stays a matched set. Wraps a native <input type="date">.
 */
export const DateField = ({ value, onChange, darkMode = false, label = 'Date', hint = '' }) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const surface = darkMode ? 'rgba(30, 35, 45, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)';
  const textPrimary = darkMode ? '#f3f4f6' : '#1e293b';
  const textMeta = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const triggerBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const focusBg = darkMode ? 'rgba(var(--app-primary-rgb, 99,102,241),0.10)' : 'rgba(var(--app-primary-rgb, 99,102,241),0.06)';
  const hasValue = value && value.length > 0;
  const active = focused || hasValue;

  return (
    <Box sx={{ position: 'relative', minWidth: 150 }}>
      <Typography
        component="label"
        onClick={() => inputRef.current?.focus()}
        sx={{
          position: 'absolute', top: -8, left: 12, px: 0.75,
          background: surface, color: 'var(--app-primary)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          zIndex: 1, borderRadius: '4px', cursor: 'pointer',
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 1.25,
          px: 1.75, py: 1.25,
          background: active ? focusBg : triggerBg,
          border: `1.5px solid ${active ? 'var(--app-primary)' : border}`,
          borderRadius: '10px',
          color: textPrimary,
          transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
          boxShadow: focused
            ? '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.14)'
            : '0 1px 2px rgba(15,23,42,0.04)',
          '&:hover': { borderColor: 'var(--app-primary)' },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            component="input"
            type="date"
            ref={inputRef}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            sx={{
              all: 'unset', width: '100%',
              fontSize: 14, fontWeight: 600, lineHeight: 1.2,
              color: value ? textPrimary : textMeta,
              colorScheme: darkMode ? 'dark' : 'light',
              cursor: 'pointer',
            }}
          />
          {hint && (
            <Box sx={{ mt: 0.25, fontSize: 11, color: textMeta, letterSpacing: '0.04em' }}>
              {hint}
            </Box>
          )}
        </Box>
        <AnimatePresence>
          {hasValue && (
            <Box
              component={motion.button}
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => onChange('')}
              aria-label={`Clear ${label}`}
              sx={{
                all: 'unset', cursor: 'pointer',
                width: 22, height: 22, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', flexShrink: 0,
                background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                color: textPrimary,
                transition: 'background 0.2s ease, color 0.2s ease',
                '&:hover': { background: 'var(--app-primary)', color: '#fff' },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

// Pill header action matching the page's "Select Guest" ghost button, so
// Group / Company booking sit visually alongside it.
export const HeaderGhostButton = ({ icon, label, onClick, darkMode }) => (
  <Box
    component={motion.button}
    type="button"
    onClick={onClick}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.97 }}
    transition={{ duration: 0.2, ease: EASE_OUT }}
    sx={{
      all: 'unset', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 1.25,
      px: 2.5, py: 1.1, borderRadius: '999px',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: darkMode ? '#f3f4f6' : '#1e293b',
      background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
      border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'}`,
      transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease, color 0.25s ease',
      '& .ghost-icon': { display: 'inline-flex', color: 'var(--app-primary)', transition: 'transform 0.3s ease' },
      '&:hover': {
        color: 'var(--app-primary)',
        borderColor: 'var(--app-primary)',
        background: 'rgba(var(--app-primary-rgb, 99,102,241), 0.08)',
        boxShadow: '0 0 0 4px rgba(var(--app-primary-rgb, 99,102,241), 0.10)',
      },
      '&:hover .ghost-icon': { transform: 'translateY(-1px) scale(1.08)' },
    }}
  >
    <Box component="span" className="ghost-icon">{icon}</Box>
    {label}
  </Box>
);
