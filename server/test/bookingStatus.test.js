import test from 'node:test';
import assert from 'node:assert/strict';
import { secretsMatch } from '../utils/secretCompare.js';

// The public booking-status endpoint is authorised by a per-booking token. A
// naive `===` would short-circuit at the first wrong byte, letting the token be
// recovered a byte at a time from response timings.
const TOKEN = 'a3f1c09b7e4d2856a3f1c09b7e4d2856';

test('an exact token matches', () => {
  assert.equal(secretsMatch(TOKEN, TOKEN), true);
});

test('a wrong token of the same length does not match', () => {
  const wrong = 'b3f1c09b7e4d2856a3f1c09b7e4d2856';
  assert.equal(wrong.length, TOKEN.length, 'precondition: same length');
  assert.equal(secretsMatch(wrong, TOKEN), false);
});

test('a correct prefix is worth nothing', () => {
  // The attack this defends against: 31 of 32 bytes right must be as wrong as 0.
  assert.equal(secretsMatch(TOKEN.slice(0, 31) + '0', TOKEN), false);
  assert.equal(secretsMatch(TOKEN.slice(0, 31), TOKEN), false);
});

test('missing, empty and non-string inputs are refused, never thrown on', () => {
  for (const bad of [undefined, null, '', 0, [], {}, ['a']]) {
    assert.equal(secretsMatch(bad, TOKEN), false, `supplied=${JSON.stringify(bad)}`);
    assert.equal(secretsMatch(TOKEN, bad), false, `stored=${JSON.stringify(bad)}`);
  }
});

test('a booking with no stored token can never be unlocked', () => {
  // Legacy rows predate the field. They must be unreachable, not open.
  assert.equal(secretsMatch('', ''), false);
  assert.equal(secretsMatch(undefined, undefined), false);
});

// ── The link the guest actually receives ────────────────────────────────────
import { buildTrackingUrl } from '../services/notificationService.js';

const REF = 'HSG-1042';

test('the tracking link carries the reference and the token', () => {
  const url = buildTrackingUrl('https://sandhyagrand.in', REF, TOKEN);
  assert.equal(url, `https://sandhyagrand.in/booking-status?ref=${REF}&token=${TOKEN}`);
});

test('a bare domain and a trailing slash both produce one clean https link', () => {
  const expected = `https://sandhyagrand.in/booking-status?ref=${REF}&token=${TOKEN}`;
  assert.equal(buildTrackingUrl('sandhyagrand.in', REF, TOKEN), expected);
  assert.equal(buildTrackingUrl('https://sandhyagrand.in/', REF, TOKEN), expected);
  assert.equal(buildTrackingUrl('https://sandhyagrand.in///', REF, TOKEN), expected);
  assert.equal(buildTrackingUrl('http://staging.example.com', REF, TOKEN),
    `http://staging.example.com/booking-status?ref=${REF}&token=${TOKEN}`);
});

test('a reference needing encoding stays intact', () => {
  const url = buildTrackingUrl('https://x.in', 'HSG 10/42', TOKEN);
  assert.ok(url.includes('ref=HSG+10%2F42'), url);
  assert.equal(new URL(url).searchParams.get('ref'), 'HSG 10/42');
});

test('no base URL, no reference or no token means no link at all', () => {
  // Better to send an email with no button than one pointing nowhere.
  assert.equal(buildTrackingUrl('', REF, TOKEN), null);
  assert.equal(buildTrackingUrl('https://x.in', '', TOKEN), null);
  assert.equal(buildTrackingUrl('https://x.in', REF, ''), null);
});
