import React, { useEffect, useState } from 'react';
import { Box, keyframes, GlobalStyles } from '@mui/material';
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  animate,
} from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1];

/**
 * Animated count-up that ramps from 0 to `value` over `duration` seconds
 * on first mount and whenever `value` changes. Honors a custom formatter
 * so we can keep the existing currency/percentage rendering.
 */
export const CountUp = ({
  value,
  duration = 1.4,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  style,
  className,
}) => {
  const numeric = Number(value);
  const safeTarget = Number.isFinite(numeric) ? numeric : 0;
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState(() => format(0));

  useEffect(() => {
    const controls = animate(motionVal, safeTarget, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setDisplay(format(latest)),
    });
    return () => controls.stop();
  }, [safeTarget, duration, motionVal, format]);

  // If the consumer passed a non-numeric value (e.g. "12/23"), render it as-is.
  if (!Number.isFinite(numeric)) {
    return <span style={style} className={className}>{value}</span>;
  }
  return <span style={style} className={className}>{display}</span>;
};

/**
 * Big soft floating orb. Multiple instances form the maximalist ambient
 * gradient field behind the dashboard.
 */
const float = keyframes`
  0%   { transform: translate3d(0px, 0px, 0) scale(1); }
  50%  { transform: translate3d(-32px, 28px, 0) scale(1.06); }
  100% { transform: translate3d(0px, 0px, 0) scale(1); }
`;

export const FloatingOrb = ({
  size = 420,
  color = 'rgba(139, 92, 246, 0.35)',
  top,
  left,
  right,
  bottom,
  duration = 18,
  blur = 100,
  delay = 0,
}) => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      top, left, right, bottom,
      width: size,
      height: size,
      borderRadius: '50%',
      pointerEvents: 'none',
      filter: `blur(${blur}px)`,
      background: `radial-gradient(circle at 30% 30%, ${color}, transparent 65%)`,
      animation: `${float} ${duration}s ease-in-out ${delay}s infinite`,
      mixBlendMode: 'screen',
      opacity: 0.85,
      zIndex: 0,
    }}
  />
);

/**
 * Renders a curated set of FloatingOrbs and a faint conic shimmer.
 * Drop once at the top of the dashboard with position absolute.
 */
export const AmbientBackdrop = () => (
  <Box
    aria-hidden
    sx={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 0,
    }}
  >
    {/* Two orbs use the user's primary/secondary palette, two stay as
        ambient warm/cool accents for visual variety. */}
    <FloatingOrb size={520} color="rgba(var(--app-primary-rgb, 139, 92, 246), 0.28)"   top="-8%"   left="-6%"  duration={22} />
    <FloatingOrb size={460} color="rgba(var(--app-secondary-rgb, 236, 72, 153), 0.22)" top="40%"  right="-8%"  duration={26} delay={3} />
    <FloatingOrb size={520} color="rgba(16, 185, 129, 0.18)"                          bottom="-10%" left="20%" duration={28} delay={5} />
    <FloatingOrb size={380} color="rgba(var(--app-accent-rgb, 245, 158, 11), 0.18)"   top="20%"  right="30%"   duration={20} delay={2} blur={120} />
  </Box>
);

/**
 * Thin gradient ribbon at the very top of the viewport that fills with
 * scroll progress. Uses spring smoothing.
 */
export const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 110, damping: 28, restDelta: 0.001 });
  return (
    <motion.div
      style={{
        scaleX,
        transformOrigin: '0% 50%',
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 3,
        background:
          'linear-gradient(90deg, var(--app-primary), var(--app-secondary) 50%, var(--app-accent))',
        zIndex: 1300,
        boxShadow: '0 0 16px rgba(var(--app-primary-rgb, 139, 92, 246), 0.5)',
      }}
    />
  );
};

/**
 * Animated underline that draws from 0 → width on mount.
 * Pair with section headings.
 */
