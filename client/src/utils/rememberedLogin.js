// "Remember me" storage for the login screen.
//
// The saved password is encrypted with AES-GCM under a key derived from a PIN
// the user picks. The PIN itself is never stored anywhere, so the password
// cannot be recovered on this device by anyone who doesn't know it: not through
// the eye toggle, not by reading localStorage, not by autofill. A wrong PIN
// fails on the AES-GCM auth tag, which never yields plaintext to compare.
//
// Honest about the limit: someone who copies the stored blob off the machine can
// brute-force a short PIN offline, and no iteration count fixes a 10,000-guess
// keyspace. Two things push back — a deliberately heavy KDF (below), and the
// attempt counter that wipes the saved login after 8 wrong guesses on the device.
// What this reliably defends against is the person who sits down at the front
// desk, which is the exposure the feature itself creates. Prefer 6 digits.

const REMEMBER_KEY = 'pms:remembered-login';
// OWASP's floor for PBKDF2-SHA256 is 600k; doubled because the secret here is a
// short PIN rather than a passphrase, and one unlock can afford the work. Costs
// ~0.1s of native CPU per guess, so a 4-digit PIN is hours and a 6-digit one is
// weeks of single-threaded offline grinding rather than seconds.
const PBKDF2_ITERATIONS = 1200000;
const MAX_PIN_ATTEMPTS = 8;

// WebCrypto's subtle API only exists in a secure context (https / localhost).
// Without it we cannot honestly store a password, so the caller hides the option.
export const isRememberSupported = () => typeof window !== 'undefined'
  && !!window.crypto?.subtle
  && typeof window.TextEncoder === 'function';

export const isValidPin = (pin) => /^\d{4,6}$/.test(String(pin || ''));

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const readRaw = () => {
  try { return JSON.parse(localStorage.getItem(REMEMBER_KEY)) || null; } catch { return null; }
};

const writeRaw = (obj) => {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify(obj)); } catch { /* storage full/disabled */ }
};

export const clearRemembered = () => {
  try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
};

const deriveKey = async (pin, salt) => {
  const base = await window.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveKey'],
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

/**
 * What the login screen needs to render before anything is unlocked:
 * `{ username, hasPassword }`, or null when nothing is saved.
 *
 * Entries written by the first (base64-only) version of this feature held the
 * password in the clear. Those are migrated on sight: the username is kept, the
 * password is dropped, and `migrated` is set so the screen can say why.
 */
export const readRemembered = () => {
  const raw = readRaw();
  if (!raw) return null;

  if (raw.v !== 2) {
    // Legacy blob: base64 of {username, password}, or already-plain JSON.
    let username = '';
    try {
      username = typeof raw === 'string'
        ? JSON.parse(decodeURIComponent(escape(atob(raw)))).username
        : raw.username || '';
    } catch { username = ''; }
    if (!username) { clearRemembered(); return null; }
    writeRaw({ v: 2, username });
    return { username, hasPassword: false, migrated: true };
  }

  if (!raw.username) { clearRemembered(); return null; }
  return { username: raw.username, hasPassword: !!(raw.salt && raw.iv && raw.ct), migrated: false };
};

/** Encrypt `password` under `pin` and remember it for `username`. */
export const saveRemembered = async ({ username, password, pin }) => {
  if (!isRememberSupported() || !isValidPin(pin) || !username || !password) return false;
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(password),
  );
  writeRaw({ v: 2, username, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), fails: 0 });
  return true;
};

/**
 * Try to recover the saved password with `pin`.
 *
 * → `{ ok: true, username, password }`
 * → `{ ok: false, reason: 'none' | 'unsupported' | 'bad-pin' | 'wiped' }`
 *   'wiped' means too many wrong PINs in a row and the saved login is now gone.
 */
export const unlockRemembered = async (pin) => {
  if (!isRememberSupported()) return { ok: false, reason: 'unsupported' };
  const raw = readRaw();
  if (!raw || raw.v !== 2 || !raw.salt || !raw.iv || !raw.ct) return { ok: false, reason: 'none' };

  try {
    const key = await deriveKey(pin, fromB64(raw.salt));
    const plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(raw.iv) }, key, fromB64(raw.ct),
    );
    if (raw.fails) writeRaw({ ...raw, fails: 0 });
    return { ok: true, username: raw.username, password: new TextDecoder().decode(plain) };
  } catch {
    // Any failure here is a wrong PIN — AES-GCM rejects on the auth tag before
    // it ever produces plaintext, so there is nothing to leak by guessing.
    const fails = (Number(raw.fails) || 0) + 1;
    if (fails >= MAX_PIN_ATTEMPTS) {
      clearRemembered();
      return { ok: false, reason: 'wiped' };
    }
    writeRaw({ ...raw, fails });
    return { ok: false, reason: 'bad-pin', attemptsLeft: MAX_PIN_ATTEMPTS - fails };
  }
};

/**
 * Follow a username change so the saved entry keeps pointing at the same
 * account. The ciphertext covers only the password, so nothing is re-encrypted.
 * Another user's saved login on a shared terminal is left alone.
 */
export const renameRemembered = (previousUsername, nextUsername) => {
  const raw = readRaw();
  if (!raw || raw.v !== 2 || !nextUsername) return;
  if (raw.username !== previousUsername && raw.username !== nextUsername) return;
  writeRaw({ ...raw, username: nextUsername });
};

/**
 * Drop the saved password but keep the username. Used when the password changes:
 * re-encrypting would need the PIN, which we deliberately never hold onto, so the
 * stale copy goes rather than silently failing at the next sign-in.
 */
export const forgetRememberedPassword = () => {
  const raw = readRaw();
  if (!raw || raw.v !== 2) return false;
  if (!raw.salt && !raw.ct) return false;
  writeRaw({ v: 2, username: raw.username });
  return true;
};
