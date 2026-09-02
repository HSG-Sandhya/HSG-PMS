/**
 * What a Settings read is allowed to contain.
 *
 * Two separate problems live here, and they need different answers:
 *
 *  1. SECRETS. Payment-gateway keys, SMTP/SendGrid/Mailgun credentials, SMS
 *     provider tokens and channel-manager keys are write-only by nature. The
 *     browser never needs the value — only whether one is configured — so they
 *     are stripped for EVERY caller, administrators included. A screen that
 *     cannot display a secret cannot leak it through a screenshot, a support
 *     session, a browser extension, or a cached HTTP response.
 *
 *  2. VISIBILITY. The rest of the Settings document is ordinary configuration,
 *     but sections like `payment` and `integrations` are still nobody's business
 *     but an administrator's. Those are removed wholesale for callers without
 *     view_settings, which leaves the operational settings the app genuinely
 *     needs on every screen (branding, billing rates, invoice template, room
 *     categories, guest messaging) working for ordinary staff.
 *
 * DELIBERATELY NOT A SECRET: the WiFi passwords in `guestMessaging`. They are
 * handed to every guest who checks in — reception reads them off the welcome
 * dialog to send over WhatsApp (see utils/guestWelcome.js). Redacting them would
 * break a working front-desk flow to protect a value that is printed on cards
 * and given away by design.
 */

// Dotted paths whose value must never leave the server. Each is replaced by a
// sibling boolean so the UI can still say "configured" without holding the value.
export const SECRET_PATHS = [
  'payment.razorpay.keySecret',
  'payment.razorpay.webhookSecret',
  'payment.payu.merchantKey',
  'payment.payu.salt',
  'payment.paytm.merchantKey',
  'payment.stripe.secretKey',
  'payment.stripe.webhookSecret',
  'integrations.channelManager.apiKey',
  'integrations.channelManager.apiSecret',
  'integrations.emailService.smtp.password',
  'integrations.emailService.sendgrid.apiKey',
  'integrations.emailService.mailgun.apiKey',
  'integrations.smsService.twilio.authToken',
  'integrations.smsService.messagebird.apiKey',
  'integrations.smsService.textlocal.apiKey',
];

// Sections an ordinary staff account has no reason to read at all.
export const PRIVILEGED_SECTIONS = ['payment', 'integrations', 'security', 'backup'];

// Permissions that grant the unreduced view.
export const VIEW_SETTINGS_PERMISSIONS = ['view_settings', 'manage_settings'];

/**
 * The sentinel a client sends back in place of a secret it never received.
 * Treated as "leave the stored value alone" on write — without it, saving the
 * Payments form with an emptied field would silently wipe a live gateway key.
 */
export const SECRET_PLACEHOLDER = '__unchanged__';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const getPath = (obj, parts) =>
  parts.reduce((cur, part) => (isPlainObject(cur) ? cur[part] : undefined), obj);

const deletePath = (obj, parts) => {
  const parent = getPath(obj, parts.slice(0, -1));
  if (isPlainObject(parent)) delete parent[parts[parts.length - 1]];
};

const setPath = (obj, parts, value) => {
  const parent = getPath(obj, parts.slice(0, -1));
  if (isPlainObject(parent)) parent[parts[parts.length - 1]] = value;
};

/** A Mongoose document, a lean object or undefined → a mutable plain object. */
const toPlain = (doc) => {
  if (!doc) return {};
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return JSON.parse(JSON.stringify(obj));
};

/** `keySecret` → `keySecretConfigured` */
const configuredFlagName = (leaf) => `${leaf}Configured`;

/**
 * Strip every secret, leaving a `<field>Configured` boolean in its place.
 * Applied to every caller — an administrator gets the same redacted document.
 */
export const redactSecrets = (settings) => {
  const out = toPlain(settings);

  for (const dotted of SECRET_PATHS) {
    const parts = dotted.split('.');
    const parent = getPath(out, parts.slice(0, -1));
    if (!isPlainObject(parent)) continue;

    const leaf = parts[parts.length - 1];
    const value = parent[leaf];
    // Only advertise a flag where the schema actually has the field, so we do
    // not invent `saltConfigured: false` on gateways that have no salt.
    if (!(leaf in parent)) continue;

    parent[configuredFlagName(leaf)] = typeof value === 'string' && value.trim().length > 0;
    deletePath(out, parts);
  }

  return out;
};

/**
 * The document as a given caller may see it.
 * @param {object}  settings
 * @param {boolean} canViewAll  caller holds view_settings / manage_settings
 */
export const serializeSettings = (settings, { canViewAll = false } = {}) => {
  const out = redactSecrets(settings);
  if (canViewAll) return out;
  for (const section of PRIVILEGED_SECTIONS) delete out[section];
  return out;
};

/** May this caller read this named section at all? */
export const sectionIsPrivileged = (section) => PRIVILEGED_SECTIONS.includes(section);

/**
 * Carry stored secrets across an update.
 *
 * The browser is never sent a secret, so it cannot send one back. Any incoming
 * secret that is absent, blank or the placeholder means "unchanged" and is
 * restored from the saved document; a real new value passes through.
 *
 * @param {object} incoming  the payload about to be written
 * @param {object} stored    the current saved settings
 * @returns {object} incoming, with secrets resolved
 */
export const preserveSecrets = (incoming, stored) => {
  if (!isPlainObject(incoming)) return incoming;
  const out = toPlain(incoming);
  const current = toPlain(stored);

  for (const dotted of SECRET_PATHS) {
    const parts = dotted.split('.');
    const parent = getPath(out, parts.slice(0, -1));
    if (!isPlainObject(parent)) continue;

    const leaf = parts[parts.length - 1];
    // The client echoes back the flag; it is derived state, never stored.
    delete parent[configuredFlagName(leaf)];

    const supplied = parent[leaf];
    const isUnchanged =
      supplied === undefined ||
      supplied === null ||
      (typeof supplied === 'string' &&
        (supplied.trim() === '' || supplied === SECRET_PLACEHOLDER));

    if (!isUnchanged) continue;

    const existing = getPath(current, parts);
    if (existing === undefined) delete parent[leaf];
    else setPath(out, parts, existing);
  }

  return out;
};

/**
 * The same "unchanged" resolution for a single section payload, where the
 * incoming object is rooted at the section rather than the whole document.
 */
export const preserveSectionSecrets = (section, incoming, stored) => {
  if (!section || !isPlainObject(incoming)) return incoming;
  const wrapped = preserveSecrets({ [section]: incoming }, stored);
  return wrapped[section];
};
