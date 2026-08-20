/**
 * Device performance probe for Settings → Appearance → Performance.
 *
 * Recommends a performance preset for the machine the app is actually running
 * on. Two signals are combined:
 *
 *  1. Hardware hints (`deviceMemory`, `hardwareConcurrency`). Cheap and
 *     instant, but coarse — and absent entirely on Safari, which reports
 *     neither. Used only to break ties.
 *  2. A measured frame rate under load. This is the signal that matters,
 *     because it captures the thing the hints can't: how fast this browser
 *     composites THIS page, with the effects currently switched on.
 *
 * The measurement deliberately runs against the live app rather than a
 * synthetic canvas — the question being answered is "can this machine paint
 * this UI smoothly", and only the real UI can answer that.
 */

// Sample the real frame rate for `durationMs`, while a transform animation
// keeps frames scheduled (an idle page produces no frames and would otherwise
// read as 0fps). Resolves with the mean and the worst 250ms window.
export const measureFrameRate = (durationMs = 1500) =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve({ mean: null, worst: null });
      return;
    }

    // An offscreen element that animates a transform — enough to keep the
    // compositor scheduling frames without adding meaningful work itself.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:2px',
      'height:2px',
      'opacity:0.01',
      'pointer-events:none',
      'z-index:-1',
      'will-change:transform',
    ].join(';');
    document.body.appendChild(probe);

    const start = performance.now();
    let frames = 0;
    let bucketFrames = 0;
    let bucketStart = start;
    let worst = Infinity;
    let raf = 0;

    const tick = (now) => {
      frames += 1;
      bucketFrames += 1;
      probe.style.transform = `translateX(${(now / 16) % 2}px)`;

      const bucketElapsed = now - bucketStart;
      if (bucketElapsed >= 250) {
        worst = Math.min(worst, (bucketFrames * 1000) / bucketElapsed);
        bucketFrames = 0;
        bucketStart = now;
      }

      const elapsed = now - start;
      if (elapsed >= durationMs) {
        cancelAnimationFrame(raf);
        probe.remove();
        resolve({
          mean: Math.round((frames * 1000) / elapsed),
          worst: Number.isFinite(worst) ? Math.round(worst) : null,
        });
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  });

// Coarse hardware tier from the browser's own hints. Returns 0 (weak),
// 1 (typical) or 2 (strong); null when the browser exposes nothing useful.
export const hardwareTier = () => {
  const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  if (mem == null && cores == null) return null;

  const m = mem ?? 4;
  const c = cores ?? 4;
  if (m <= 2 || c <= 2) return 0;
  if (m >= 8 && c >= 8) return 2;
  return 1;
};

/**
 * Run the probe and recommend a preset key.
 *
 * The frame rate is read against whatever settings are live right now, so the
 * result is interpreted relative to them: hitting 60fps on "Fastest" says
 * nothing about whether the machine could handle "Maximum quality". Hence
 * `currentLevel` — a good score only justifies moving up one step at a time.
 */
export const recommendPreset = async (currentLevel = 'panels') => {
  const { mean, worst } = await measureFrameRate(1500);
  const tier = hardwareTier();

  // No usable measurement (background tab, unsupported API) — fall back to the
  // hardware hint alone, and stay conservative when there isn't one.
  if (mean == null) {
    if (tier === 2) return { preset: 'balanced', mean, worst, tier, reason: 'hardware' };
    if (tier === 0) return { preset: 'fastest', mean, worst, tier, reason: 'hardware' };
    return { preset: 'balanced', mean, worst, tier, reason: 'hardware' };
  }

  // Judge on the worst window rather than the mean: a 55fps average with dips
  // into the teens is exactly what "feels laggy" describes.
  const score = worst ?? mean;

  // Order from cheapest to richest, so a good score can step up by one.
  const ladder = ['off', 'overlays', 'panels', 'full'];
  const presetFor = { off: 'fastest', overlays: 'fast', panels: 'balanced', full: 'quality' };
  const idx = Math.max(0, ladder.indexOf(currentLevel));

  let targetIdx;
  if (score < 25) {
    targetIdx = 0;                          // struggling badly — go to the floor
  } else if (score < 40) {
    targetIdx = Math.max(0, idx - 1);       // dropping frames — step down
  } else if (score < 52) {
    targetIdx = idx;                        // acceptable — leave it alone
  } else {
    // Comfortably smooth: it can likely afford one step richer. Only allow the
    // top rung when the hardware hints agree, since the current level may
    // simply be cheap enough to mask a weak machine.
    const step = Math.min(ladder.length - 1, idx + 1);
    targetIdx = step === ladder.length - 1 && tier !== 2 ? idx : step;
  }

  return {
    preset: presetFor[ladder[targetIdx]],
    mean,
    worst,
    tier,
    reason: 'measured',
  };
};
