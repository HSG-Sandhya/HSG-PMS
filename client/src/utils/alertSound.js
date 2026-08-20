/**
 * Loud, asset-free alert sounds for the back-office (Web Audio API).
 *
 * A website booking that nobody hears is a booking we lose, so the alert is
 * built to be missed as rarely as possible:
 *   • a genuinely loud tone (bell / horn / siren) synthesised on the fly,
 *   • repeated until a human acknowledges it,
 *   • plus a flashing tab title, a desktop notification and a phone buzz.
 *
 * Browsers block audio until the page has seen a real user gesture, so
 * `primeAudio()` unlocks (and keeps alive) one shared AudioContext on the
 * first click/keypress after load.
 */

/* ───────────────────────── preferences ───────────────────────── */

const STORAGE_KEY = 'hsg.bookingAlert';

export const ALERT_SOUNDS = [
  { id: 'bell',  label: 'Reception bell' },
  { id: 'horn',  label: 'Air horn' },
  { id: 'siren', label: 'Siren' },
  { id: 'chime', label: 'Soft chime' },
];

const DEFAULT_PREFS = { sound: 'bell', volume: 1, muted: false, voice: true, voiceName: '' };

export const loadAlertPrefs = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const sound = ALERT_SOUNDS.some((s) => s.id === saved.sound) ? saved.sound : DEFAULT_PREFS.sound;
    const volume = Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : DEFAULT_PREFS.volume;
    return {
      sound,
      volume,
      muted: !!saved.muted,
      voice: saved.voice !== false,          // spoken announcement, on by default
      voiceName: typeof saved.voiceName === 'string' ? saved.voiceName : '',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

export const saveAlertPrefs = (patch) => {
  const next = { ...loadAlertPrefs(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
};

/* ───────────────────────── audio plumbing ───────────────────────── */

let ctx = null;
let master = null;
let primed = false;

const ensureCtx = () => {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) {
    ctx = new Ctx();
    // Compressor keeps the stacked partials loud without clipping into a buzz.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 14;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

/** Unlock audio on the first user gesture; safe to call repeatedly. */
export const primeAudio = () => {
  if (primed || typeof window === 'undefined') return;
  primed = true;
  const unlock = () => {
    const c = ensureCtx();
    if (!c) return;
    // A silent blip completes the unlock handshake on iOS/Safari.
    try {
      const buf = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch { /* ignore */ }
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
    window.addEventListener(evt, unlock, { passive: true }));
  // Tabs suspend the context when backgrounded for a long time.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx?.state === 'suspended') ctx.resume().catch(() => {});
  });
};

/** Struck/plucked voice: fast attack, exponential ring-out. */
const pluck = ({ f, t, d, g, type = 'sine' }) => {
  const o = ctx.createOscillator();
  const gain = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(g, 0.0002), t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gain);
  gain.connect(master);
  o.start(t);
  o.stop(t + d + 0.02);
};

/** Sustained voice (horn / siren): flat body with a short attack + release. */
const blast = ({ f, f2, t, d, g, type = 'sawtooth' }) => {
  const o = ctx.createOscillator();
  const gain = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.linearRampToValueAtTime(f2, t + d);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(g, 0.0002), t + 0.02);
  gain.gain.setValueAtTime(Math.max(g, 0.0002), t + d - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gain);
  gain.connect(master);
  o.start(t);
  o.stop(t + d + 0.02);
};

/** Filtered noise burst — the "clack" of a bell hammer. */
const clack = ({ t, d, g }) => {
  const frames = Math.floor(ctx.sampleRate * d);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const gain = ctx.createGain();
  gain.gain.value = g;
  src.connect(hp);
  hp.connect(gain);
  gain.connect(master);
  src.start(t);
};

/* ───────────────────────── the sounds ───────────────────────── */
// Each returns the length of one pass, in seconds.

const SOUNDS = {
  // Brass reception bell, struck three times.
  bell: (t0, v) => {
    const partials = [1, 2.02, 2.79, 4.09, 5.41];
    const decays = [1.7, 1.2, 0.9, 0.6, 0.4];
    [0, 0.5, 1.0].forEach((s) => {
      const t = t0 + s;
      partials.forEach((p, i) => pluck({ f: 784 * p, t, d: decays[i], g: v * (0.7 / (i + 1)) }));
      clack({ t, d: 0.05, g: v * 0.5 });
    });
    return 2.7;
  },
  // Two-tone air horn: three blasts, the last one held.
  horn: (t0, v) => {
    [[0, 0.45], [0.6, 0.45], [1.2, 0.85]].forEach(([s, d]) => {
      const t = t0 + s;
      [233.1, 293.7, 466.2, 587.3, 932.3].forEach((f, i) =>
        blast({ f, t, d, g: v * (0.42 / (i * 0.7 + 1)) }));
    });
    return 2.3;
  },
  // Rising/falling emergency siren, two sweeps.
  siren: (t0, v) => {
    [0, 1.0].forEach((s) => {
      blast({ f: 600, f2: 1250, t: t0 + s, d: 0.5, g: v * 0.4, type: 'sawtooth' });
      blast({ f: 1250, f2: 600, t: t0 + s + 0.5, d: 0.5, g: v * 0.4, type: 'sawtooth' });
      blast({ f: 300, f2: 625, t: t0 + s, d: 0.5, g: v * 0.2, type: 'square' });
      blast({ f: 625, f2: 300, t: t0 + s + 0.5, d: 0.5, g: v * 0.2, type: 'square' });
    });
    return 2.2;
  },
  // The original gentle two-note chime, for quiet shifts.
  chime: (t0, v) => {
    pluck({ f: 880, t: t0, d: 0.35, g: v * 0.35 });
    pluck({ f: 1318.5, t: t0 + 0.16, d: 0.45, g: v * 0.35 });
    return 0.7;
  },
};

/** Play one pass of a sound now. Returns its length in seconds (0 if silent). */
export const playAlert = (soundId, volumeOverride) => {
  const prefs = loadAlertPrefs();
  const c = ensureCtx();
  if (!c) return 0;
  const fn = SOUNDS[soundId || prefs.sound] || SOUNDS.bell;
  const vol = volumeOverride ?? prefs.volume;
  try {
    return fn(c.currentTime + 0.02, vol);
  } catch {
    return 0;
  }
};

/* ───────────────────────── spoken announcement ───────────────────────── */
/* A bell says "something happened"; a voice says WHAT happened, so staff know
   it is a booking without looking at the screen. Uses the browser's built-in
   speech synthesis — no recordings to host, and it can read the guest's name. */

// Female voices, best first. Indian English leads: it reads Indian guest names
// far more naturally than a US/UK voice does.
const PREFERRED_VOICES = [
  'Veena', 'Google हिन्दी', 'Microsoft Heera', 'Rishi',
  'Samantha', 'Google UK English Female', 'Karen', 'Tessa', 'Moira', 'Fiona',
  'Microsoft Zira', 'Google US English',
];

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : null);

