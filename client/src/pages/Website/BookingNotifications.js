import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Badge, IconButton, Avatar, Button, Tooltip,
  Snackbar, Alert, CircularProgress, Chip, Stack, Menu, MenuItem, useTheme,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Notifications, Close, CheckCircle, Cancel, Hotel, VolumeUp, VolumeOff, Tune,
  RecordVoiceOver, VoiceOverOff, Check,
  NotificationsActive, NotificationsOff, Event, Groups, Phone, CurrencyRupee, MeetingRoom,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import { useAuth } from '../../contexts/AuthContext';
import { connectSocket } from '../../api/socket';
import {
  ALERT_SOUNDS, primeAudio, loadAlertPrefs, saveAlertPrefs, playAlert, playFeedback,
  startRinging, stopRinging, ringOnce, startTitleFlash, stopTitleFlash,
  ensureNotificationPermission, showDesktopNotification,
  primeVoices, listVoices, resolveVoiceName, speak, cancelSpeech,
} from '../../utils/alertSound';

const EASE = [0.22, 1, 0.36, 1];

// Pulsing ring behind the bell badge while requests are waiting.
const pulseRing = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(244,67,54,0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(244,67,54,0); }
  100% { box-shadow: 0 0 0 0 rgba(244,67,54,0); }
`;

// The bell physically rocks while an unacknowledged request is ringing.
const shakeBell = keyframes`
  0%, 60%, 100% { transform: rotate(0deg); }
  5%  { transform: rotate(-18deg); }
  10% { transform: rotate(16deg); }
  15% { transform: rotate(-14deg); }
  20% { transform: rotate(12deg); }
  25% { transform: rotate(-8deg); }
  30% { transform: rotate(6deg); }
  35% { transform: rotate(-3deg); }
