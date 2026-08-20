import React, { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, LinearProgress } from '@mui/material';

/**
 * FpsMeter — live frame-rate readout for the Performance settings.
 *
 * The point of this control is feedback: the performance switches change how
 * much work the browser does per frame, and that is invisible unless you can
 * watch the number move. Toggling "Glass blur" while a list is open should
 * visibly shift this readout.
 *
 * It counts real animation frames, so it measures exactly what the user feels.
 * A browser only schedules frames when something needs painting, so an idle
 * page can legitimately read low; `stress` keeps a cheap element animating so
 * the number reflects rendering capacity rather than idleness.
 */

// A frame budget of 16.7ms is 60fps. These thresholds describe how the app
// feels rather than the raw number: below ~30fps scrolling reads as juddering.
const gradeFor = (fps) => {
  if (fps >= 55) return { label: 'Smooth', color: '#10B981' };
  if (fps >= 40) return { label: 'Good', color: '#84CC16' };
  if (fps >= 25) return { label: 'Choppy', color: '#F59E0B' };
  return { label: 'Laggy', color: '#EF4444' };
};

const FpsMeter = ({ stress = true, height = 44 }) => {
  const [fps, setFps] = useState(null);
  const [low, setLow] = useState(null);
  const frames = useRef(0);
  const since = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    let cancelled = false;
    since.current = performance.now();
    frames.current = 0;

    const loop = (now) => {
      if (cancelled) return;
      frames.current += 1;
      const elapsed = now - since.current;
      // Report roughly twice a second: often enough to feel live, long enough
      // for the average to be stable.
      if (elapsed >= 500) {
        const value = Math.round((frames.current * 1000) / elapsed);
        setFps(value);
        // Track the worst half-second seen, which is what a user actually
        // notices — a mean of 50fps with dips to 12 still feels broken.
        setLow((prev) => (prev == null ? value : Math.min(prev, value)));
        frames.current = 0;
        since.current = now;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const grade = gradeFor(fps ?? 60);
  const pct = Math.min(100, ((fps ?? 0) / 60) * 100);

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: grade.color }}>
          {fps == null ? '—' : fps}
        </Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>fps</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: grade.color, ml: 0.5 }}>
          {fps == null ? '' : grade.label}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {low != null && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            worst {low} fps
          </Typography>
        )}
      </Stack>

      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(148,163,184,0.22)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: grade.color,
            borderRadius: 4,
            // No transition — this bar is the measurement, and animating it
            // would add exactly the kind of work it is trying to report on.
            transition: 'none',
          },
        }}
      />

      {stress && (
        <>
          <style>{`
            @keyframes fpsProbeSpin { to { transform: rotate(360deg); } }
          `}</style>
          {/* Keeps frames scheduled so the reading reflects rendering capacity
              rather than an idle page. Deliberately tiny and transform-only. */}
          <Box
            aria-hidden="true"
            sx={{
              width: 8,
              height: 8,
              mt: 1,
              borderRadius: '2px',
              opacity: 0.35,
              background: 'var(--app-primary, #6366F1)',
              animation: 'fpsProbeSpin 1.2s linear infinite',
            }}
          />
        </>
      )}

      <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
        Live frame rate. Change a setting below and watch this move — 60 is the
        display maximum, under 30 is what reads as lag.
      </Typography>
      <Box sx={{ height: height - 44 }} />
    </Box>
  );
};

export default FpsMeter;