/** English voices the browser offers (the list loads asynchronously). */
export const listVoices = () => {
  try {
    return (synth()?.getVoices() || []).filter((v) => /^en/i.test(v.lang) || /hi-IN/i.test(v.lang));
  } catch {
    return [];
  }
};

/** Warm the voice list up — Chrome returns [] until `voiceschanged` fires. */
export const primeVoices = (onReady) => {
  const sp = synth();
  if (!sp) return;
  sp.getVoices();
  if (onReady) sp.addEventListener?.('voiceschanged', () => onReady(listVoices()), { once: true });
};

const pickVoice = () => {
  const voices = listVoices();
  if (!voices.length) return null;
  const { voiceName } = loadAlertPrefs();
  const saved = voices.find((v) => v.name === voiceName);
  if (saved) return saved;
  for (const want of PREFERRED_VOICES) {
    const hit = voices.find((v) => v.name.toLowerCase().includes(want.toLowerCase()));
    if (hit) return hit;
  }
  return voices.find((v) => /female|woman/i.test(v.name))
      || voices.find((v) => /en-IN/i.test(v.lang))
      || voices[0];
};

/**
 * Say something in a soft, unhurried voice.
 * @param {string} text        what to say
 * @param {function} [onEnd]   called when speaking finishes (or fails)
 * @param {string} [voiceName] override the saved voice, for previews
 */
export const speak = (text, onEnd, voiceName) => {
  const sp = synth();
  if (!sp || !text) { onEnd?.(); return; }
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd?.(); } };
  try {
    sp.cancel(); // never let announcements queue up on top of each other
    const u = new SpeechSynthesisUtterance(text);
    const voice = voiceName ? listVoices().find((v) => v.name === voiceName) : pickVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = 0.95;   // unhurried
    u.pitch = 1.25;  // light and friendly
    u.volume = 1;
    u.onend = finish;
    u.onerror = finish;
    sp.speak(u);
    // Safety net: some browsers never fire onend if speech is blocked.
    setTimeout(finish, Math.min(12000, 90 * text.length + 2500));
  } catch {
    finish();
  }
};

