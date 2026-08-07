import { useState, useEffect } from 'react';
import {
  Box, Button, TextField, Typography, Alert, CircularProgress,
  IconButton, InputAdornment, Divider, Checkbox, FormControlLabel, useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useAuth } from '../../contexts/AuthContext';
import {
  readRemembered, saveRemembered, unlockRemembered, clearRemembered,
  isRememberSupported, isValidPin,
} from '../../utils/rememberedLogin';
import api from '../../api';

const MotionBox = motion.create(Box);

// The login screen is served per-hotel (one subdomain each), so its name/logo
// must come from that hotel — not be hardcoded. We cache the last-seen branding
// per origin (localStorage is per-subdomain) so repeat visits paint instantly
// while the fresh copy loads.
const BRAND_CACHE_KEY = 'pms:login-branding';
const readBrandCache = () => {
  try { return JSON.parse(localStorage.getItem(BRAND_CACHE_KEY)) || null; } catch { return null; }
};

// GET /settings/public/branding ships with the multi-tenancy server update and
// is NOT on production yet — calling it only logs a 404 on the login page.
// Keep this false until that route is deployed; flip to true to re-enable
// dynamic branding. Until then the login uses cached / neutral branding.
const BRANDING_ENDPOINT_LIVE = false;

// Fresh per-channel OTP state (email / phone).
const OTP_INIT = { sent: false, code: '', verified: false, sending: false, verifying: false, error: '', cooldown: 0, dev: '' };

// Green "verified" badge that springs in when an email/phone passes OTP — a
// filled green disc with a check that pops, wrapped by an expanding glow ring.
const VerifiedBadge = ({ label }) => (
  <MotionBox
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.25 }}
    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.9, color: '#16a34a', fontWeight: 700, fontSize: 13.5 }}
  >
    <Box sx={{ position: 'relative', width: 24, height: 24, display: 'inline-flex' }}>
      <MotionBox
        initial={{ scale: 0.6, opacity: 0.7 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(34,197,94,0.45)' }}
      />
      <MotionBox
        initial={{ scale: 0, rotate: -35 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 15 }}
        sx={{
          position: 'relative', width: 24, height: 24, borderRadius: '50%',
          background: 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px -2px rgba(22,163,74,0.5)',
        }}
      >
        <CheckRoundedIcon sx={{ fontSize: 16, color: '#fff' }} />
      </MotionBox>
    </Box>
    {label}
  </MotionBox>
);

// Soft, decorative blurred orb used on the brand panel.
const Orb = ({ size, color, sx }) => (
  <Box
    sx={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: 'blur(60px)',
      opacity: 0.55,
      pointerEvents: 'none',
      ...sx,
    }}
  />
);

// Traditional Indian mandala / lotus motif, drawn as line-art SVG. Used as a
// decorative watermark in place of plain text. `color` is inherited from the
// wrapping Box, so callers control the tint/opacity.
const Mandala = ({ size = 520, sx }) => (
  <Box
    aria-hidden
    sx={{ position: 'absolute', lineHeight: 0, pointerEvents: 'none', userSelect: 'none', ...sx }}
  >
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke="currentColor">
      <g strokeWidth="0.7">
        <circle cx="100" cy="100" r="97" />
        <circle cx="100" cy="100" r="80" />
        <circle cx="100" cy="100" r="40" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="13" />
        {/* outer lotus petals */}
        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={`p${i}`}
            d="M100 100 C 80 70 88 38 100 22 C 112 38 120 70 100 100 Z"
            transform={`rotate(${i * 22.5} 100 100)`}
          />
        ))}
        {/* inner offset petals */}
        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={`q${i}`}
            d="M100 80 C 91 62 95 46 100 38 C 105 46 109 62 100 80 Z"
            transform={`rotate(${i * 22.5 + 11.25} 100 100)`}
            strokeWidth="0.5"
          />
        ))}
        {/* beaded outer ring */}
        {Array.from({ length: 36 }).map((_, i) => {
          const a = (i * 10 * Math.PI) / 180;
          return (
            <circle
              key={`b${i}`}
              cx={100 + 89 * Math.cos(a)}
              cy={100 + 89 * Math.sin(a)}
              r="1.1"
              fill="currentColor"
              stroke="none"
            />
          );
        })}
      </g>
    </svg>
  </Box>
);

// Input styling, dark-mode aware so the form follows the Appearance settings.
// Glass-pill inputs: shaped like the Sign In button, with a lit top edge, a
// soft drop shadow for separation from the busy background, and a primary
// glow ring on focus. The floating label gets its own frosted chip so it
// stays readable where it crosses the pill border.
const makeFieldSx = (isDark) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 999,
    background: isDark
      ? 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.6) 100%)',
    backdropFilter: 'var(--app-blur, blur(8px))',
    WebkitBackdropFilter: 'var(--app-blur, blur(8px))',
    boxShadow: isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 20px -12px rgba(0,0,0,0.65)'
      : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 20px -14px rgba(15,23,42,0.4)',
    transition: 'box-shadow .25s ease, background .25s ease, transform .15s ease',
    '& fieldset': {
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)',
      transition: 'border-color .2s ease',
    },
    '&:hover': { transform: 'translateY(-1px)' },
    '&:hover fieldset': { borderColor: 'rgba(var(--app-primary-rgb),0.55)' },
    '&.Mui-focused': {
      background: isDark ? 'rgba(13,18,28,0.6)' : 'rgba(255,255,255,0.96)',
      boxShadow:
        '0 0 0 4px rgba(var(--app-primary-rgb),0.18), 0 12px 28px -14px rgba(var(--app-primary-rgb),0.5)',
    },
    '&.Mui-focused fieldset': { borderColor: 'var(--app-primary)', borderWidth: 1.5 },
    '& input': { padding: '14.5px 10px 14.5px 4px' },
  },
  '& .MuiInputLabel-root': {
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    '&.Mui-focused': { color: 'var(--app-primary)' },
  },
  '& .MuiInputLabel-shrink': {
    px: 0.9,
    borderRadius: 1.5,
    background: isDark ? 'rgba(13,18,28,0.65)' : 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : 'inset 0 0 0 1px rgba(255,255,255,0.9)',
  },
  '& .MuiFormHelperText-root': { ml: 2.5, fontWeight: 500 },
});

