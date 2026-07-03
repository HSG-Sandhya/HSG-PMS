import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

// Animated analog count-up clock for table occupancy (presentational).
//
// Accuracy: the hands are driven by *continuous* CSS animations whose phase is
// locked to the real occupancy start (`startMs`) via a negative animation-delay,
// so they sweep smoothly at the true rate instead of chasing a once-a-second
// tick. The digital read-out renders the `elapsed` seconds supplied by the
// parent (which ticks once a second), so dial and digits always agree.

const RED = '#EF4444';
const RED_DEEP = '#F43F5E';
const SIZE = 124;
const CC = SIZE / 2; // centre

const pad = (n) => String(Math.floor(n)).padStart(2, '0');

// Pre-computed tick geometry (60 ticks, every 5th is a major mark).
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180;
  const major = i % 5 === 0;
  const rOut = CC - 7;
  const rIn = CC - (major ? 16 : 11);
  return {
    x1: CC + rOut * Math.sin(a),
    y1: CC - rOut * Math.cos(a),
    x2: CC + rIn * Math.sin(a),
    y2: CC - rIn * Math.cos(a),
    major,
  };
});

const ARC_R = CC - 6;
const ARC_LEN = 2 * Math.PI * ARC_R;

// One shared "full revolution" keyframe; each hand re-uses it at a different
// duration. translateX(-50%) keeps the bar centred on the pivot while it spins.
const SPIN = {
  '@keyframes ocSpin': {
    from: { transform: 'translateX(-50%) rotate(0deg)' },
    to: { transform: 'translateX(-50%) rotate(360deg)' },
  },
};

const OccupiedClock = ({ startMs, elapsed = 0 }) => {
  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;

  // Seconds elapsed at first paint — fixed for the lifetime of this clock so the
  // animation-delay stays constant and the CSS animations never restart/jump.
  const delaySec = useMemo(() => Math.max(0, (Date.now() - startMs) / 1000), [startMs]);
  const delay = `-${delaySec}s`;

  // A hand: a rounded bar pinned to the centre, spun by the shared keyframe.
  const hand = (length, width, background, durationSec, z, glow) => ({
    position: 'absolute',
    left: '50%',
    bottom: '50%',
    width,
    height: length,
    borderRadius: '999px',
    background,
    transformOrigin: '50% 100%',
    zIndex: z,
    boxShadow: glow,
    ...SPIN,
    animation: `ocSpin ${durationSec}s linear infinite`,
    animationDelay: delay,
    willChange: 'transform',
  });

  return (
    <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      {/* live "occupied for" label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%', background: RED,
          '@keyframes ocLive': {
            '0%': { boxShadow: `0 0 0 0 ${RED}99` },
            '70%': { boxShadow: `0 0 0 5px ${RED}00` },
            '100%': { boxShadow: `0 0 0 0 ${RED}00` },
          },
          animation: 'ocLive 1.4s infinite',
        }} />
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1.5px', color: RED, textTransform: 'uppercase' }}>
          Occupied for
        </Typography>
      </Box>

      {/* analog dial */}
      <Box sx={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* glass face with a soft breathing glow */}
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 28%, rgba(255,255,255,0.16), rgba(36,10,14,0.55) 62%, rgba(20,4,8,0.7))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${RED}40`,
          '@keyframes ocBreath': {
            '0%,100%': { boxShadow: `inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -8px 18px ${RED}1a, 0 0 0 1px ${RED}26, 0 6px 20px ${RED}26` },
            '50%': { boxShadow: `inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -8px 18px ${RED}1a, 0 0 0 1px ${RED}4d, 0 10px 30px ${RED}40` },
          },
          animation: 'ocBreath 3.4s ease-in-out infinite',
        }} />

        {/* ticks + glowing seconds sweep arc (SVG for crisp alignment) */}
        <Box
          component="svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="ocArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={RED} />
              <stop offset="100%" stopColor={RED_DEEP} />
            </linearGradient>
          </defs>
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? `${RED}e6` : `${RED}59`}
              strokeWidth={t.major ? 2.4 : 1.3}
              strokeLinecap="round"
            />
          ))}
          {/* faint full track */}
          <circle cx={CC} cy={CC} r={ARC_R} fill="none" stroke={`${RED}26`} strokeWidth={2.5} />
          {/* live seconds arc — fills 0→60s each minute via CSS, phase-locked */}
          <Box
            component="circle"
            cx={CC} cy={CC} r={ARC_R}
            fill="none"
            stroke="url(#ocArcGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            transform={`rotate(-90 ${CC} ${CC})`}
            sx={{
              filter: `drop-shadow(0 0 3px ${RED})`,
              '@keyframes ocArc': {
                from: { strokeDashoffset: ARC_LEN },
                to: { strokeDashoffset: 0 },
              },
              animation: 'ocArc 60s linear infinite',
              animationDelay: delay,
            }}
          />
        </Box>

        {/* hands (continuous CSS sweep, phase-locked to start) */}
        <Box sx={hand(CC * 0.44, 4.5, 'linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.6))', 43200, 4, '0 0 4px rgba(0,0,0,0.35)')} />
        <Box sx={hand(CC * 0.64, 3, 'linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.55))', 3600, 5, '0 0 4px rgba(0,0,0,0.35)')} />
        {/* second hand with a glowing orbiting tip */}
        <Box sx={{
          ...hand(CC * 0.76, 1.6, RED, 60, 6, `0 0 8px ${RED}cc`),
          '&::after': {
            content: '""',
            position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
            width: 7, height: 7, borderRadius: '50%',
            background: '#fff', boxShadow: `0 0 8px ${RED}, 0 0 3px ${RED}`,
          },
        }} />

        {/* centre hub */}
        <Box sx={{
          position: 'absolute', left: '50%', top: '50%', zIndex: 7,
          width: 11, height: 11, borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, #fff 32%, ${RED} 72%)`,
          '@keyframes ocHub': {
            '0%,100%': { boxShadow: `0 0 5px ${RED}, 0 0 0 1.5px rgba(255,255,255,0.5)` },
            '50%': { boxShadow: `0 0 12px ${RED}, 0 0 0 2.5px rgba(255,255,255,0.65)` },
          },
          animation: 'ocHub 1.5s ease-in-out infinite',
        }} />

        {/* digital read-out window (above the hands, like a date window) */}
        <Box sx={{
          position: 'absolute', left: '50%', top: '70%', zIndex: 8,
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center',
          px: 1, py: 0.4, borderRadius: '8px',
          background: 'rgba(12,1,3,0.72)',
          border: `1px solid ${RED}59`,
          boxShadow: `inset 0 0 8px ${RED}33, 0 2px 6px rgba(0,0,0,0.35)`,
        }}>
          {[pad(hh), pad(mm), pad(ss)].map((val, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <Typography component="span" sx={{
                  fontFamily: '"JetBrains Mono", monospace', fontWeight: 800,
                  fontSize: '0.64rem', color: `${RED}cc`, mx: '1.5px', lineHeight: 1,
                  '@keyframes ocBlink': { '50%': { opacity: 0.2 } },
                  animation: 'ocBlink 1s step-end infinite',
                }}>:</Typography>
              )}
              <Typography component="span" sx={{
                fontFamily: '"JetBrains Mono", monospace', fontWeight: 800,
                fontSize: '0.72rem', lineHeight: 1, color: '#fff',
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 6px ${RED}, 0 0 2px ${RED}`,
              }}>{val}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default OccupiedClock;
