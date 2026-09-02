// Booking notification service.
//
// Sends guest-facing notifications across three channels — email, SMS and
// WhatsApp — for three booking events:
//   • received   → website booking submitted (status Pending)
//   • confirmed  → back-office approved the booking (status Confirmed)
//   • rejected   → back-office declined the booking (status Rejected)
//
// Design notes:
//   • Provider-agnostic. SMS/WhatsApp pick their implementation from
//     SMS_PROVIDER / WA_PROVIDER env vars; email uses the existing SMTP_* setup.
//   • Fully dormant until configured. A channel with no credentials logs
//     "skipped (not configured)" and no-ops — it never throws.
//   • Non-blocking & fault-isolated. A failure in any channel is caught and
//     logged; it can never break the booking request that triggered it.
//
// See .env.example for the full list of keys each provider needs.

import nodemailer from 'nodemailer';
import axios from 'axios';
import { format } from 'date-fns';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Settings from '../models/Settings.js';

const HOTEL = 'Hotel Sandhya Grand';
const RECEPTION = '+91 94314 19196';

/* ───────────────────────────── helpers ───────────────────────────── */

/**
 * Where the guest can check their own booking.
 *
 * The link carries the booking's tracking token, which is the credential the
 * public status endpoint requires -- see getBookingStatus in
 * websiteController.js. Without a configured base URL there is nowhere to point
 * them, so the email simply omits the link rather than shipping a broken one.
 */
const trackingUrl = async (booking) => {
  if (!booking?.trackingToken || !booking?.invoiceNumber) return null;
  let base = process.env.WEBSITE_BASE_URL || '';
  if (!base) {
    try {
      const settings = await Settings.findOne({}, { guestWelcome: 1, website: 1 }).lean();
      base = settings?.guestWelcome?.websiteBaseUrl || settings?.website || '';
    } catch { base = ''; }
  }
  return buildTrackingUrl(base, booking.invoiceNumber, booking.trackingToken);
};

/**
 * Assemble the link. Pure and exported so the exact shape guests receive is
 * testable without a database or a mail server.
 */
export const buildTrackingUrl = (base, reference, token) => {
  if (!base || !reference || !token) return null;
  const origin = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  const params = new URLSearchParams({ ref: reference, token });
  return `${origin.replace(/\/+$/, '')}/booking-status?${params}`;
};

