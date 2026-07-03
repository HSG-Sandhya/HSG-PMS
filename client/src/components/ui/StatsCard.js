// Add shouldForwardProp to filter out custom props
import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton, keyframes } from '@mui/material';
import { motion, useMotionValue, animate } from 'framer-motion';
import { styled } from '@mui/material/styles';
import { ArrowUpwardOutlined, ArrowDownwardOutlined, ErrorOutlined } from '@mui/icons-material';
import { useSettings } from '../../contexts/SettingsContext';

const EASE = [0.22, 1, 0.36, 1];

// Animated count-up — used when `value` is purely numeric. Falls back
// to rendering the raw value (e.g. "12/23" room ratios, currency strings)
// when the input isn't a clean number.
const AnimatedNumber = ({ raw, format }) => {
  const numericMatch = typeof raw === 'string' || typeof raw === 'number'
    ? String(raw).match(/^-?[\d,]+(?:\.\d+)?$/)
    : null;
  const numeric = numericMatch ? Number(String(raw).replace(/,/g, '')) : NaN;
  const mv = useMotionValue(0);
  const [display, setDisplay] = React.useState(() => (Number.isFinite(numeric) ? '0' : String(raw)));

  React.useEffect(() => {
    if (!Number.isFinite(numeric)) {
      setDisplay(String(raw ?? ''));
      return undefined;
    }
    const controls = animate(mv, numeric, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (latest) => setDisplay(format ? format(latest) : Math.round(latest).toLocaleString('en-IN')),
    });
    return () => controls.stop();
  }, [numeric, raw, format, mv]);

  return <>{display}</>;
};

// Soft animated shimmer that drifts across the top of each card.
const shimmerKf = keyframes`
  0%   { transform: translateX(-100%); opacity: 0; }
  20%  { opacity: 0.7; }
  100% { transform: translateX(100%); opacity: 0; }
`;

// Filter out custom props to prevent them from being passed to DOM elements
const _StyledBox = styled(Box, {
  shouldForwardProp: (prop) => !['trend', 'isPositive'].includes(prop),
})(() => ({}));

const _AnimatedIcon = styled(motion.div)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const StatsChip = styled('div', {
  shouldForwardProp: (prop) => !['color', 'isPositive'].includes(prop),
})(({ color, isPositive }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: isPositive || color === 'up' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
  color: isPositive || color === 'up' ? '#4caf50' : '#f44336',
}));

