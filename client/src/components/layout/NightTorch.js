import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * NightTorch — a decorative "flashlight" overlay for dark mode.
 *
 * When active, a soft circle of clarity follows the cursor while the rest of
 * the screen dims, plus a warm amber "street-light" pool pours over whatever
 * the cursor hovers. The light trails the pointer with a little easing and
 * flickers faintly like a real lamp. It's purely cosmetic: pointer-events are
 * disabled so every click passes straight through to the app underneath.
 *
 * Driven entirely from Appearance settings — mounted by AppThemeProvider only
 * when dark mode + the "Night torch" toggle are on and "Reduce motion" is off.
 *
 * `intensity` (0–1) follows the "Darkness level" slider: a softer dark mode
 * gets a gentler veil and lamp, a deeper one a stronger torch.
 */
const NightTorch = ({ active, intensity = 0.6 }) => {
  const rootRef = useRef(null);
  const pos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const target = useRef({ ...pos.current });
  const raf = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    const el = rootRef.current;

    const onMove = (e) => { target.current = { x: e.clientX, y: e.clientY }; };
    const onTouch = (e) => {
      const t = e.touches && e.touches[0];
      if (t) target.current = { x: t.clientX, y: t.clientY };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });

    const tick = () => {
      // Ease toward the cursor so the torch trails smoothly instead of snapping.
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      if (el) {
        el.style.setProperty('--tx', `${pos.current.x}px`);
        el.style.setProperty('--ty', `${pos.current.y}px`);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
      cancelAnimationFrame(raf.current);
    };
  }, [active]);

  if (!active || typeof document === 'undefined') return null;

  // Scale every layer from the darkness level. The constants are tuned so the
  // default level (0.6) reproduces the original look exactly.
  const i = Math.min(1, Math.max(0, intensity));
  const veilOuter = 0.25 + 0.62 * i;      // edge darkening: 0.25 → 0.87
  const veilMid = veilOuter * 0.62;       // mid-falloff keeps the same shape
  const lamp = (a) => Math.min(1, a * (0.4 + i)); // warm pool / hotspot alphas

  // Portal to <body> so the overlay escapes any transformed / overflow-clipped
  // ancestor (which would trap a position:fixed element) and so its blend modes
  // composite against the whole page rather than an isolated stacking context.
  return ReactDOM.createPortal(
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250, // above content/drawer, below dialogs (1300) & menus (1500)
        pointerEvents: 'none',
        '--tx': '50vw',
        '--ty': '50vh',
      }}
    >
      {/* keyframes for the lamp flicker, injected once */}
      <style>{`
        @keyframes torchFlicker {
          0%, 100% { opacity: 0.92; }
          45%      { opacity: 1; }
          60%      { opacity: 0.85; }
          78%      { opacity: 0.97; }
        }
      `}</style>

      {/* Night veil — clear around the cursor, darkening hard toward the edges. */}
      {/* Each layer gets translateZ(0) so it lives on its own compositor layer;
          without it the full-screen gradients are re-rasterised every frame of
          any page animation (e.g. the sidebar slide), which reads as flicker. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateZ(0)',
          background:
            `radial-gradient(circle 300px at var(--tx) var(--ty), rgba(2,6,23,0) 0%, rgba(2,6,23,0) 20%, rgba(2,6,23,${veilMid.toFixed(3)}) 58%, rgba(2,6,23,${veilOuter.toFixed(3)}) 100%)`,
        }}
      />

      {/* Warm street-light pool that brightens whatever the torch lands on. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateZ(0)',
          mixBlendMode: 'screen',
          animation: 'torchFlicker 3.6s ease-in-out infinite',
          background:
            `radial-gradient(circle 260px at var(--tx) var(--ty), rgba(255,224,170,${lamp(0.55).toFixed(3)}) 0%, rgba(255,196,110,${lamp(0.32).toFixed(3)}) 32%, rgba(255,186,96,${lamp(0.12).toFixed(3)}) 58%, rgba(255,186,96,0) 78%)`,
        }}
      />

      {/* Tight specular core for the "bulb" hotspot. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateZ(0)',
          mixBlendMode: 'screen',
          background:
            `radial-gradient(circle 90px at var(--tx) var(--ty), rgba(255,255,255,${lamp(0.4).toFixed(3)}) 0%, rgba(255,245,220,${lamp(0.2).toFixed(3)}) 45%, rgba(255,255,255,0) 80%)`,
        }}
      />
    </div>,
    document.body
  );
};

export default NightTorch;