const fmtDate = (d) => {
  try { return format(new Date(d), 'EEE, d MMM yyyy'); } catch { return String(d || ''); }
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Returns false so a caller can tell "nothing was sent" from "sent". Anything
// that records having notified someone must not record it on a skip.
const logSkip = (channel) => {
  console.log(`[notify] ${channel} skipped (not configured)`);
  return false;
};

// Normalise an Indian phone number to E.164 (+91XXXXXXXXXX).
const toE164 = (raw) => {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return s;
  s = s.replace(/^0+/, '');
  if (s.length === 10) return `+91${s}`;
  if (s.length > 10 && s.startsWith('91')) return `+${s}`;
  return `+${s}`;
};

// Ensure we have the room's type/number whether or not roomId was populated.
const hydrate = async (booking) => {
  const b = typeof booking?.toObject === 'function' ? booking.toObject() : { ...booking };
  let room = b.roomId;
  if (!room || typeof room !== 'object' || !room.type) {
    const id = room && room._id ? room._id : room;
    if (id) {
      try { room = await Room.findById(id).lean(); } catch { room = null; }
    }
  }
  b.roomType = room?.type || b.roomType || 'Room';
  b.roomNumber = room?.roomNumber || '';

  // trackingToken is select:false, so a booking loaded by the back office (the
  // confirmed / rejected events) arrives without one. Fetch it explicitly --
  // this is the one place it is legitimately needed outside the guest's own
  // booking response.
  if (!b.trackingToken && b._id) {
    try {
      const withToken = await Booking.findById(b._id).select('+trackingToken').lean();
      if (withToken?.trackingToken) b.trackingToken = withToken.trackingToken;
    } catch { /* the link is optional; never fail a notification over it */ }
  }
  return b;
};

/* ─────────────────────────── message content ─────────────────────────── */

const buildMessages = (event, b, track = null) => {
  const name = b.guestName || 'Guest';
  const stay = `${b.roomType}${b.roomNumber ? ` (${b.roomNumber})` : ''}`;
  const dates = `${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}`;
  const ref = b.invoiceNumber || b.customerId || '';
  const refLine = ref ? ` Ref ${ref}.` : '';

  const wrap = (heading, bodyHtml) => `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#1a1a1a">
      <h2 style="font-weight:400">${heading}</h2>
      ${bodyHtml}
      <table style="margin:16px 0;font-size:15px">
        <tr><td style="padding:4px 16px 4px 0;color:#777">Room</td><td>${stay}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#777">Dates</td><td>${dates}</td></tr>
        ${b.totalAmount ? `<tr><td style="padding:4px 16px 4px 0;color:#777">Total</td><td>${money(b.totalAmount)}</td></tr>` : ''}
        ${ref ? `<tr><td style="padding:4px 16px 4px 0;color:#777">Reference</td><td>${ref}</td></tr>` : ''}
      </table>
      ${track ? `<p style="margin:20px 0"><a href="${track}" style="background:#1a1a1a;color:#fff;padding:11px 20px;text-decoration:none;border-radius:4px;font-family:Helvetica,Arial,sans-serif;font-size:14px">Check your booking</a></p><p style="color:#777;font-size:12px">Keep this link private — it is how we recognise your booking.</p>` : ''}
      <p style="color:#777;font-size:13px">${HOTEL} · Bari Bazaar Road, Munger, Bihar 811201 · ${RECEPTION}</p>
    </div>`;

  switch (event) {
    case 'received':
      return {
        subject: `We've received your booking — ${HOTEL}`,
        text: `Hi ${name}, we've received your booking request for ${stay}, ${dates}, at ${HOTEL}.${refLine} It's pending confirmation — we'll message you the moment it's confirmed.`,
        html: wrap('Booking received', `<p>Dear ${name},</p><p>Thank you — we've received your booking request. It's currently <b>pending confirmation</b>, and we'll be in touch shortly.</p>`),
      };
    case 'confirmed':
      return {
        subject: `Booking confirmed — ${HOTEL}`,
        text: `Hi ${name}, good news! Your booking for ${stay}, ${dates}, at ${HOTEL} is CONFIRMED.${refLine}${b.totalAmount ? ` Total ${money(b.totalAmount)}.` : ''} We look forward to welcoming you.`,
        html: wrap('Booking confirmed ✓', `<p>Dear ${name},</p><p>Your booking is <b>confirmed</b>. We look forward to welcoming you to ${HOTEL}.</p>`),
      };
    case 'rejected':
      return {
        subject: `Booking update — ${HOTEL}`,
        text: `Hi ${name}, we're sorry — we couldn't confirm your booking for ${stay}, ${dates}, at ${HOTEL}.${refLine} Please call us at ${RECEPTION} and we'll be glad to help.`,
        html: wrap('Booking could not be confirmed', `<p>Dear ${name},</p><p>We're sorry, but we were unable to confirm this booking request. Please call us at <b>${RECEPTION}</b> and we'll help you find an alternative.</p>`),
      };
    default:
      return null;
  }
};

/* ───────────────────────────── email ───────────────────────────── */

let _transporter;
const getTransporter = () => {
  if (_transporter) return _transporter;
  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    // Gmail fallback — uses the EMAIL_USER/EMAIL_PASSWORD already in .env.
    // (The password must be a Google "App Password", not the account password.)
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
  } else {
    return null;
  }
  return _transporter;
};

/** @returns {Promise<boolean>} true only when a message actually went out. */
export const sendEmail = async (to, msg) => {
  const t = getTransporter();
  if (!t) return logSkip('email');
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.EMAIL_USER || 'no-reply@sandhyagrand.in',
    to, subject: msg.subject, html: msg.html, text: msg.text,
  });
  console.log(`[notify] email sent → ${to}`);
  return true;
};

/* ───────────────────────────── SMS ───────────────────────────── */

export const sendSms = async (phone, text) => {
  const to = toE164(phone);
  switch ((process.env.SMS_PROVIDER || '').toLowerCase()) {
    case 'twilio':   return twilioSms(to, text);
    case 'fast2sms': return fast2smsSms(to, text);
    case 'msg91':    return msg91Sms(to, text);
    default:         return logSkip('sms');
  }
};

const twilioSms = async (to, body) => {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_SMS_FROM: from } = process.env;
  if (!sid || !token || !from) return logSkip('sms (twilio)');
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ To: to, From: from, Body: body }),
    { auth: { username: sid, password: token } }
  );
  console.log(`[notify] sms (twilio) sent → ${to}`);
};