export const DrawnUnderline = ({ width = 56, color = 'var(--app-primary)', delay = 0 }) => (
  <Box sx={{ overflow: 'hidden', display: 'inline-block', mt: 0.75 }}>
    <motion.span
      initial={{ width: 0, opacity: 0 }}
      whileInView={{ width, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      style={{
        display: 'block',
        height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        borderRadius: 2,
      }}
    />
  </Box>
);

/**
 * Endless marquee strip. Doubles content for a seamless loop.
 * Used under the welcome hero as a quick-stats ticker.
 */
const marqueeKf = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

export const Marquee = ({ items = [], speed = 36, darkMode = false }) => {
  const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)';
  const bg = darkMode
    ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 100%)'
    : 'linear-gradient(90deg, rgba(15,23,42,0.03) 0%, rgba(15,23,42,0.06) 50%, rgba(15,23,42,0.03) 100%)';
  const labelColor = darkMode ? 'rgba(255,255,255,0.82)' : 'rgba(15, 23, 42, 0.72)';
  return (
    <Box
      sx={{
        overflow: 'hidden',
        borderTop: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        background: bg,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        py: 1.5,
        maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          animation: `${marqueeKf} ${speed}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {[...items, ...items].map((label, i) => (
          <Box
            key={i}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 4,
              color: labelColor,
              fontSize: '0.78rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--app-primary)', boxShadow: '0 0 12px var(--app-primary)' }} />
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Mouse-following parallax tilt wrapper. Gives big tactile feedback on
 * hero cards. Disabled on touch devices.
 */
export const Tilt = ({ children, max = 8 }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 18 });

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Hidden SVG with reusable gradient & filter defs.
 * Recharts <Bar/Pie/Area/Line> components can reference these by id:
 *   fill="url(#dashGradPrimary)"  filter="url(#dashGlowSoft)"
 *
 * Drop <ChartDefs /> once at the top of the dashboard render.
 */
const Stop = ({ o, c, op = 1 }) => <stop offset={o} stopColor={c} stopOpacity={op} />;
export const ChartDefs = () => (
  <svg
    aria-hidden
    width="0"
    height="0"
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
  >
    <defs>
      {/* Vertical bar gradients */}
      <linearGradient id="dashGradPrimary" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#A78BFA" />
        <Stop o="100%" c="#7C3AED" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradEmerald" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#34D399" />
        <Stop o="100%" c="#059669" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradRose" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#F472B6" />
        <Stop o="100%" c="#DB2777" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradAmber" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#FBBF24" />
        <Stop o="100%" c="#D97706" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradTeal" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#5EEAD4" />
        <Stop o="100%" c="#0D9488" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradSky" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#60A5FA" />
        <Stop o="100%" c="#1D4ED8" op={0.85} />
      </linearGradient>
      <linearGradient id="dashGradCrimson" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#FCA5A5" />
        <Stop o="100%" c="#DC2626" op={0.85} />
      </linearGradient>

      {/* Area gradients — softer fades */}
      <linearGradient id="dashAreaPrimary" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#A78BFA" op={0.75} />
        <Stop o="60%" c="#7C3AED" op={0.25} />
        <Stop o="100%" c="#7C3AED" op={0} />
      </linearGradient>
      <linearGradient id="dashAreaEmerald" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#34D399" op={0.75} />
        <Stop o="60%" c="#10B981" op={0.25} />
        <Stop o="100%" c="#10B981" op={0} />
      </linearGradient>
      <linearGradient id="dashAreaRose" x1="0" y1="0" x2="0" y2="1">
        <Stop o="0%" c="#F472B6" op={0.75} />
        <Stop o="60%" c="#EC4899" op={0.25} />
        <Stop o="100%" c="#EC4899" op={0} />
      </linearGradient>

      {/* Glow filters */}
      <filter id="dashGlowSoft" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="dashGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

/**
 * Global CSS rules for recharts elements — applied once via MUI's
 * <GlobalStyles>. Hover/transition polish for every chart on the page
 * without touching any individual chart.
 */
export const ChartGlobalFx = ({ darkMode = false } = {}) => {
  const tooltipBg = darkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)';
  const tooltipBorder = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  const tooltipText = darkMode ? '#ffffff' : '#1e293b';
  const tooltipShadow = darkMode
    ? '0 18px 48px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--app-primary-rgb, 99, 102, 241), 0.22)'
    : '0 18px 48px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(var(--app-primary-rgb, 99, 102, 241), 0.18)';
  const sectorGlow = darkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.18)';
  return (
  <GlobalStyles
    styles={{
      // Bars: smooth hover lift + brightness, with a colored shadow tied to the user's primary
      '.recharts-bar-rectangle': {
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), filter 0.35s ease',
        transformOrigin: 'bottom center',
        willChange: 'transform, filter',
      },
      '.recharts-bar-rectangle:hover': {
        transform: 'scaleY(1.06) translateY(-2px)',
        filter: 'brightness(1.15) drop-shadow(0 6px 18px rgba(var(--app-primary-rgb, 139, 92, 246), 0.45))',
      },
      // Pie sectors: scale-on-hover with glow
      '.recharts-pie-sector path': {
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), filter 0.35s ease',
        transformOrigin: 'center center',
        transformBox: 'fill-box',
        willChange: 'transform, filter',
      },
      '.recharts-pie-sector:hover path': {
        transform: 'scale(1.04)',
        filter: `brightness(1.15) drop-shadow(0 0 14px ${sectorGlow})`,
      },
      // Tooltips — adapt to current theme mode
      '.recharts-default-tooltip, .recharts-tooltip-wrapper > div': {
        background: `${tooltipBg} !important`,
        border: `1px solid ${tooltipBorder} !important`,
        borderRadius: '14px !important',
        boxShadow: `${tooltipShadow} !important`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        color: `${tooltipText} !important`,
        padding: '10px 14px !important',
        animation: 'dashTipIn 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
      '.recharts-tooltip-label, .recharts-tooltip-item-name, .recharts-tooltip-item-value': {
        color: `${tooltipText} !important`,
      },
      '@keyframes dashTipIn': {
        from: { opacity: 0, transform: 'translateY(6px) scale(0.97)' },
        to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
      // Cartesian grid — subtle animated dash
      '.recharts-cartesian-grid line': {
        opacity: 0.6,
        transition: 'opacity 0.4s ease',
      },
      '.recharts-wrapper:hover .recharts-cartesian-grid line': {
        opacity: 0.9,
      },
      // Lines/Areas: thicker stroke pop on hover
      '.recharts-line .recharts-curve': {
        transition: 'filter 0.35s ease',
      },
      '.recharts-wrapper:hover .recharts-line .recharts-curve, .recharts-wrapper:hover .recharts-area .recharts-curve': {
        filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.45))',
      },
      // Legend hover — slight brighten
      '.recharts-legend-item': {
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        cursor: 'default',
      },
      '.recharts-legend-item:hover': {
        opacity: 0.85,
        transform: 'translateY(-1px)',
      },
      // Active dot pulse for line/area charts
      '.recharts-active-dot circle': {
        animation: 'dashDotPulse 1.6s ease-in-out infinite',
      },
      '@keyframes dashDotPulse': {
        '0%, 100%': { filter: 'drop-shadow(0 0 4px currentColor)' },
        '50%':      { filter: 'drop-shadow(0 0 12px currentColor)' },
      },
    }}
  />
  );
};

/**
 * Greeting text that adapts to the current local hour.
 */
export const greetingFor = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return 'Quiet night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
};
