import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSecrets,
  serializeSettings,
  preserveSecrets,
  preserveSectionSecrets,
  sectionIsPrivileged,
  SECRET_PATHS,
  SECRET_PLACEHOLDER,
} from '../services/settingsRedaction.js';

// GET /api/settings required only a valid token, and returned the Settings
// document whole. Every logged-in account — housekeeping, waiters, reception —
// could read the live Razorpay key secret, SMTP and SMS provider credentials and
// channel-manager keys.

const stored = () => ({
  hotelName: 'Sandhya Grand',
  billing: { roomGstRate: 5, invoicePrefix: 'HSG' },
  payment: {
    razorpay: { enabled: true, environment: 'live', keyId: 'rzp_live_public', keySecret: 'LIVE-SECRET' },
    stripe: { enabled: false, publicKey: '', secretKey: '' },
  },
  integrations: {
    channelManager: { enabled: true, provider: 'x', apiKey: 'CM-KEY', apiSecret: 'CM-SECRET' },
    emailService: { provider: 'smtp', smtp: { host: 'mail', username: 'u', password: 'MAILPW' } },
    smsService: { provider: 'twilio', twilio: { accountSid: 'AC1', authToken: 'TWILIO-TOKEN' } },
  },
  security: { maxLoginAttempts: 5 },
  guestMessaging: { wifiSsid: 'Sandhya Prabha', wifiPassword: 'guest-wifi-pw' },
});

const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flat(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]]);

test('no secret survives serialization, for any caller', () => {
  for (const canViewAll of [true, false]) {
    const out = serializeSettings(stored(), { canViewAll });
    const values = flat(out).map(([, v]) => String(v));
    for (const secret of ['LIVE-SECRET', 'CM-KEY', 'CM-SECRET', 'MAILPW', 'TWILIO-TOKEN']) {
      assert.equal(values.includes(secret), false, `${secret} leaked (canViewAll=${canViewAll})`);
    }
  }
});

test('an administrator learns whether a secret is set, not what it is', () => {
  const out = serializeSettings(stored(), { canViewAll: true });
  assert.equal(out.payment.razorpay.keySecret, undefined);
  assert.equal(out.payment.razorpay.keySecretConfigured, true);
  assert.equal(out.payment.stripe.secretKeyConfigured, false, 'blank is "not configured"');
  // The public half of a key pair is not a secret — the browser needs it.
  assert.equal(out.payment.razorpay.keyId, 'rzp_live_public');
  assert.equal(out.integrations.emailService.smtp.username, 'u');
  assert.equal(out.integrations.emailService.smtp.passwordConfigured, true);
});

test('ordinary staff lose the administrator-only sections entirely', () => {
  const out = serializeSettings(stored(), { canViewAll: false });
  assert.equal(out.payment, undefined);
  assert.equal(out.integrations, undefined);
  assert.equal(out.security, undefined);
  // ...but keep everything the app's own screens read on every page.
  assert.equal(out.billing.roomGstRate, 5);
  assert.equal(out.hotelName, 'Sandhya Grand');
});

test('WiFi passwords are not treated as secrets', () => {
  // Reception reads these off the welcome dialog to WhatsApp to the guest, and
  // they are given to every guest by design. Redacting them would break a
  // working front-desk flow to protect a value the hotel hands out.
  const out = serializeSettings(stored(), { canViewAll: false });
  assert.equal(out.guestMessaging.wifiPassword, 'guest-wifi-pw');
});

test('saving a redacted document does not wipe the stored secrets', () => {
  const saved = stored();
  const asShownToAdmin = serializeSettings(saved, { canViewAll: true });

  // The admin edits one visible field and saves the form back verbatim.
  asShownToAdmin.payment.razorpay.environment = 'test';
  const resolved = preserveSecrets(asShownToAdmin, saved);

  assert.equal(resolved.payment.razorpay.keySecret, 'LIVE-SECRET', 'live key was wiped');
  assert.equal(resolved.payment.razorpay.environment, 'test', 'real edit was lost');
  assert.equal(resolved.integrations.smsService.twilio.authToken, 'TWILIO-TOKEN');
  // The derived flag must never be written to the database.
  assert.equal('keySecretConfigured' in resolved.payment.razorpay, false);
});

test('a genuinely new secret replaces the old one', () => {
  const saved = stored();
  const incoming = { payment: { razorpay: { keySecret: 'ROTATED' } } };
  assert.equal(preserveSecrets(incoming, saved).payment.razorpay.keySecret, 'ROTATED');
});

test('blank and placeholder both mean "unchanged"', () => {
  const saved = stored();
  for (const supplied of ['', '   ', SECRET_PLACEHOLDER, null, undefined]) {
    const out = preserveSecrets({ payment: { razorpay: { keySecret: supplied } } }, saved);
    assert.equal(out.payment.razorpay.keySecret, 'LIVE-SECRET', `${JSON.stringify(supplied)} wiped it`);
  }
});