const Login = () => {
  // Seed straight from storage so a remembered login paints filled-in on the
  // first frame instead of flashing empty fields. Only the username is known at
  // this point — the password stays encrypted until a PIN unlocks it.
  const [remembered, setRemembered] = useState(() => readRemembered());
  const [formData, setFormData] = useState(() => ({ username: remembered?.username || '', password: '' }));
  // 'pin' asks for the PIN that unlocks the saved password; 'password' is the
  // ordinary form. A saved password starts locked.
  const [mode, setMode] = useState(() => (remembered?.hasPassword ? 'pin' : 'password'));
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!remembered?.hasPassword);
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const { login, loading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // Hotel identity for this subdomain (name / tagline / logo), seeded from cache.
  const [branding, setBranding] = useState(
    () => readBrandCache() || { hotelName: '', tagline: '', logo: '' }
  );

  // With the branding endpoint disabled (single-tenant prod), fall back to the
  // hotel's bundled logo so the login still shows it. When BRANDING_ENDPOINT_LIVE
  // turns on (multi-tenant), use only the per-hotel logo from the server.
  const logoSrc = branding.logo || (BRANDING_ENDPOINT_LIVE ? '' : '/images/sandhya-logo.png');

  // First-run setup: when the database has no users, the login screen turns
  // into a "create the first admin" form instead. The backend closes this the
  // instant any account exists, so it only ever appears on a fresh install.
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupData, setSetupData] = useState({
    firstName: '', lastName: '', email: '', phone: '', username: '', password: '', confirm: '',
  });
  const [setupErrors, setSetupErrors] = useState({});
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  // Per-channel OTP verification state for email + phone.
  const [otp, setOtp] = useState({ email: { ...OTP_INIT }, phone: { ...OTP_INIT } });
  const setOtpField = (ch, patch) => setOtp((p) => ({ ...p, [ch]: { ...p[ch], ...patch } }));

  // Storing a password needs WebCrypto, which only exists on a secure origin.
  // Without it there is no honest way to keep one, so the option is hidden.
  const rememberSupported = isRememberSupported();

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const fieldSx = makeFieldSx(isDark);
  // The base field style keeps only 4px of left input padding because most
  // fields carry a start icon that fills that gap. The setup form's name/email/
  // phone fields have no icon, so the cursor would sit against the pill's curved
  // edge — give those a comfortable left indent instead.
  const plainFieldSx = {
    ...fieldSx,
    '& .MuiOutlinedInput-root input': { padding: '14.5px 18px' },
  };

  useEffect(() => {
    let active = true;
    api.auth.getSetupStatus()
      .then((res) => { if (active && res?.data?.needsSetup) setNeedsSetup(true); })
      .catch(() => { /* If the check fails, fall back to the normal login form. */ });
    return () => { active = false; };
  }, []);

  // Fetch this hotel's public branding (resolved from the subdomain server-side).
  useEffect(() => {
    if (!BRANDING_ENDPOINT_LIVE) return undefined; // endpoint not deployed yet
    let active = true;
    api.settings.getPublicBranding()
      .then((res) => {
        const b = res?.data?.data;
        if (!active || !b || typeof b !== 'object') return;
        const next = { hotelName: b.hotelName || '', tagline: b.tagline || '', logo: b.logo || '' };
        setBranding(next);
        try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      })
      .catch(() => { /* keep cached / neutral branding */ });
    return () => { active = false; };
  }, []);

  // Reflect the hotel name in the browser tab.
  useEffect(() => {
    if (branding.hotelName) document.title = `${branding.hotelName} — Sign in`;
  }, [branding.hotelName]);

  // Tick down the resend cooldown once per second while either channel is waiting.
  useEffect(() => {
    if (otp.email.cooldown <= 0 && otp.phone.cooldown <= 0) return undefined;
    const t = setInterval(() => {
      setOtp((p) => ({
        email: { ...p.email, cooldown: Math.max(0, p.email.cooldown - 1) },
        phone: { ...p.phone, cooldown: Math.max(0, p.phone.cooldown - 1) },
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [otp.email.cooldown, otp.phone.cooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => ({ ...p, [name]: '' }));
    if (submitError) setSubmitError('');
    // The saved password belongs to one username. Typing a different one means
    // a different person is signing in, so stop offering the PIN.
    if (name === 'username' && mode === 'pin' && value !== remembered?.username) {
      setMode('password');
      setRememberMe(false);
    }
  };

  const handlePinChange = (e) => {
    setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
    setPinError('');
    if (submitError) setSubmitError('');
  };

  // Give up on the saved login and fall back to typing the password.
  const fallBackToPassword = ({ forget } = {}) => {
    if (forget) {
      clearRemembered();
      setRemembered(null);
      setFormData({ username: '', password: '' });
    }
    setMode('password');
    setRememberMe(false);
    setPin('');
    setPinError('');
  };

  // Shared by "Sign In" and the eye: turn the PIN into the saved password.
  const unlockWithPin = async () => {
    if (!isValidPin(pin)) {
      setPinError('Enter your 4-6 digit PIN.');
      return null;
    }
    setPinBusy(true);
    try {
      const res = await unlockRemembered(pin);
      if (res.ok) return res.password;
      if (res.reason === 'wiped') {
        setRemembered(null);
        setFormData((p) => ({ ...p, password: '' }));
        setMode('password');
        setRememberMe(false);
        setPin('');
        setSubmitError('Too many wrong PINs — the saved password has been removed. Sign in with your password.');
        return null;
      }
      if (res.reason === 'bad-pin') {
        setPinError(`Incorrect PIN. ${res.attemptsLeft} ${res.attemptsLeft === 1 ? 'try' : 'tries'} left before the saved password is removed.`);
        return null;
      }
      fallBackToPassword({ forget: true });
      setSubmitError('The saved password is no longer available. Please sign in with your password.');
      return null;
    } finally {
      setPinBusy(false);
    }
  };

  // The eye in PIN mode: reveal the saved password to whoever knows the PIN, and
  // nobody else. On success the form drops to normal password mode with the
  // value shown, so it can be read, corrected, or used to sign in.
  const revealSavedPassword = async () => {
    const password = await unlockWithPin();
    if (password == null) return;
    setFormData((p) => ({ ...p, password }));
    setMode('password');
    setShowPassword(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.password) errors.password = 'Password is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // PIN mode: unlock first, then sign in with what came out.
    if (mode === 'pin') {
      const password = await unlockWithPin();
      if (password == null) return;
      try {
        const result = await login({ username: remembered.username, password });
        if (!result?.success) {
          // The PIN was right, so the stored password is simply out of date
          // (changed on another device). Hand the form back with an explanation.
          setFormData({ username: remembered.username, password: '' });
          fallBackToPassword({ forget: true });
          setSubmitError('Your saved password no longer works — it may have been changed. Sign in with your current password.');
        }
      } catch {
        setSubmitError('Something went wrong. Please try again.');
      }
      return;
    }

    if (!validateForm()) return;
    if (rememberMe && !isValidPin(pin)) {
      setPinError('Choose a 4-6 digit PIN to protect the saved password.');
      return;
    }

    try {
      const result = await login(formData);
      // Only remember credentials that actually worked, so a typo can't be
      // stored and replayed on every future visit.
      if (result?.success) {
        if (rememberMe) await saveRemembered({ username: formData.username, password: formData.password, pin });
        else clearRemembered();
      }
    } catch {
      // Expected auth failures (wrong password, etc.) are surfaced via the
      // AuthContext `error` state. This only catches unexpected throws.
      setSubmitError('Something went wrong. Please try again.');
    }
  };

  const handleSetupChange = (e) => {
    const { name, value } = e.target;
    setSetupData((p) => ({ ...p, [name]: value }));
    if (setupErrors[name]) setSetupErrors((p) => ({ ...p, [name]: '' }));
    if (submitError) setSubmitError('');
    // Editing the email invalidates any prior email verification.
    if (name === 'email') setOtp((p) => ({ ...p, email: { ...OTP_INIT } }));
  };

  // Request an OTP for the given channel ('email' | 'phone').
  const sendCode = async (channel) => {
    const value = channel === 'email' ? setupData.email.trim() : setupData.phone.trim();
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
      setSetupErrors((p) => ({ ...p, email: 'Enter a valid email first' }));
      return;
    }
    if (channel === 'phone' && !/^\d{10}$/.test(value)) {
      setSetupErrors((p) => ({ ...p, phone: 'Enter a 10-digit phone first' }));
      return;
    }
    setOtpField(channel, { sending: true, error: '' });
    try {
      const res = await api.auth.sendSetupOtp({ channel, value });
      setOtpField(channel, { sending: false, sent: true, cooldown: 30, dev: res?.data?.devCode || '' });
    } catch (err) {
      setOtpField(channel, { sending: false, error: err?.response?.data?.message || 'Could not send the code.' });
    }
  };

  // Verify the code the user typed for a channel.
  const verifyCode = async (channel) => {
    const value = channel === 'email' ? setupData.email.trim() : setupData.phone.trim();
    setOtpField(channel, { verifying: true, error: '' });
    try {
      await api.auth.verifySetupOtp({ channel, value, code: otp[channel].code });
      setOtpField(channel, { verifying: false, verified: true, error: '' });
    } catch (err) {
      setOtpField(channel, { verifying: false, error: err?.response?.data?.message || 'Incorrect code.' });
    }
  };

  const validateSetup = () => {
    const er = {};
    if (!setupData.firstName.trim()) er.firstName = 'Required';
    if (!setupData.lastName.trim()) er.lastName = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(setupData.email.trim())) er.email = 'Enter a valid email';
    if (!/^\d{10}$/.test(setupData.phone.trim())) er.phone = 'Enter a 10-digit phone';
    if (!setupData.username.trim()) er.username = 'Username is required';
    if (setupData.password.length < 6) er.password = 'At least 6 characters';
    if (setupData.password !== setupData.confirm) er.confirm = 'Passwords do not match';
    setSetupErrors(er);
    return Object.keys(er).length === 0;
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateSetup()) return;
    if (!otp.email.verified || !otp.phone.verified) {
      setSubmitError('Please verify both your email and phone first.');
      return;
    }
    setSetupSubmitting(true);
    try {
      await api.auth.setup({
        firstName: setupData.firstName.trim(),
        lastName: setupData.lastName.trim(),
        email: setupData.email.trim(),
        phone: setupData.phone.trim(),
        username: setupData.username.trim(),
        password: setupData.password,
      });
      // Account created — sign in with the credentials just chosen.
      const result = await login({ username: setupData.username.trim(), password: setupData.password });
      if (!result?.success) {
        setNeedsSetup(false); // account exists now → show the normal login form
        setSubmitError('Admin account created. Please sign in.');
        setSetupSubmitting(false);
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Could not complete setup. Please try again.');
      setSetupSubmitting(false);
    }
  };

  const otpFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2.5,
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
    },
    '& input': { padding: '9px 12px', letterSpacing: '3px', fontWeight: 700, textAlign: 'center' },
  };

  // Inline OTP row shown under the email / phone fields: a "Verify" trigger,
  // then a code box + Verify/Resend, and finally the green verified badge.
  const renderOtp = (channel) => {
    const st = otp[channel];
    if (st.verified) {
      return (
        <Box sx={{ mt: -0.5, mb: 1, ml: 1.5 }}>
          <VerifiedBadge label={channel === 'email' ? 'Email verified' : 'Phone verified'} />
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: -0.5, mb: 1, ml: 1.5 }}>
        {!st.sent ? (
          <Button
            size="small" variant="text" disableRipple
            disabled={st.sending || setupSubmitting}
            onClick={() => sendCode(channel)}
            sx={{ textTransform: 'none', fontWeight: 700, color: 'var(--app-primary)', px: 0.5, minWidth: 0 }}
          >
            {st.sending ? 'Sending…' : `Verify ${channel === 'email' ? 'email' : 'phone'} →`}
          </Button>
        ) : (
          <>
            <TextField
              size="small" placeholder="000000" value={st.code}
              onChange={(e) => setOtpField(channel, { code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
              disabled={st.verifying}
              sx={{ width: 118, ...otpFieldSx }}
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6, 'aria-label': `${channel} verification code` } }}
            />
            <Button
              size="small" variant="contained" disableElevation
              disabled={st.code.length !== 6 || st.verifying}
              onClick={() => verifyCode(channel)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: 'var(--app-primary)' }}
            >
              {st.verifying ? '…' : 'Verify'}
            </Button>
            <Button
              size="small" variant="text" disableRipple
              disabled={st.cooldown > 0 || st.sending}
              onClick={() => sendCode(channel)}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', minWidth: 0, px: 0.5 }}
            >
              {st.cooldown > 0 ? `Resend ${st.cooldown}s` : 'Resend'}
            </Button>
          </>
        )}
        {st.error && (
          <Typography variant="caption" color="error" sx={{ width: '100%', ml: 0.5 }}>{st.error}</Typography>
        )}
        {st.dev && (
          <Typography variant="caption" sx={{ width: '100%', ml: 0.5, color: 'text.secondary' }}>
            Dev code: <b>{st.dev}</b>
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2, sm: 3 },
        // Follow the background chosen in Appearance settings — shown clean,
        // with no tinted veil, exactly like the pages inside the app. The
        // glass panels provide their own legibility.
        background: 'var(--app-bg, #f8f9fa)',
      }}
    >
      <MotionBox
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          width: '100%',
          maxWidth: 960,
          minHeight: { md: 560 },
          borderRadius: 5,
          overflow: 'hidden',
          // Same Liquid-Glass tokens every card/dialog in the app uses: lit
          // edge, layered depth shadow and the prismatic glow pooling below.
          border: 'var(--app-glass-border, 1px solid rgba(255,255,255,0.25))',
          boxShadow: 'var(--app-glass-shadow, 0 30px 80px rgba(0,0,0,0.35)), var(--app-card-glow, 0 30px 80px rgba(0,0,0,0.35))',
        }}
      >
        {/* ---------- Brand panel (md and up) ---------- */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            flex: 1.05,
            position: 'relative',
            p: 5,
            color: '#fff',
            overflow: 'hidden',
            // Clear mirror glass with only a light brand tint — the page
            // background stays visible through it, matching the app's panels.
            background:
              'linear-gradient(150deg, rgba(var(--app-primary-rgb), 0.42) 0%, rgba(var(--app-secondary-rgb, 236, 72, 153), 0.34) 100%)',
            backdropFilter: 'var(--app-blur-strong, blur(14px) saturate(160%))',
            WebkitBackdropFilter: 'var(--app-blur-strong, blur(14px) saturate(160%))',
            textShadow: '0 1px 12px rgba(0,0,0,0.25)',
          }}
        >
          <Orb size={260} color="rgba(255,255,255,0.45)" sx={{ top: -80, right: -60 }} />
          <Orb size={220} color="rgba(0,0,0,0.25)" sx={{ bottom: -70, left: -50 }} />

          {/* Traditional Indian mandala watermark */}
          <Mandala
            size={620}
            sx={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'rgba(255,255,255,0.14)',
            }}
          />

          {/* Top — brand name (per-hotel) */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { md: '1.7rem', lg: '2rem' },
                letterSpacing: '0.01em',
                lineHeight: 1.1,
                mb: 1,
                textShadow: '0 2px 16px rgba(0,0,0,0.18)',
              }}
            >
              {branding.hotelName || ' '}
            </Typography>
            {branding.tagline && (
              <Typography sx={{ opacity: 0.92, fontSize: 16 }}>
                {branding.tagline}
              </Typography>
            )}
          </Box>

          {/* Middle — big logo (falls back to the hotel's initial / a glyph) */}
          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt={branding.hotelName || 'Hotel logo'}
              sx={{
                position: 'relative',
                zIndex: 1,
                width: { md: 240, lg: 280 },
                height: { md: 240, lg: 280 },
                objectFit: 'contain',
                borderRadius: 5,
                p: 2,
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 16px 44px rgba(0,0,0,0.25)',
              }}
            />
          ) : (
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                width: { md: 240, lg: 280 },
                height: { md: 240, lg: 280 },
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 16px 44px rgba(0,0,0,0.25)',
              }}
            >
              {branding.hotelName ? (
                <Typography sx={{ fontSize: { md: 110, lg: 130 }, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                  {branding.hotelName.trim().charAt(0).toUpperCase()}
                </Typography>
              ) : (
                <ApartmentIcon sx={{ fontSize: { md: 120, lg: 140 }, color: 'rgba(255,255,255,0.92)' }} />
              )}
            </Box>
          )}

          {/* Bottom — PMS label */}
          <Box sx={{ position: 'relative', zIndex: 1, width: '100%' }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.25)', width: '70%', mx: 'auto', mb: 2 }} />
            <Typography sx={{ letterSpacing: '0.22em', fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
              PROPERTY MANAGEMENT SYSTEM
            </Typography>
          </Box>
        </Box>

        {/* ---------- Form panel ---------- */}
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { xs: 3.5, sm: 5 },
            // The CLEAR glass fill the app's cards use — see-through, with the
            // diagonal mirror sheen on top; blur+saturate carries legibility.
            backgroundColor: `var(--app-glass-fill, ${isDark ? 'rgba(22,26,34,0.22)' : 'rgba(255,255,255,0.14)'})`,
            backgroundImage: 'var(--app-glass-sheen)',
            backdropFilter: 'var(--app-blur-strong, blur(20px))',
            WebkitBackdropFilter: 'var(--app-blur-strong, blur(20px))',
            borderLeft: { md: 'var(--app-glass-border, 1px solid rgba(255,255,255,0.25))' },
            overflow: 'hidden',
          }}
        >
          {/* faint mandala accent behind the form */}
          <Mandala
            size={340}
            sx={{
              bottom: -90,
              right: -90,
              color: 'rgba(var(--app-primary-rgb),0.06)',
            }}
          />

          <MotionBox
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
            sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, mx: 'auto' }}
          >
            <MotionBox
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}
            >
              {branding.hotelName && (
                <Typography
                  sx={{
                    display: { xs: 'block', md: 'none' },
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    color: 'var(--app-primary)',
                    textAlign: 'center',
                    mb: 1,
                  }}
                >
                  {branding.hotelName}
                </Typography>
              )}
              <Typography
                component="h1"
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary', textAlign: 'center' }}
              >
                {needsSetup ? 'Create Admin Account' : 'Welcome Back'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
                {needsSetup
                  ? 'First-time setup — no users exist yet. This creates the owner account.'
                  : 'Sign in to continue to your dashboard'}
              </Typography>
            </MotionBox>

            {(error || submitError) && (
              <MotionBox variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error || submitError}
                </Alert>
              </MotionBox>
            )}

            {/* A login saved by the first version of "Remember me" kept the
                password readable on this device. It was cleared on sight — say
                so, rather than letting it look like the feature forgot them. */}
            {remembered?.migrated && !needsSetup && (
              <MotionBox variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  Your saved password was cleared for safety. Sign in once, tick
                  Remember me and choose a PIN — after that only that PIN can unlock it.
                </Alert>
              </MotionBox>
            )}

            {needsSetup ? (
            <Box component="form" onSubmit={handleSetupSubmit} noValidate>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  margin="normal" required fullWidth
                  label="First name" name="firstName" autoFocus
                  value={setupData.firstName} onChange={handleSetupChange}
                  error={!!setupErrors.firstName} helperText={setupErrors.firstName}
                  disabled={setupSubmitting} sx={plainFieldSx}
                />
                <TextField
                  margin="normal" required fullWidth
                  label="Last name" name="lastName"
                  value={setupData.lastName} onChange={handleSetupChange}
                  error={!!setupErrors.lastName} helperText={setupErrors.lastName}
                  disabled={setupSubmitting} sx={plainFieldSx}
                />
              </Box>
              <TextField
                margin="normal" required fullWidth
                label="Email" name="email" type="email" autoComplete="email"
                value={setupData.email} onChange={handleSetupChange}
                error={!!setupErrors.email} helperText={setupErrors.email}
                disabled={setupSubmitting} sx={plainFieldSx}
              />
              {renderOtp('email')}
              <TextField
                margin="normal" required fullWidth
                label="Phone" name="phone" autoComplete="tel"
                value={setupData.phone}
                onChange={(e) => {
                  // Keep only digits. If a country code is typed/pasted (e.g.
                  // "+91 98765…" or any string longer than 10 digits), keep the
                  // LAST 10 — the +91 shown in the field is display-only.
                  const raw = e.target.value.replace(/\D/g, '');
                  const digits = raw.length > 10 ? raw.slice(-10) : raw;
                  setSetupData((p) => ({ ...p, phone: digits }));
                  if (setupErrors.phone) setSetupErrors((p) => ({ ...p, phone: '' }));
                  if (submitError) setSubmitError('');
                  // Editing the phone invalidates any prior phone verification.
                  setOtp((p) => ({ ...p, phone: { ...OTP_INIT } }));
                }}
                error={!!setupErrors.phone} helperText={setupErrors.phone}
                disabled={setupSubmitting} sx={fieldSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography
                          component="span"
                          sx={{
                            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
                            fontWeight: 600,
                            userSelect: 'none',
                            pr: 0.5,
                            borderRight: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(30,41,59,0.18)',
                            lineHeight: 1.6,
                          }}
                        >
                          +91
                        </Typography>
                      </InputAdornment>
                    ),
                  },
                  // No maxLength: a pasted "+91 …" must reach onChange intact so
                  // the country code can be stripped; the controlled value keeps
                  // it at 10 digits anyway.
                  htmlInput: { inputMode: 'numeric' },
                }}
              />
              {renderOtp('phone')}
              <TextField
                margin="normal" required fullWidth
                label="Username" name="username" autoComplete="username"
                value={setupData.username} onChange={handleSetupChange}
                error={!!setupErrors.username} helperText={setupErrors.username}
                disabled={setupSubmitting} sx={fieldSx}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon sx={{ color: 'var(--app-primary)' }} />
                    </InputAdornment>
                  ),
                } }}
              />
              <TextField
                margin="normal" required fullWidth
                label="Password" name="password" autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={setupData.password} onChange={handleSetupChange}
                error={!!setupErrors.password} helperText={setupErrors.password || 'At least 6 characters'}
                disabled={setupSubmitting} sx={fieldSx}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" tabIndex={-1}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                } }}
              />
              <TextField
                margin="normal" required fullWidth
                label="Confirm password" name="confirm" autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={setupData.confirm} onChange={handleSetupChange}
                error={!!setupErrors.confirm} helperText={setupErrors.confirm}
                disabled={setupSubmitting} sx={fieldSx}
                slotProps={{ input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
                    </InputAdornment>
                  ),
                } }}
              />
              {(!otp.email.verified || !otp.phone.verified) && (
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2.5, mb: -1, color: 'text.secondary' }}>
                  Verify your email and phone to continue.
                </Typography>
              )}
              <Button
                type="submit" fullWidth variant="contained" size="large"
                disabled={setupSubmitting || !otp.email.verified || !otp.phone.verified}
                sx={{
                  mt: 3, py: 1.4, borderRadius: 2.5, fontWeight: 700, fontSize: '1.05rem',
                  textTransform: 'none', background: 'var(--app-primary)',
                  boxShadow: '0 10px 24px rgba(var(--app-primary-rgb),0.35)',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  '&:hover': {
                    boxShadow: '0 14px 30px rgba(var(--app-primary-rgb),0.45)',
                    transform: 'translateY(-1px)',
                  },
                  '&.Mui-disabled': { background: 'rgba(var(--app-primary-rgb),0.4)', color: 'rgba(255,255,255,0.8)' },
                }}
              >
                {setupSubmitting ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Create Admin Account'}
              </Button>
            </Box>
            ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="username"
                  label="Username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  value={formData.username}
                  onChange={handleChange}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  disabled={loading}
                  sx={fieldSx}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={{ color: 'var(--app-primary)' }} />
                        </InputAdornment>
                      ),
                    }
                  }}
                />
              </MotionBox>

              {mode === 'pin' ? (
              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="pin"
                  label="PIN"
                  type={showPin ? 'text' : 'password'}
                  id="pin"
                  autoFocus
                  value={pin}
                  onChange={handlePinChange}
                  error={!!pinError}
                  helperText={pinError || 'Unlocks the password saved on this device.'}
                  disabled={loading || pinBusy}
                  sx={fieldSx}
                  slotProps={{
                    htmlInput: { inputMode: 'numeric', autoComplete: 'off', maxLength: 6 },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="show the PIN you are typing"
                            onClick={() => setShowPin((s) => !s)}
                            edge="end"
                            tabIndex={-1}
                          >
                            {showPin ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  }}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {/* The old eye, now behind the PIN: the saved password is only
                      readable by someone who can unlock it. */}
                  <Button
                    size="small"
                    onClick={revealSavedPassword}
                    disabled={loading || pinBusy}
                    startIcon={<Visibility fontSize="small" />}
                    sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--app-primary)' }}
                  >
                    Show saved password
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    size="small"
                    onClick={() => fallBackToPassword()}
                    disabled={loading || pinBusy}
                    sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
                  >
                    Use password
                  </Button>
                  <Button
                    size="small"
                    onClick={() => fallBackToPassword({ forget: true })}
                    disabled={loading || pinBusy}
                    sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
                  >
                    Forget this device
                  </Button>
                </Box>
              </MotionBox>
              ) : (
              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  disabled={loading}
                  sx={fieldSx}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword((s) => !s)}
                            edge="end"
                            tabIndex={-1}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  }}
                />
              </MotionBox>
              )}

              {mode === 'password' && rememberSupported && (
              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <FormControlLabel
                  sx={{ mt: 1, ml: 0.5, '& .MuiFormControlLabel-label': { fontSize: 14.5, fontWeight: 500 } }}
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => {
                        setRememberMe(e.target.checked);
                        setPinError('');
                        // Unticking forgets the saved sign-in straight away —
                        // waiting for the next successful login would leave the
                        // password on a machine someone just said not to keep it on.
                        if (!e.target.checked) {
                          clearRemembered();
                          setRemembered(null);
                          setPin('');
                        }
                      }}
                      disabled={loading}
                      sx={{ color: 'var(--app-primary)', '&.Mui-checked': { color: 'var(--app-primary)' } }}
                    />
                  }
                  label="Remember me on this device"
                />
                {rememberMe && (
                  <TextField
                    margin="dense"
                    fullWidth
                    name="new-pin"
                    label="Create a PIN"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={handlePinChange}
                    error={!!pinError}
                    helperText={pinError || 'A 4-6 digit PIN (6 is safer). Only this PIN can unlock the saved password — nobody can read it without it, so pick one you will remember.'}
                    disabled={loading}
                    sx={fieldSx}
                    slotProps={{
                      htmlInput: { inputMode: 'numeric', autoComplete: 'off', maxLength: 6 },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="show PIN"
                              onClick={() => setShowPin((s) => !s)}
                              edge="end"
                              tabIndex={-1}
                            >
                              {showPin ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                )}
              </MotionBox>
              )}

              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || pinBusy}
                  sx={{
                    mt: 1.5,
                    py: 1.4,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    textTransform: 'none',
                    background: 'var(--app-primary)',
                    boxShadow: '0 10px 24px rgba(var(--app-primary-rgb),0.35)',
                    transition: 'transform .15s ease, box-shadow .15s ease',
                    '&:hover': {
                      boxShadow: '0 14px 30px rgba(var(--app-primary-rgb),0.45)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  {(loading || pinBusy)
                    ? <CircularProgress size={24} sx={{ color: '#fff' }} />
                    : (mode === 'pin' ? 'Unlock & Sign In' : 'Sign In')}
                </Button>
              </MotionBox>
            </Box>
            )}

            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'text.secondary' }}
            >
              © {new Date().getFullYear()} {branding.hotelName || 'Property Management System'}. All rights reserved.
            </Typography>
          </MotionBox>
        </Box>
      </MotionBox>
    </Box>
  );
};

export default Login;
