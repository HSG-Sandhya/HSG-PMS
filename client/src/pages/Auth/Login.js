import { useState } from 'react';
import {
  Box, Button, TextField, Typography, Alert, CircularProgress,
  IconButton, InputAdornment, Divider, useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../../contexts/AuthContext';

const MotionBox = motion.create(Box);

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
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const { login, loading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const fieldSx = makeFieldSx(isDark);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => ({ ...p, [name]: '' }));
    if (submitError) setSubmitError('');
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
    if (validateForm()) {
      try {
        await login(formData);
      } catch {
        // Expected auth failures (wrong password, etc.) are surfaced via the
        // AuthContext `error` state. This only catches unexpected throws.
        setSubmitError('Something went wrong. Please try again.');
      }
    }
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

          {/* Top — brand name */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { md: '1.7rem', lg: '2rem' },
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
                lineHeight: 1.1,
                mb: 1,
                textShadow: '0 2px 16px rgba(0,0,0,0.18)',
              }}
            >
              Hotel Sandhya Grand
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 16 }}>
              &amp; Marriage Hall — where every stay feels grand.
            </Typography>
          </Box>

          {/* Middle — big logo */}
          <Box
            component="img"
            src="/images/sandhya-logo.png"
            alt="Hotel Sandhya Grand"
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
              <Typography
                component="h1"
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: '-0.01em', color: 'text.primary' }}
              >
                Welcome Back
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Sign in to continue to your dashboard
              </Typography>
            </MotionBox>

            {(error || submitError) && (
              <MotionBox variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error || submitError}
                </Alert>
              </MotionBox>
            )}

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

              <MotionBox variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    mt: 3,
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
                  {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Sign In'}
                </Button>
              </MotionBox>
            </Box>

            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'text.secondary' }}
            >
              © {new Date().getFullYear()} Hotel Sandhya Grand. All rights reserved.
            </Typography>
          </MotionBox>
        </Box>
      </MotionBox>
    </Box>
  );
};

export default Login;