// Fast2SMS "quick" transactional route — free-form text, Indian numbers only.
const fast2smsSms = async (to, body) => {
  const key = process.env.FAST2SMS_KEY;
  if (!key) return logSkip('sms (fast2sms)');
  await axios.get('https://www.fast2sms.com/dev/bulkV2', {
    params: { authorization: key, route: 'q', message: body, numbers: to.replace('+91', ''), flash: 0 },
  });
  console.log(`[notify] sms (fast2sms) sent → ${to}`);
};

// MSG91 Flow API. India DLT requires a pre-approved template; the message text
// is passed as a template variable (default name "message" — adjust to match
// your template via MSG91_SMS_VAR).
const msg91Sms = async (to, body) => {
  const { MSG91_AUTH_KEY: key, MSG91_SMS_TEMPLATE: template_id, MSG91_SENDER: sender } = process.env;
  if (!key || !template_id) return logSkip('sms (msg91)');
  const varName = process.env.MSG91_SMS_VAR || 'message';
  await axios.post(
    'https://control.msg91.com/api/v5/flow/',
    { template_id, sender, recipients: [{ mobiles: to.replace('+', ''), [varName]: body }] },
    { headers: { authkey: key, 'Content-Type': 'application/json' } }
  );
  console.log(`[notify] sms (msg91) sent → ${to}`);
};

/* ───────────────────────────── WhatsApp ───────────────────────────── */

const sendWhatsApp = async (phone, text) => {
  const to = toE164(phone);
  switch ((process.env.WA_PROVIDER || '').toLowerCase()) {
    case 'twilio': return twilioWhatsApp(to, text);
    case 'meta':   return metaWhatsApp(to, text);
    case 'msg91':  return msg91WhatsApp(to, text);
    default:       return logSkip('whatsapp');
  }
};

const twilioWhatsApp = async (to, body) => {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WA_FROM: from } = process.env;
  if (!sid || !token || !from) return logSkip('whatsapp (twilio)');
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: body }),
    { auth: { username: sid, password: token } }
  );
  console.log(`[notify] whatsapp (twilio) sent → ${to}`);
};

// Meta WhatsApp Cloud API. Free-form text works only inside a 24h
// customer-initiated window; business-initiated sends require an approved
// template (swap the `text` payload for a `template` payload once you have one).
const metaWhatsApp = async (to, body) => {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: phoneId } = process.env;
  if (!token || !phoneId) return logSkip('whatsapp (meta)');
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body } },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  console.log(`[notify] whatsapp (meta) sent → ${to}`);
};

// MSG91 WhatsApp — requires an approved template; this sends the text as the
// template body component. Tune to your template structure as needed.
const msg91WhatsApp = async (to, body) => {
  const { MSG91_AUTH_KEY: key, MSG91_WA_NUMBER: from, MSG91_WA_TEMPLATE: template } = process.env;
  if (!key || !from || !template) return logSkip('whatsapp (msg91)');
  await axios.post(
    'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
    {
      integrated_number: from,
      content_type: 'template',
      payload: {
        to: to.replace('+', ''),
        type: 'template',
        template: { name: template, language: { code: 'en', policy: 'deterministic' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }] },
      },
    },
    { headers: { authkey: key, 'Content-Type': 'application/json' } }
  );
  console.log(`[notify] whatsapp (msg91) sent → ${to}`);
};

/* ───────────────────────────── orchestrator ───────────────────────────── */

const safe = (channel, p) =>
  Promise.resolve(p).catch((err) => {
    console.error(`[notify] ${channel} failed: ${err?.response?.data ? JSON.stringify(err.response.data) : err.message}`);
  });

/**
 * Send all configured channel notifications for a booking event.
 * Fire-and-forget friendly: resolves once all channels settle, never rejects.
 *
 * @param {'received'|'confirmed'|'rejected'} event
 * @param {object} bookingInput  Booking doc (roomId may be populated or an id)
 */
export async function sendBookingNotification(event, bookingInput) {
  try {
    const booking = await hydrate(bookingInput);
    const track = await trackingUrl(booking);
    const msg = buildMessages(event, booking, track);
    if (!msg) return;
    if (track) msg.text = `${msg.text} Track it: ${track}`;

    const tasks = [];
    if (booking.email) tasks.push(safe('email', sendEmail(booking.email, msg)));
    if (booking.phone) {
      tasks.push(safe('sms', sendSms(booking.phone, msg.text)));
      tasks.push(safe('whatsapp', sendWhatsApp(booking.phone, msg.text)));
    }
    if (!tasks.length) {
      console.log('[notify] no email/phone on booking — nothing to send');
      return;
    }
    await Promise.allSettled(tasks);
  } catch (err) {
    console.error(`[notify] ${event} notification failed:`, err.message);
  }
}

export default { sendBookingNotification };