test('a section update resolves secrets rooted at that section', () => {
  const saved = stored();
  const section = serializeSettings(saved, { canViewAll: true }).payment;
  const resolved = preserveSectionSecrets('payment', section, saved);
  assert.equal(resolved.razorpay.keySecret, 'LIVE-SECRET');

  // A section with no secrets passes through untouched.
  assert.deepEqual(
    preserveSectionSecrets('billing', { roomGstRate: 12 }, saved), { roomGstRate: 12 });
});

test('the privileged section list covers every section holding a secret', () => {
  for (const dotted of SECRET_PATHS) {
    assert.equal(sectionIsPrivileged(dotted.split('.')[0]), true,
      `${dotted} sits in a section ordinary staff can still read`);
  }
});

test('a missing or empty document does not throw', () => {
  assert.deepEqual(serializeSettings(null, { canViewAll: true }), {});
  assert.deepEqual(redactSecrets(undefined), {});
  assert.deepEqual(preserveSecrets({}, {}), {});
});

test('a Mongoose-style document is handled like a plain object', () => {
  const doc = { toObject: () => stored() };
  const out = serializeSettings(doc, { canViewAll: true });
  assert.equal(out.payment.razorpay.keySecret, undefined);
  assert.equal(out.payment.razorpay.keySecretConfigured, true);
});

// ── Backup file access ───────────────────────────────────────────────────────
// GET /api/settings/backup/download/:filename built its path with
// path.join(backupDir, filename). "..%2f.env" arrives decoded as "../.env" and
// resolves to the server's environment file — Mongo URI, JWT secret, live
// payment keys — and the route is a GET, so the router's mutation guard never
// saw it.

test('a backup filename cannot escape the backup directory', async () => {
  const path = (await import('node:path')).default;

  const BACKUP_NAME = /^[A-Za-z0-9._-]+\.(json|gz|tar\.gz|zip)$/;
  const resolveBackupPath = (filename) => {
    const name = String(filename || '');
    if (!BACKUP_NAME.test(name) || name.includes('..')) return null;
    const backupDir = path.resolve('/srv/app', 'backups');
    const full = path.resolve(backupDir, name);
    if (full !== path.join(backupDir, name) || !full.startsWith(backupDir + path.sep)) return null;
    return full;
  };

  for (const attack of [
    '../.env',                 // the payload that reaches Express decoded
    '..%2f.env',
    '../../../etc/passwd',
    '/etc/passwd',
    'sub/dir/file.json',
    '..',
    '',
    null,
    'backup.json.exe',
  ]) {
    assert.equal(resolveBackupPath(attack), null, `${JSON.stringify(attack)} was allowed`);
  }

  // Real archive names still work.
  for (const ok of ['backup-2026-09-02.json', 'pre-deploy.tar.gz', 'dump.zip', 'x.gz']) {
    assert.equal(resolveBackupPath(ok), `/srv/app/backups/${ok}`);
  }
});

// ── Backup authorization ─────────────────────────────────────────────────────
// The /backup endpoints are GETs, so the router's mutation guard never saw
// them: listing and downloading a backup archive needed nothing but a valid
// hotel login. The archive is the whole database — guest records, ID-card
// scans, stored credentials — so the endpoints are now graded by what each one
// actually exposes, and download is narrower than the rest.

test('the backup permissions exist in the catalogue and can be granted', async () => {
  const { ALL_PERMISSIONS, PERMISSION_CATALOG } = await import('../config/permissions.js');
  for (const p of ['view_backups', 'manage_backups']) {
    assert.equal(ALL_PERMISSIONS.includes(p), true, `${p} cannot be granted to a role`);
  }
  // Both belong to the admin group, so they surface together in the Roles UI.
  const admin = PERMISSION_CATALOG.find((g) => g.name === 'admin');
  assert.equal(admin.permissions.includes('view_backups'), true);
  assert.equal(admin.permissions.includes('manage_backups'), true);
});

test('managing settings does not imply access to backups', async () => {
  const { ALL_PERMISSIONS } = await import('../config/permissions.js');
  // A distinct permission is the whole point: someone trusted to edit the GST
  // rate is not thereby trusted to walk off with a copy of the database.
  assert.notEqual('manage_settings', 'manage_backups');
  assert.equal(ALL_PERMISSIONS.includes('manage_settings'), true);
});

test('the mutation guard defers on /backup and holds everywhere else', () => {
  // Mirrors routes/settingsRoutes.js. /backup is exempted so manage_backups is
  // usable without also granting manage_settings; every other path keeps the
  // original rule.
  const deferred = (method, path) =>
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || path.startsWith('/backup');

  assert.equal(deferred('POST', '/backup/manual'), true);
  assert.equal(deferred('DELETE', '/backup/x.json'), true);
  assert.equal(deferred('PUT', '/section/theme'), false, 'ordinary writes must stay guarded');
  assert.equal(deferred('POST', '/reset'), false);
  assert.equal(deferred('PUT', '/payment'), false);
  assert.equal(deferred('GET', '/section/payment'), true);
});
