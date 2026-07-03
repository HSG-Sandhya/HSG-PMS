import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Badge, IconButton, Avatar, Button, Tooltip,
  Snackbar, Alert, CircularProgress, Chip, Stack, useTheme,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Notifications, Close, CheckCircle, Cancel, Hotel,
  NotificationsActive, Event, Groups, Phone, CurrencyRupee, MeetingRoom,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import { useAuth } from '../../contexts/AuthContext';
import { connectSocket } from '../../api/socket';

const EASE = [0.22, 1, 0.36, 1];

// Pulsing ring behind the bell badge while requests are waiting.
const pulseRing = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(244,67,54,0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(244,67,54,0); }
  100% { box-shadow: 0 0 0 0 rgba(244,67,54,0); }
`;

/* ───────────────────────── sound (Web Audio, no assets) ───────────────────────── */
const playTones = (notes, type = 'sine') => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    let end = 0;
    notes.forEach(({ f, t, d = 0.35, g = 0.22 }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const s = now + t;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(g, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(s);
      osc.stop(s + d + 0.02);
      end = Math.max(end, t + d);
    });
    setTimeout(() => ctx.close().catch(() => {}), (end + 0.3) * 1000);
  } catch { /* autoplay blocked → silent */ }
};
const playChime = () => playTones([{ f: 880, t: 0 }, { f: 1318.5, t: 0.16, d: 0.42 }], 'sine');
const playSuccess = () => playTones([{ f: 659, t: 0 }, { f: 880, t: 0.12 }, { f: 1175, t: 0.24, d: 0.5 }], 'sine');
const playError = () => playTones([{ f: 220, t: 0, d: 0.3 }, { f: 155, t: 0.16, d: 0.42, g: 0.25 }], 'sawtooth');

/* ───────────────────────── helpers ───────────────────────── */
const fmtFull = (d) => {
  try { return format(typeof d === 'string' ? parseISO(d) : new Date(d), 'd MMM yyyy'); }
  catch { return ''; }
};

const AVATAR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];
const stringToColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const categoryOf = (b) => b.roomId?.type || b.roomType || b.roomTypeName || 'Room';
const totalOf = (b) => b.totalAmount ?? b.totalPrice ?? 0;
const guestInitial = (b) => (b.guestName || b.firstName || 'G').trim()[0]?.toUpperCase() || 'G';
const guestFullName = (b) => (b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : (b.firstName || b.guestName || 'Guest'));

const InfoRow = ({ icon, label, value, strong }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
    <Typography variant="body2" sx={{ ml: 'auto', fontWeight: strong ? 800 : 600, color: strong ? 'success.main' : 'text.primary' }}>
      {value}
    </Typography>
  </Box>
);

/* ───────────────────────── one request card ───────────────────────── */
// The guest picks a category online; staff approve the request here and the
// specific room is assigned later, at check-in.
const RequestCard = ({ booking, busy, isDark, onApprove, onReject }) => {
  const category = categoryOf(booking);
  const accent = stringToColor(guestFullName(booking));

  return (
    <Box component={motion.div} layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: EASE }}
      sx={{
        position: 'relative', mb: 2, borderRadius: 3, overflow: 'hidden',
        border: `1px solid ${isDark ? '#374151' : '#eef0f4'}`,
        background: isDark ? 'linear-gradient(180deg,#1f2937,#111827)' : 'linear-gradient(180deg,#ffffff,#f8fafc)',
        boxShadow: '0 6px 20px -14px rgba(0,0,0,0.45)',
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      <Box sx={{ p: 2, pl: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: accent, fontWeight: 700, width: 44, height: 44 }}>{guestInitial(booking)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{guestFullName(booking)}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              New request{booking.createdAt ? ` · ${timeAgo(booking.createdAt)}` : ''}
            </Typography>
          </Box>
          <Chip size="small" label="Pending" color="warning" variant="outlined" sx={{ ml: 'auto', fontWeight: 700, borderRadius: 1.5 }} />
        </Box>

        {/* Category chosen by the guest — the room itself is assigned at check-in */}
        <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(var(--app-primary-rgb), 0.12)' : 'rgba(var(--app-primary-rgb), 0.06)',
          border: `1px dashed ${isDark ? '#4b5563' : '#dfe3ea'}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Hotel sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Category requested</Typography>
            <Chip size="small" label={category} sx={{ ml: 'auto', fontWeight: 700 }} color="primary" />
          </Box>
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, color: 'text.secondary' }}>
            <MeetingRoom sx={{ fontSize: 16 }} /> Room number is assigned at check-in.
          </Typography>
        </Box>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <InfoRow icon={<Event />} label="Dates" value={`${fmtFull(booking.checkIn)} → ${fmtFull(booking.checkOut)}`} />
          <InfoRow icon={<Groups />} label="Guests" value={`${booking.adults || 0} adult${(booking.adults || 0) !== 1 ? 's' : ''}, ${booking.children || 0} child${(booking.children || 0) !== 1 ? 'ren' : ''}`} />
          <InfoRow icon={<Phone />} label="Contact" value={booking.phone || '—'} />
          <InfoRow icon={<CurrencyRupee />} label="Total" strong value={`${currencySym()}${totalOf(booking).toLocaleString('en-IN')}`} />
        </Stack>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button fullWidth variant="outlined" color="error" startIcon={<Cancel />} disabled={busy}
            onClick={() => onReject(booking._id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Reject
          </Button>
          <Button fullWidth variant="contained" startIcon={busy ? null : <CheckCircle />} disabled={busy}
            onClick={() => onApprove(booking._id)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg,#10b981,#059669)',
              boxShadow: '0 10px 22px -10px rgba(16,185,129,0.7)',
              '&:hover': { background: 'linear-gradient(135deg,#059669,#047857)' } }}>
            {busy ? 'Processing…' : 'Approve'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

/* ───────────────────────── full-screen approve/reject feedback ───────────────────────── */
const ActionFeedback = ({ feedback }) => (
  <AnimatePresence>
    {feedback && (
      <Box component={motion.div} key={feedback.key}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        sx={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          {/* expanding ring */}
          <Box component={motion.div}
            initial={{ scale: 0.4, opacity: 0.6 }} animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%',
              border: `3px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}` }} />
          {/* badge */}
          <Box component={motion.div}
            initial={{ scale: 0, rotate: feedback.type === 'error' ? -12 : 0 }}
            animate={feedback.type === 'success'
              ? { scale: [0, 1.18, 1], rotate: 0 }
              : { scale: [0, 1.12, 1], x: [0, -12, 12, -8, 8, 0] }}
            transition={{ duration: 0.6, ease: EASE }}
            sx={{ width: 130, height: 130, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff',
              boxShadow: '0 24px 60px -18px rgba(0,0,0,0.5)',
              background: feedback.type === 'success'
                ? 'linear-gradient(135deg,#34d399,#059669)'
                : 'linear-gradient(135deg,#f87171,#dc2626)' }}>
            {feedback.type === 'success' ? <CheckCircle sx={{ fontSize: 76 }} /> : <Cancel sx={{ fontSize: 76 }} />}
          </Box>
          <Typography component={motion.p}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            sx={{ position: 'absolute', top: 'calc(50% + 88px)', fontWeight: 800, letterSpacing: 1, whiteSpace: 'nowrap',
              color: feedback.type === 'success' ? '#10b981' : '#ef4444' }}>
            {feedback.type === 'success' ? 'BOOKING CONFIRMED' : 'BOOKING REJECTED'}
          </Typography>
        </Box>
      </Box>
    )}
  </AnimatePresence>
);

/* ───────────────────────── main component ───────────────────────── */
const BookingNotifications = () => {
  const { isAuthenticated, token } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [pendingBookings, setPendingBookings] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type, key }
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnackbar = useCallback((message, severity = 'info') => setSnackbar({ open: true, message, severity }), []);
  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const triggerFeedback = useCallback((type) => {
    setFeedback({ type, key: Date.now() });
    (type === 'success' ? playSuccess : playError)();
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  const fetchPendingBookings = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); setPendingBookings([]); return; }
    try {
      setLoading(true);
      const response = await api.bookings.getAll({ status: 'Pending' });
      const arr = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setPendingBookings(arr.filter((b) => b.bookingStatus === 'Pending'));
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      showSnackbar('Failed to load pending bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, isAuthenticated]);

  // Polling fallback.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    fetchPendingBookings();
    const id = setInterval(fetchPendingBookings, 30000);
    return () => clearInterval(id);
  }, [fetchPendingBookings, isAuthenticated]);

  // Real-time: a new website booking chimes, refreshes, and pops the modal open.
  const fetchRef = useRef(fetchPendingBookings);
  fetchRef.current = fetchPendingBookings;
  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;
    const socket = connectSocket(token);
    if (!socket) return undefined;
    const onNew = () => { playChime(); fetchRef.current(); setOpen(true); };
    socket.on('booking:new-website', onNew);
    return () => socket.off('booking:new-website', onNew);
  }, [isAuthenticated, token]);

  const handleApprove = async (bookingId) => {
    if (!isAuthenticated) { showSnackbar('Authentication required', 'error'); return; }
    try {
      setProcessingId(bookingId);
      await api.bookings.update(bookingId, { bookingStatus: 'Confirmed' });
      setPendingBookings((prev) => prev.filter((b) => b._id !== bookingId));
      triggerFeedback('success');
      showSnackbar('Booking confirmed', 'success');
    } catch (error) {
      console.error('Error approving booking:', error);
      showSnackbar(error?.response?.data?.message || 'Failed to approve booking', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (bookingId) => {
    if (!isAuthenticated) { showSnackbar('Authentication required', 'error'); return; }
    try {
      setProcessingId(bookingId);
      await api.bookings.update(bookingId, { bookingStatus: 'Rejected' });
      setPendingBookings((prev) => prev.filter((b) => b._id !== bookingId));
      triggerFeedback('error');
      showSnackbar('Booking rejected', 'info');
    } catch (error) {
      console.error('Error rejecting booking:', error);
      showSnackbar('Failed to reject booking', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAuthenticated) return null;
  const hasPending = pendingBookings.length > 0;

  return (
    <>
      <Box sx={{ display: 'inline-block' }}>
        <Tooltip title="Booking Requests">
          <IconButton onClick={() => setOpen(true)} color="inherit">
            <Badge badgeContent={pendingBookings.length} color="error"
              sx={{ '& .MuiBadge-badge': { animation: hasPending ? `${pulseRing} 1.8s infinite` : 'none' } }}>
              {hasPending ? <NotificationsActive /> : <Notifications />}
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Centered animated modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <Box component={motion.div} key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            sx={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'grid', placeItems: 'center', p: 2,
              backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
            <Box component={motion.div} key="card"
              initial={{ opacity: 0, scale: 0.82, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.86, y: 14 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              sx={{ width: { xs: '100%', sm: 480 }, maxHeight: '86vh', borderRadius: 4, overflow: 'hidden',
                boxShadow: '0 40px 90px -30px rgba(0,0,0,0.6)',
                bgcolor: isDark ? 'rgba(17,24,39,0.98)' : 'rgba(248,250,252,0.99)' }}>
              {/* gentle floating idle motion */}
              <Box component={motion.div}
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
                {/* gradient header — uses the app theme so it matches the rest of the UI */}
                <Box sx={{ px: 2.5, pt: 2.5, pb: 2, color: '#fff',
                  background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary, var(--app-primary)) 55%, var(--app-accent, var(--app-primary)) 100%)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.18)' }}>
                      <NotificationsActive />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>Booking Requests</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>{pendingBookings.length} pending · live</Typography>
                    </Box>
                    <IconButton onClick={() => setOpen(false)} sx={{ ml: 'auto', color: '#fff' }}><Close /></IconButton>
                  </Box>
                </Box>

                <Box sx={{ p: 2, maxHeight: 'calc(86vh - 92px)', overflowY: 'auto' }}>
                  {loading && !hasPending ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 6, color: 'text.secondary' }}>
                      <CircularProgress size={40} /><Typography variant="body2">Loading requests…</Typography>
                    </Box>
                  ) : !hasPending ? (
                    <Box component={motion.div} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                      sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      <Box sx={{ width: 88, height: 88, mx: 'auto', mb: 2.5, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        background: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.10)' }}>
                        <CheckCircle sx={{ fontSize: 44, color: 'success.main' }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>All caught up</Typography>
                      <Typography variant="body2">No pending booking requests right now.</Typography>
                    </Box>
                  ) : (
                    <AnimatePresence initial={false}>
                      {pendingBookings.map((booking) => (
                        <RequestCard
                          key={booking._id}
                          booking={booking}
                          isDark={isDark}
                          busy={processingId === booking._id}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </AnimatePresence>

      <ActionFeedback feedback={feedback} />

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BookingNotifications;