const StatsCard = ({ 
  title, 
  value, 
  subtext, 
  icon, 
  _bgGradient, 
  trend, 
  trendValue, 
  delay = 0,
  isLoading = false,
  hasError = false, 
}) => {
  const { settings } = useSettings();
  const isDarkMode = settings?.theme?.darkMode;
  const cardStyle = settings?.theme?.cardStyle || 'rounded';
  const accentColor = settings?.theme?.accentColor || '#F59E42';
  const fontFamily = settings?.theme?.fontFamily;
  const fontSize = settings?.theme?.fontSize;
  const isPositive = trend === 'up';
  
  // Handle loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay }}
      >
        <Card sx={{ 
          height: '100%',
          background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '24px',
          boxShadow: '0 10px 30px 0 rgba(31, 38, 135, 0.1)',
        }}>
          <CardContent sx={{ p: 3.5 }}>
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="circular" width={52} height={52} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="80%" height={40} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="70%" height={20} />
          </CardContent>
        </Card>
      </motion.div>
    );
  }
  
  // Handle error state
  if (hasError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay }}
      >
        <Card sx={{ 
          height: '100%',
          background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '24px',
          boxShadow: '0 10px 30px 0 rgba(31, 38, 135, 0.1)',
        }}>
          <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ErrorOutlined sx={{ fontSize: 40, mb: 2 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center' }}>
              Unable to load data
            </Typography>
            <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
              Please try again later
            </Typography>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
  
  // Normal state — maximalist tactile card. Falls back to the user's
  // chosen primary / secondary palette via CSS vars when no bgGradient
  // is supplied by the caller.
  const gradient = _bgGradient
    || 'linear-gradient(135deg, rgba(var(--app-primary-rgb, 139, 92, 246), 0.65), rgba(var(--app-secondary-rgb, 236, 72, 153), 0.65))';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.85, delay, ease: EASE }}
      whileHover={{ y: -8, scale: 1.02 }}
      style={{ height: '100%', willChange: 'transform' }}
    >
      <Card sx={{
        height: '100%',
        background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
        backdropFilter: 'var(--app-blur-strong)',
        WebkitBackdropFilter: 'var(--app-blur-strong)',
        border: '1.5px solid rgba(255,255,255,0.18)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: cardStyle === 'rounded' ? '24px' : cardStyle === 'square' ? '0px' : '24px',
        fontFamily,
        fontSize,
        transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
        boxShadow: '0 10px 30px 0 rgba(31, 38, 135, 0.12), var(--app-card-glow)',
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.32)',
          boxShadow: '0 24px 60px -16px rgba(0,0,0,0.35), 0 0 30px rgba(var(--app-primary-rgb, 139, 92, 246), 0.25), var(--app-card-glow)',
        },
        '&:hover .stats-glow': { opacity: 1 },
        '&:hover .stats-corner': { transform: 'translate(0, 0) scale(1.05)', opacity: 0.85 },
      }}>
        {/* Gradient corner bloom — fades in on hover */}
        <Box
          className="stats-corner"
          aria-hidden
          sx={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: gradient,
            filter: 'blur(50px)',
            opacity: 0.6,
            transform: 'translate(10px, -10px) scale(1)',
            transition: 'opacity 0.5s ease, transform 0.6s ease',
            zIndex: 0,
          }}
        />
        {/* Shimmering line that sweeps across the top edge */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
            animation: `${shimmerKf} 4.5s ease-in-out infinite`,
            animationDelay: `${delay * 2}s`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        {/* Glow ring revealed on hover */}
        <Box
          className="stats-glow"
          aria-hidden
          sx={{
            position: 'absolute',
            inset: -1,
            borderRadius: 'inherit',
            opacity: 0,
            transition: 'opacity 0.5s ease',
            background: `linear-gradient(135deg, transparent, transparent), ${gradient}`,
            WebkitMask:
              'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1.5px',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        <CardContent sx={{
          p: 3.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          height: '100%',
          position: 'relative',
          zIndex: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            {icon && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 0.92, rotate: 0 }}
                transition={{ duration: 0.7, delay: delay + 0.1, ease: EASE }}
                whileHover={{ rotate: [0, -6, 6, 0], transition: { duration: 0.6 } }}
                style={{ marginRight: 16, display: 'inline-flex' }}
              >
                {icon}
              </motion.div>
            )}
            <Typography variant="h6" sx={{ fontWeight: 700, color: accentColor, fontFamily, fontSize, opacity: 0.9, textAlign: 'center' }}>{title}</Typography>
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(35,39,47,0.95)',
              fontFamily,
              fontSize: fontSize + 8,
              textAlign: 'center',
              backgroundImage: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
            }}
          >
            <AnimatedNumber raw={value} />
          </Typography>
          {subtext && (
            <Typography
              variant="body2"
              sx={{ color: isDarkMode ? 'rgba(189,189,189,0.8)' : 'rgba(136,136,136,0.8)', fontFamily, fontSize, textAlign: 'center' }}
            >
              {subtext}
            </Typography>
          )}
          {trend && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: delay + 0.4, ease: EASE }}
              >
                <StatsChip color={trend} isPositive={isPositive} style={{
                  backgroundColor: isPositive ? `${accentColor}15` : 'rgba(244,67,54,0.15)',
                  color: isPositive ? accentColor : '#f44336',
                  fontFamily,
                  fontSize,
                  opacity: 0.9,
                }}>
                  {isPositive ? <ArrowUpwardOutlined fontSize="small" /> : <ArrowDownwardOutlined fontSize="small" />}
                  <span style={{ marginLeft: 4 }}>{trendValue}</span>
                </StatsChip>
              </motion.div>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatsCard;