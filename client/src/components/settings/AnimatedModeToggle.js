import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * AnimatedModeToggle — a day-cycle stepper + darkness leveller in one control.
 *
 * The track is a miniature sky running morning → noon → sunset → twilight →
 * evening → night → midnight. Darkness comes in six steps (0/20/40/60/80/100%)
 * and each CLICK advances one step through the cycle:
 *   Day → Sunset 0% → Twilight 20% → Evening 40% → Night 60% → Deep night 80%
 *   → Midnight 100% → back to Day.
 * The knob can also be DRAGGED: release in the left day zone for light mode,
 * or anywhere past dusk to snap to the nearest 20% step.
 *
 * Props:
 *  - value: boolean dark-mode flag (controlled)
 *  - darkness: current darkness level 0–100 (controlled)
 *  - onScrub(level): live while dragging inside the night zone (throttled)
 *  - onCommit({ dark, level }): click or drag release — level null for light
 */
// Star horizontal positions are stored as fractions of the track width so they
// spread proportionally when the toggle stretches to fill its container.
const STARS = [
  { fx: 0.667, cy: 12, r: 1.1, d: 0 },
  { fx: 0.773, cy: 24, r: 0.8, d: 0.4 },
  { fx: 0.720, cy: 33, r: 1.3, d: 0.8 },
  { fx: 0.853, cy: 14, r: 0.9, d: 1.2 },
  { fx: 0.587, cy: 20, r: 0.7, d: 0.6 },
  { fx: 0.467, cy: 13, r: 0.8, d: 1.6 },
];

const RAYS = Array.from({ length: 8 }, (_, i) => i * 45);

const H = 46;
// A round sun/moon knob that slides the full width of the track, left → right.
const KNOB = 36;
const PAD = 5;
// Fallback width used before the container is measured (also the minimum).
const MIN_W = 150;
// The seven committed phases are spread EVENLY across the whole track so the
// handle walks steadily left→right through every phase:
//   Day 0 · Sunset 1/6 · Twilight 2/6 · Evening 3/6 · Night 4/6 · Deep 5/6 ·
//   Midnight 6/6. Day owns the far-left edge; the six darkness levels take the
//   remaining stops. Releasing a drag left of DAY_MAX snaps back to light mode.
const DARK_LO = 1 / 6; // Sunset (0% darkness) sits one step in from the left
const DAY_MAX = DARK_LO / 2; // half-way between Day and Sunset → the light zone

// Darkness is stepped, not continuous: 0 / 20 / 40 / 60 / 80 / 100%.
const STEP = 20;

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const quantize = (lvl) => Math.min(100, Math.max(0, Math.round((Number(lvl) || 0) / STEP) * STEP));
const levelToP = (lvl) => DARK_LO + (clamp01((Number(lvl) || 0) / 100)) * (1 - DARK_LO);
const pToLevel = (p) => quantize(clamp01((p - DARK_LO) / (1 - DARK_LO)) * 100);

const SPRING = { type: 'spring', stiffness: 420, damping: 34 };