`;

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

// What the voice says out loud. Short sentences read better than one long one.
const announcementFor = (count, guestName) => {
  if (count > 1) return `Hello! ${count} new booking requests have arrived. Please check the admin panel.`;
  return guestName
    ? `Hello! New booking request from ${guestName}. Please check the admin panel.`
    : 'Hello! A new booking request has arrived. Please check the admin panel.';
};

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
  const [alerting, setAlerting] = useState(false);          // unacknowledged request(s)
  const [alertPrefs, setAlertPrefs] = useState(loadAlertPrefs);
  const [soundMenuEl, setSoundMenuEl] = useState(null);
  const [voices, setVoices] = useState([]);

  // Booking ids we have already alerted for. `null` until the first fetch lands,
  // which is how we tell "app just opened" from "a request just arrived".
  const knownIdsRef = useRef(null);

  const showSnackbar = useCallback((message, severity = 'info') => setSnackbar({ open: true, message, severity }), []);
  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const triggerFeedback = useCallback((type) => {
    setFeedback({ type, key: Date.now() });
    playFeedback(type === 'success' ? 'success' : 'error');
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  /* ── the alarm ─────────────────────────────────────────────────────────────
     A missed website booking is a lost booking, so a new request rings loudly
     on repeat, flashes the tab title, buzzes the phone and raises a desktop
     notification — until a human silences it. */
  const raiseAlarm = useCallback((count, guestName) => {
    setAlerting(true);
    startRinging(announcementFor(count, guestName));
    startTitleFlash(`🔔 ${count} NEW BOOKING${count > 1 ? 'S' : ''}!`);
    showDesktopNotification({
      title: count > 1 ? `${count} new booking requests` : 'New booking request',
      body: guestName ? `${guestName} — approve or reject in the admin panel.`
                      : 'Open the admin panel to approve or reject.',
    });
    setOpen(true);
  }, []);

  const silenceAlarm = useCallback(() => {
    stopRinging();
    cancelSpeech();
    stopTitleFlash();
    setAlerting(false);
  }, []);

  // Browsers keep a page silent until it has seen a real gesture, so start
  // listening for one immediately — the login click already unlocks audio.
  useEffect(() => {
    primeAudio();
    setVoices(listVoices());               // may be empty on the first tick…
    primeVoices((list) => setVoices(list)); // …Chrome fills it in asynchronously
  }, []);

  // Desktop-notification rights, asked for on the first click after login.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const ask = () => ensureNotificationPermission();
    window.addEventListener('pointerdown', ask, { once: true });
    return () => window.removeEventListener('pointerdown', ask);
  }, [isAuthenticated]);

  // Never leave an alarm ringing behind us.
  useEffect(() => () => { stopRinging(); stopTitleFlash(); cancelSpeech(); }, []);

  const toggleVoice = () => {
    const next = saveAlertPrefs({ voice: !alertPrefs.voice });
    setAlertPrefs(next);
    if (next.voice) speak('Voice announcements are on.');
    else cancelSpeech();
  };

  const setVoiceName = (name) => {
    setAlertPrefs(saveAlertPrefs({ voiceName: name, voice: true }));
    speak('Hello! New booking request from Priya Sharma. Please check the admin panel.', undefined, name);
  };

  const setSound = (id) => {
    setAlertPrefs(saveAlertPrefs({ sound: id }));
    setSoundMenuEl(null);
    playAlert(id); // preview, so staff hear what they picked
  };

  const toggleMute = () => {
    const next = saveAlertPrefs({ muted: !alertPrefs.muted });
    setAlertPrefs(next);
    if (next.muted) stopRinging();
    else if (!alerting) ringOnce(next.sound); // confirm the sound is audible again
  };

  const fetchPendingBookings = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); setPendingBookings([]); return; }
    try {
      setLoading(true);
      const response = await api.bookings.getAll({ status: 'Pending' });
      const arr = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const pending = arr.filter((b) => b.bookingStatus === 'Pending');
      setPendingBookings(pending);

      // Alert on anything we haven't seen yet — this is the safety net for when
      // the socket event is missed (reconnect, sleeping laptop, dropped Wi-Fi).
      const known = knownIdsRef.current;
      knownIdsRef.current = new Set(pending.map((b) => b._id));
      if (known === null) {
        // First load: flag anything already waiting, but only a single ring.
        if (pending.length) {
          ringOnce(null, pending.length > 1
            ? `Hello! ${pending.length} booking requests are waiting for approval.`
            : `Hello! A booking request from ${guestFullName(pending[0])} is waiting for approval.`);
          setAlerting(true);
          startTitleFlash(`🔔 ${pending.length} BOOKING REQUEST${pending.length > 1 ? 'S' : ''}`);
        }
      } else {
        const fresh = pending.filter((b) => !known.has(b._id));
        if (fresh.length) raiseAlarm(fresh.length, guestFullName(fresh[0]));
      }
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      showSnackbar('Failed to load pending bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, isAuthenticated, raiseAlarm]);

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
    const onNew = (payload) => {
      // Claim the id right away so the polling fallback doesn't double-alarm.
      if (payload?._id) {
        if (knownIdsRef.current?.has(payload._id)) return;
        knownIdsRef.current = new Set([...(knownIdsRef.current || []), payload._id]);
      }
      raiseAlarm(1, payload?.guestName);
      fetchRef.current();
    };
    socket.on('booking:new-website', onNew);
    return () => socket.off('booking:new-website', onNew);
  }, [isAuthenticated, token, raiseAlarm]);

  // Nothing left to answer → stop making noise.
  useEffect(() => {
    if (!pendingBookings.length && alerting) silenceAlarm();
  }, [pendingBookings.length, alerting, silenceAlarm]);

  const handleApprove = async (bookingId) => {
    if (!isAuthenticated) { showSnackbar('Authentication required', 'error'); return; }
    try {
      setProcessingId(bookingId);
      silenceAlarm();
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
      silenceAlarm();
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

  // Offer the softer/female voices first — the full OS list is far too long to
  // scroll through, so cap it, and let the module say which one is really in use.
  const isSoft = (v) => /female|woman|veena|samantha|karen|tessa|moira|fiona|zira|heera|kalpana|priya|google uk english|google us english/i.test(v.name);
  const selectedVoiceName = resolveVoiceName();
  const ranked = [...voices].sort((a, b) => (isSoft(b) ? 1 : 0) - (isSoft(a) ? 1 : 0));
  const voiceChoices = ranked.slice(0, 8);
  const current = ranked.find((v) => v.name === selectedVoiceName);
  if (current && !voiceChoices.includes(current)) voiceChoices.push(current);

  return (
    <>
      <Box sx={{ display: 'inline-block' }}>
        <Tooltip title={alerting ? 'New booking request — click to open' : 'Booking Requests'}>
          <IconButton onClick={() => { setOpen(true); silenceAlarm(); }} color={alerting ? 'error' : 'inherit'}>
            <Badge badgeContent={pendingBookings.length} color="error"
              sx={{ '& .MuiBadge-badge': { animation: hasPending ? `${pulseRing} 1.8s infinite` : 'none' } }}>
              <Box sx={{ display: 'flex', animation: alerting ? `${shakeBell} 1.1s infinite` : 'none', transformOrigin: '50% 15%' }}>
                {hasPending ? <NotificationsActive /> : <Notifications />}
              </Box>
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
              backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'var(--app-blur-overlay)' }}>
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
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        {pendingBookings.length} pending · live{alertPrefs.muted ? ' · muted' : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                      <Tooltip title={alertPrefs.muted ? 'Alarm muted — turn sound on' : 'Mute the alarm'}>
                        <IconButton onClick={toggleMute} sx={{ color: '#fff' }}>
                          {alertPrefs.muted ? <VolumeOff /> : <VolumeUp />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={alertPrefs.voice ? 'Voice announcement on' : 'Voice announcement off'}>
                        <IconButton onClick={toggleVoice} sx={{ color: '#fff' }}>
                          {alertPrefs.voice ? <RecordVoiceOver /> : <VoiceOverOff />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Choose alert sound & voice">
                        <IconButton onClick={(e) => setSoundMenuEl(e.currentTarget)} sx={{ color: '#fff' }}><Tune /></IconButton>
                      </Tooltip>
                      <IconButton onClick={() => { setOpen(false); silenceAlarm(); }} sx={{ color: '#fff' }}><Close /></IconButton>
                    </Box>
                  </Box>
                </Box>

                {alerting && (
                  <Box component={motion.div}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5,
                      bgcolor: 'error.main', color: '#fff' }}>
                    <NotificationsActive sx={{ animation: `${shakeBell} 1.1s infinite`, transformOrigin: '50% 15%' }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {alertPrefs.muted ? 'New booking request waiting' : 'Alarm ringing — a new booking is waiting'}
                    </Typography>
                    <Button size="small" variant="contained" color="inherit" onClick={silenceAlarm}
                      sx={{ ml: 'auto', fontWeight: 800, color: 'error.main', bgcolor: '#fff', '&:hover': { bgcolor: '#f1f5f9' } }}>
                      Silence
                    </Button>
                  </Box>
                )}

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

      <Menu anchorEl={soundMenuEl} open={Boolean(soundMenuEl)} onClose={() => setSoundMenuEl(null)}
        slotProps={{ paper: { sx: { zIndex: 1700 } } }} sx={{ zIndex: 1700 }}>
        <MenuItem disabled sx={{ opacity: 1, fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>ALERT SOUND</MenuItem>
        {ALERT_SOUNDS.map((s) => (
          <MenuItem key={s.id} selected={s.id === alertPrefs.sound} onClick={() => setSound(s.id)}>{s.label}</MenuItem>
        ))}
        <MenuItem disabled sx={{ opacity: 1, fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
          borderTop: '1px solid', borderColor: 'divider', mt: 0.5, pt: 1 }}>ANNOUNCEMENT</MenuItem>
        <MenuItem onClick={toggleVoice} sx={{ gap: 1 }}>
          {alertPrefs.voice ? <RecordVoiceOver fontSize="small" /> : <VoiceOverOff fontSize="small" />}
          {alertPrefs.voice ? 'Speaking the guest name' : 'Voice announcement off'}
        </MenuItem>
        {alertPrefs.voice && voiceChoices.map((v) => (
          <MenuItem key={v.name} selected={v.name === selectedVoiceName} onClick={() => setVoiceName(v.name)}
            sx={{ pl: 4, fontSize: 14 }}>
            {v.name === selectedVoiceName && <Check fontSize="small" sx={{ position: 'absolute', left: 12 }} />}
            {v.name.replace(/^(Google|Microsoft)\s+/, '')}
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>{v.lang}</Typography>
          </MenuItem>
        ))}
        {alertPrefs.voice && !voiceChoices.length && (
          <MenuItem disabled sx={{ pl: 4, fontSize: 13 }}>No voices installed in this browser</MenuItem>
        )}
        <MenuItem onClick={() => { toggleMute(); setSoundMenuEl(null); }}
          sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.5, gap: 1 }}>
          {alertPrefs.muted ? <Notifications fontSize="small" /> : <NotificationsOff fontSize="small" />}
          {alertPrefs.muted ? 'Unmute alarm' : 'Mute alarm'}
        </MenuItem>
      </Menu>

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
