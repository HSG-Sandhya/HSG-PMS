// One-time-password service for verifying an email address and a phone number.
//
// Codes are held in an in-memory Map (fine for a single-process first-run setup;
// swap for Redis if this ever needs to survive restarts or run multi-instance).
// Delivery reuses the app's existing channels: email via nodemailer, SMS via the
// configured provider (Twilio / Fast2SMS / MSG91) in notificationService.

import { sendEmail, sendSms } from './notificationService.js';

const store = new Map(); // key -> { code, expiresAt, attempts, verified, verifiedUntil, lastSentAt }

const OTP_TTL_MS = 5 * 60 * 1000; // a code is valid for 5 minutes
const VERIFIED_TTL_MS = 20 * 60 * 1000; // "verified" status is good for 20 min (time to finish the form)
const RESEND_COOLDOWN_MS = 30 * 1000; // min gap between sends to the same destination
const MAX_ATTEMPTS = 5; // wrong-code guesses before a new code is required

const keyOf = (channel, value) => `${channel}:${String(value).trim().toLowerCase()}`;
const genCode = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

const BRAND = 'Hotel Sandhya Grand';

// Whether a real provider is configured for the channel (so callers can tell the
// user when a code was generated but couldn't actually be delivered).
export const isChannelConfigured = (channel) => {
  if (channel === 'email') {
    return !!(process.env.SMTP_HOST || (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD));
  }
  return !!(process.env.SMS_PROVIDER || '').trim();
};

/**
 * Generate + deliver a code to an email or phone.
 * @returns {Promise<{sent:boolean, cooldown?:number, configured:boolean, devCode?:string}>}
 */
export const sendOtp = async (channel, value) => {
  const key = keyOf(channel, value);
  const now = Date.now();
  const existing = store.get(key);

  if (existing && !existing.verified && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return { sent: false, cooldown: Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000), configured: isChannelConfigured(channel) };
  }

  const code = genCode();
  store.set(key, { code, expiresAt: now + OTP_TTL_MS, attempts: 0, verified: false, verifiedUntil: 0, lastSentAt: now });

  try {
    if (channel === 'email') {
      await sendEmail(value, {
        subject: `${BRAND} — your verification code`,
        text: `Your ${BRAND} verification code is ${code}. It expires in 5 minutes.`,
        html: `<div style="font-family:system-ui,Arial,sans-serif"><p>Your <b>${BRAND}</b> verification code is:</p>`
          + `<p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:8px 0">${code}</p>`
          + `<p style="color:#64748b">It expires in 5 minutes. If you didn't request this, ignore this email.</p></div>`,
      });
    } else {
      await sendSms(value, `${BRAND}: your verification code is ${code}. Valid for 5 minutes.`);
    }
  } catch (err) {
    // In production a real delivery failure must surface (→ 502). In dev, log it
    // and fall through so the returned dev code keeps the flow testable even
    // before real email/SMS credentials are configured.
    if (process.env.NODE_ENV === 'production') throw err;
    console.warn(`[otp] ${channel} delivery failed in dev (${err.message}); returning dev code so the flow is testable.`);
  }

  // In non-production, return the code so the flow is testable even before a
  // real provider (SMS especially) is configured. Never leak it in production.
  const devCode = process.env.NODE_ENV === 'production' ? undefined : code;
  return { sent: true, configured: isChannelConfigured(channel), devCode };
};

/** Check a submitted code. On success the destination is marked verified. */
export const verifyOtp = (channel, value, code) => {
  const entry = store.get(keyOf(channel, value));
  const now = Date.now();

  if (!entry) return { ok: false, message: 'No code was sent. Please request a new code.' };
  if (entry.verified && entry.verifiedUntil > now) return { ok: true };
  if (now > entry.expiresAt) return { ok: false, message: 'Code expired. Please request a new one.' };
  if (entry.attempts >= MAX_ATTEMPTS) return { ok: false, message: 'Too many attempts. Request a new code.' };

  entry.attempts += 1;
  if (String(code).trim() !== entry.code) {
    return { ok: false, message: `Incorrect code. ${MAX_ATTEMPTS - entry.attempts} attempt(s) left.` };
  }

  entry.verified = true;
  entry.verifiedUntil = now + VERIFIED_TTL_MS;
  return { ok: true };
};

/** Has this destination been verified recently? Used to gate account creation. */
export const isVerified = (channel, value) => {
  const entry = store.get(keyOf(channel, value));
  return !!(entry && entry.verified && entry.verifiedUntil > Date.now());
};

/** Forget a destination's state (e.g. after the account is created). */
export const clearOtp = (channel, value) => store.delete(keyOf(channel, value));
