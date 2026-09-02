import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyImageBuffer, looksLikeSvg, imageTypeOf, CONTENT_TYPE_BY_EXT } from '../utils/fileSignature.js';
import { verifyUploadedBuffers } from '../middleware/verifyUploadedBuffers.js';

// Settings uploads accepted files on filename alone, and the generic image
// upload on the client-supplied Content-Type — both attacker-controlled. The
// booking identity pipeline already reads the real leading bytes; these paths
// now do the same. SVG is refused outright: it is active content, and
// /api/images/:id serves from our own origin, publicly.

const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
const GIF = Buffer.from('GIF89a' + '\0'.repeat(8), 'latin1');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

const run = (file) => {
  const req = { file, ip: '127.0.0.1' };
  let status = null; let body = null; let nexted = false;
  const res = {
    status(c) { status = c; return this; },
    json(b) { body = b; return this; },
  };
  verifyUploadedBuffers(req, res, () => { nexted = true; });
  return { nexted, status, body, file };
};

test('every SVG spelling is refused, and refused AS an SVG', () => {
  const spellings = [
    '<svg xmlns="x"/>',
    '<?xml version="1.0"?><svg xmlns="x"/>',
    '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "a" "b"><svg xmlns="x"/>',
    '<!-- comment --><svg xmlns="x"/>',
    '   \n\t<svg xmlns="x"/>',
    '<SVG XMLNS="x"/>',
  ];
  for (const s of spellings) {
    assert.equal(looksLikeSvg(Buffer.from(s)), true, `not detected: ${s.slice(0, 30)}`);
    assert.deepEqual(classifyImageBuffer(Buffer.from(s)), { ok: false, reason: 'svg' });
  }
  // A UTF-8 BOM is three BYTES; decoded as latin1 it is not U+FEFF, so a
  // string-level strip misses it and the file is refused for the wrong reason.
  const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('<svg xmlns="x"/>')]);
  assert.deepEqual(classifyImageBuffer(bom), { ok: false, reason: 'svg' });
});

test('an SVG upload is rejected with a reason that says why', () => {
  const r = run({ buffer: Buffer.from('<svg xmlns="x"><script>alert(1)</script></svg>'), originalname: 'logo.svg', mimetype: 'image/svg+xml' });
  assert.equal(r.nexted, false);
  assert.equal(r.status, 400);
  assert.match(r.body.message, /SVG files are not accepted/);
});

test('renaming a script to .jpg does not get it past the check', () => {
  // The old filter looked only at the extension.
  const r = run({ buffer: Buffer.from('#!/bin/sh\nrm -rf /'), originalname: 'harmless.jpg', mimetype: 'image/jpeg' });
  assert.equal(r.nexted, false);
  assert.equal(r.status, 400);
  assert.match(r.body.message, /not an image/);
});

test('an HTML polyglot claiming to be a PNG is refused', () => {
  const r = run({ buffer: Buffer.from('<html><script>alert(1)</script></html>'), originalname: 'x.png', mimetype: 'image/png' });
  assert.equal(r.nexted, false);
  assert.equal(r.status, 400);
});

test('real images pass and carry the type read from their bytes', () => {
  for (const [buf, ext, mime] of [
    [PNG, 'png', 'image/png'],
    [JPEG, 'jpg', 'image/jpeg'],
    [GIF, 'gif', 'image/gif'],
    [WEBP, 'webp', 'image/webp'],
  ]) {
    // Deliberately lying about the type in the request.
    const r = run({ buffer: buf, originalname: 'anything.txt', mimetype: 'text/plain' });
    assert.equal(r.nexted, true, `${ext} should be accepted`);
    assert.equal(r.file.detectedType, ext);
    assert.equal(r.file.safeContentType, mime, 'the stored type must come from the bytes');
  }
});

test('a GIF-headed polyglot is accepted but pinned to image/gif', () => {
  // It really is a valid GIF, so it passes — what makes it inert is that it is
  // stored and served as image/gif rather than as whatever the uploader claimed.
  const polyglot = Buffer.concat([Buffer.from('GIF89a'), Buffer.from('/*<svg onload=alert(1)>*/')]);
  const r = run({ buffer: polyglot, originalname: 'x.gif', mimetype: 'text/html' });
  assert.equal(r.nexted, true);
  assert.equal(r.file.safeContentType, 'image/gif');
});

test('the served content type is whitelisted, so no stored svg can be revived', () => {
  const SAFE = new Set(Object.values(CONTENT_TYPE_BY_EXT));
  assert.equal(SAFE.has('image/svg+xml'), false, 'svg must never be a servable type');
  assert.equal(SAFE.has('text/html'), false);
  for (const t of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']) {
    assert.equal(SAFE.has(t), true);
  }
});

test('a request with no file passes straight through', () => {
  const req = { ip: '1.2.3.4' };
  let nexted = false;
  verifyUploadedBuffers(req, {}, () => { nexted = true; });
  assert.equal(nexted, true, 'a route with an optional upload must not break');
});

test('multiple files are all checked, and one bad file fails the request', () => {
  const req = { files: [{ buffer: PNG, originalname: 'a.png' }, { buffer: Buffer.from('<svg/>'), originalname: 'b.svg' }], ip: '1.2.3.4' };
  let status = null; let nexted = false;
  verifyUploadedBuffers(req, { status(c) { status = c; return this; }, json() { return this; } }, () => { nexted = true; });
  assert.equal(nexted, false);
  assert.equal(status, 400);
});

test('the settings filename filter no longer lists svg', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, '..', 'routes', 'settingsRoutes.js'), 'utf8');
  const filter = src.slice(src.indexOf('const fileFilter'), src.indexOf('const upload = multer'));
  assert.equal(/svg/i.test(filter), false, 'svg must not be an accepted extension');
  assert.match(src, /upload\.single\('logo'\), verifyUploadedBuffers/);
  assert.match(src, /upload\.single\('background'\), verifyUploadedBuffers/);
});

test('imageTypeOf still refuses a truncated header', () => {
  assert.equal(imageTypeOf(Buffer.from([0x89, 0x50])), null);
  assert.equal(imageTypeOf(Buffer.alloc(0)), null);
  assert.equal(imageTypeOf(null), null);
});