const AnimatedModeToggle = ({ value, darkness = 60, onScrub, onCommit }) => {
  const dark = Boolean(value);
  const level = quantize(darkness);

  // Measure the rendered track so the knob travel + sky phases fill whatever
  // width the parent gives us. We measure a plain wrapper div (reliable ref)
  // rather than the motion.button, and read the width synchronously up-front so
  // the knob spans the full width on the very first paint — not just after the
  // ResizeObserver's first async callback.
  const trackRef = useRef(null);
  const [trackW, setTrackW] = useState(MIN_W);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setTrackW(Math.max(MIN_W, w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geometry derived from the measured width — recomputed each render so the
  // motion transforms below always map onto the current track.
  const W = trackW;
  const X_MIN = PAD;
  const X_MAX = W - KNOB - PAD;
  const RANGE = X_MAX - X_MIN;
  const pToX = (p) => X_MIN + p * RANGE;
  const xToP = (xv) => clamp01((xv - X_MIN) / RANGE);

  const restingX = dark ? pToX(levelToP(level)) : X_MIN;

  const x = useMotionValue(restingX);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastEmitRef = useRef(0);

  // Follow the controlled props whenever we're not mid-drag, so external
  // changes (presets, server reload) sweep the sky to the right phase.
  useEffect(() => {
    if (draggingRef.current) return undefined;
    const controls = animate(x, restingX, SPRING);
    return () => controls.stop();
  }, [restingX, x]);

  // The whole scene is driven by the knob position: framer interpolates the
  // gradient strings, so a click that springs the handle one step over sweeps
  // the sky through every phase in between. The seven phases sit at evenly
  // spaced positions (0, 1/6 … 6/6), so the handle travels the full width of
  // the track from day at the left edge to midnight at the right edge.
  const sky = useTransform(
    x,
    [pToX(0), pToX(1 / 6), pToX(2 / 6), pToX(3 / 6), pToX(4 / 6), pToX(5 / 6), pToX(1)],
    [
      'linear-gradient(135deg, #fde68a 0%, #93c5fd 55%, #60a5fa 100%)', // day — golden morning sky
      'linear-gradient(135deg, #fcd34d 0%, #fb923c 55%, #f43f5e 100%)', // sunset (0%)
      'linear-gradient(135deg, #fb7185 0%, #c084fc 55%, #7c3aed 100%)', // twilight (20%)
      'linear-gradient(135deg, #818cf8 0%, #4f46e5 55%, #312e81 100%)', // evening (40%)
      'linear-gradient(135deg, #334155 0%, #1e293b 55%, #172033 100%)', // night (60%)
      'linear-gradient(135deg, #1e293b 0%, #0f172a 55%, #0a0f1f 100%)', // deep night (80%)
      'linear-gradient(135deg, #0f172a 0%, #060912 55%, #03040a 100%)', // midnight (100%)
    ],
  );
  const sunOpacity = useTransform(x, [pToX(0.08), pToX(0.20)], [1, 0]);
  const sunDip = useTransform(x, [pToX(0.04), pToX(0.18)], [0, 16]); // sun sinks toward sunset
  const moonOpacity = useTransform(x, [pToX(1 / 6), pToX(2 / 6)], [0, 1]);
  const moonRise = useTransform(x, [pToX(1 / 6), pToX(0.42)], [14, 0]); // moon climbs
  const starsOpacity = useTransform(x, [pToX(2 / 6), pToX(1)], [0, 1]);
  const cloudOpacity = useTransform(x, [pToX(0.02), pToX(0.14)], [0.9, 0]);

  const handleDrag = () => {
    const p = xToP(x.get());
    if (!onScrub || p < DAY_MAX) return;
    const now = Date.now();
    if (now - lastEmitRef.current < 90) return; // ~11 updates/s keeps the live preview cheap
    lastEmitRef.current = now;
    onScrub(pToLevel(p));
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
    const p = xToP(x.get());
    if (p < DAY_MAX) {
      onCommit?.({ dark: false, level: null });
      animate(x, X_MIN, SPRING); // settle on sunrise
    } else {
      const snapped = pToLevel(p);
      onCommit?.({ dark: true, level: snapped });
      animate(x, pToX(levelToP(snapped)), SPRING); // snap onto the step
    }
  };

  const handleClick = () => {
    // A drag fires the button's click on release — swallow it.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    // Each click steps once around the day cycle:
    // Day → 0% → 20% → 40% → 60% → 80% → 100% → Day …
    if (!dark) {
      onCommit?.({ dark: true, level: 0 });
    } else if (level >= 100) {
      onCommit?.({ dark: false, level: null });
    } else {
      onCommit?.({ dark: true, level: level + STEP });
    }
  };

  return (
    <div ref={trackRef} style={{ width: '100%' }}>
    <motion.button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark
        ? `Dark mode at ${level}% darkness — click to step 20% darker (midnight wraps back to day), or drag the knob`
        : 'Light mode — click to step into dusk, or drag the knob toward night'}
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      style={{
        position: 'relative',
        width: '100%',
        height: H,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        borderRadius: 999,
        overflow: 'hidden',
        outline: 'none',
        boxShadow: dark
          ? 'inset 0 2px 8px rgba(0,0,0,0.55), 0 4px 16px -6px rgba(15,23,42,0.6)'
          : 'inset 0 2px 8px rgba(2,132,199,0.35), 0 4px 16px -6px rgba(56,189,248,0.5)',
      }}
    >
      {/* Sky — phase follows the knob */}
      <motion.div style={{ position: 'absolute', inset: 0, background: sky }} />

      {/* Stars — fade in past twilight, then twinkle */}
      <motion.svg
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, opacity: starsOpacity, pointerEvents: 'none' }}
      >
        {STARS.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.fx * W}
            cy={s.cy}
            r={s.r}
            fill="#e2e8f0"
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
            transition={{ duration: 2.4, delay: s.d, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </motion.svg>

      {/* Cloud — morning only, melts away at dusk */}
      <motion.div
        animate={{ x: [6, 10, 6] }}
        transition={{ x: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
        style={{
          position: 'absolute',
          right: 14,
          top: 13,
          width: 22,
          height: 8,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '8px 2px 0 -1px rgba(255,255,255,0.85), -7px 1px 0 -2px rgba(255,255,255,0.8)',
          opacity: cloudOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Knob — a round sun/moon that slides the full width, cross-fading at dusk */}
      <motion.div
        drag="x"
        dragConstraints={{ left: X_MIN, right: X_MAX }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => { draggingRef.current = true; movedRef.current = true; }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          position: 'absolute',
          top: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          x,
          cursor: 'grab',
          touchAction: 'none',
        }}
        whileDrag={{ cursor: 'grabbing', scale: 1.06 }}
      >
        {/* Sun — sinks and fades as the knob heads into dusk */}
        <motion.div style={{ position: 'absolute', inset: 0, opacity: sunOpacity, y: sunDip, pointerEvents: 'none' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {RAYS.map((deg) => (
              <div
                key={deg}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 2.5,
                  height: 6,
                  borderRadius: 2,
                  background: '#fde68a',
                  transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-20px)`,
                }}
              />
            ))}
          </motion.div>
          <div
            style={{
              position: 'absolute',
              inset: 5,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fffbe6, #fbbf24 70%, #f59e0b)',
              boxShadow: '0 0 12px 2px rgba(251,191,36,0.6)',
            }}
          />
        </motion.div>

        {/* Moon — rises out of the dusk as the sun goes down */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #f8fafc, #cbd5e1 75%, #94a3b8)',
            boxShadow: '0 0 12px 2px rgba(226,232,240,0.45), inset -4px -3px 6px rgba(100,116,139,0.45)',
            opacity: moonOpacity,
            y: moonRise,
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'absolute', top: 8, left: 9, width: 6, height: 6, borderRadius: '50%', background: 'rgba(100,116,139,0.35)' }} />
          <div style={{ position: 'absolute', top: 17, left: 18, width: 4, height: 4, borderRadius: '50%', background: 'rgba(100,116,139,0.3)' }} />
          <div style={{ position: 'absolute', top: 6, left: 19, width: 3, height: 3, borderRadius: '50%', background: 'rgba(100,116,139,0.28)' }} />
        </motion.div>
      </motion.div>
    </motion.button>
    </div>
  );
};

export default AnimatedModeToggle;