/** Which voice will actually speak — so the UI can tick the right row. */
export const resolveVoiceName = () => pickVoice()?.name || '';

export const cancelSpeech = () => { try { synth()?.cancel(); } catch { /* ignore */ } };

/* ───────────────────────── ring loop ───────────────────────── */

const GAP_MS = 1200;              // silence between passes
const MAX_RING_MS = 5 * 60 * 1000; // stop bellowing after 5 min, badge stays

let ringTimer = null;
let ringStopAt = 0;
let ringMessage = '';   // what the voice announces each pass

export const isRinging = () => ringTimer !== null;

/**
 * Ring until `stopRinging()` is called (or the 5-minute cap is reached).
 * Each pass is: alarm sound → spoken announcement → gap. Calling it again
 * while already ringing only refreshes the message, so a burst of bookings
 * doesn't stack overlapping alarms.
 * @param {string} [message]  spoken after every ring, e.g. the guest's name.
 */
export const startRinging = (message = '') => {
  ringMessage = message;
  if (ringTimer) return;
  ringStopAt = Date.now() + MAX_RING_MS;
  const tick = () => {
    if (Date.now() > ringStopAt) { stopRinging(); return; }
    // Prefs are re-read every pass so muting (or switching sound/voice) applies
    // to a burst that is already in progress.
    const prefs = loadAlertPrefs();
    if (prefs.muted) { ringTimer = setTimeout(tick, 2000); return; }

    const len = playAlert(prefs.sound);
    buzz();
    const again = () => { ringTimer = setTimeout(tick, GAP_MS); };
    ringTimer = setTimeout(() => {
      // Speak once the alarm has rung out, so the two don't talk over each other.
      if (prefs.voice && ringMessage) speak(ringMessage, again);
      else again();
    }, Math.max(len * 1000, 900));
  };
  ringTimer = setTimeout(tick, 0);
};

export const stopRinging = () => {
  if (ringTimer) clearTimeout(ringTimer);
  ringTimer = null;
  ringMessage = '';
  cancelSpeech();
};

/** Single pass — used for "there was already something pending" and previews. */
export const ringOnce = (soundId, message = '') => {
  const prefs = loadAlertPrefs();
  if (prefs.muted && !soundId) return;
  const len = playAlert(soundId || prefs.sound);
  buzz();
  if (message && prefs.voice) setTimeout(() => speak(message), Math.max(len * 1000, 900));
};

/* ───────────────────────── other channels ───────────────────────── */

/** Phone/tablet buzz — works even when the device is on silent in some OSes. */
const buzz = () => {
  try { navigator.vibrate?.([300, 120, 300, 120, 500]); } catch { /* unsupported */ }
};

let titleTimer = null;
let baseTitle = null;

/** Flash the browser-tab title so a background tab still shouts. */
export const startTitleFlash = (message) => {
  if (typeof document === 'undefined') return;
  if (baseTitle === null) baseTitle = document.title;
  if (titleTimer) clearInterval(titleTimer);
  let on = false;
  document.title = message;
  titleTimer = setInterval(() => {
    on = !on;
    document.title = on ? baseTitle : message;
  }, 900);
};

export const stopTitleFlash = () => {
  if (titleTimer) clearInterval(titleTimer);
  titleTimer = null;
  if (baseTitle !== null) { document.title = baseTitle; baseTitle = null; }
};

/** Ask once for desktop-notification rights (must run inside a user gesture). */
export const ensureNotificationPermission = () => {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
};

/** OS-level notification that survives the tab being hidden or minimised. */
export const showDesktopNotification = ({ title, body, tag = 'booking-request' }) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, renotify: true, requireInteraction: true, icon: '/icon-192.png' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* some browsers require a service worker; ignore */ }
};

/** Short confirmation tones for staff actions (never part of the alarm loop). */
export const playFeedback = (kind) => {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.02;
  try {
    if (kind === 'error') {
      pluck({ f: 220, t, d: 0.3, g: 0.3, type: 'sawtooth' });
      pluck({ f: 155, t: t + 0.16, d: 0.42, g: 0.32, type: 'sawtooth' });
    } else {
      pluck({ f: 659, t, d: 0.35, g: 0.3 });
      pluck({ f: 880, t: t + 0.12, d: 0.35, g: 0.3 });
      pluck({ f: 1175, t: t + 0.24, d: 0.5, g: 0.3 });
    }
  } catch { /* ignore */ }
};
