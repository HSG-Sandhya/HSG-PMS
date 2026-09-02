import { open } from 'fs/promises';

// Real image signatures. An extension check (which is all the booking upload
// filter did) is trivially bypassed by renaming a script or polyglot to .jpg —
// these read the actual leading bytes instead.
const SIGNATURES = [
  { ext: 'jpg',  bytes: [0xFF, 0xD8, 0xFF] },
  { ext: 'png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { ext: 'gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'bmp',  bytes: [0x42, 0x4D] },
];

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

// WebP is a RIFF container: "RIFF" <4-byte size> "WEBP".
const isWebp = (buf) =>
  buf.length >= 12 &&
  buf.toString('latin1', 0, 4) === 'RIFF' &&
  buf.toString('latin1', 8, 12) === 'WEBP';

/** Identify a buffer's image type from its magic bytes, or null if it isn't one. */
export const imageTypeOf = (buf) => {
  if (!buf || buf.length < 3) return null;
  if (isWebp(buf)) return 'webp';
  return SIGNATURES.find((s) => startsWith(buf, s.bytes))?.ext || null;
};

/** Same check against a file on disk. Returns the type, or null. */
export const imageTypeOfFile = async (filePath) => {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const buf = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buf, 0, 12, 0);
    return imageTypeOf(buf.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
};

/** Content-Type to serve a validated image as — never echo a client-supplied one. */
export const CONTENT_TYPE_BY_EXT = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

/**
 * SVG, detected explicitly so it can be REFUSED with a clear reason rather than
 * just failing to match a bitmap signature.
 *
 * An SVG is a script container, not a picture: served from our own origin with
 * Content-Type image/svg+xml it executes in the page's context. Branding uploads
 * have no need for one, so the answer is to say so.
 *
 * Text-sniffed rather than magic-byte matched, because SVG has no fixed header —
 * it may start with an XML declaration, a comment, a BOM or whitespace.
 */
export const looksLikeSvg = (buf) => {
  if (!buf || !buf.length) return false;

  // Strip a UTF-8 BOM as BYTES. Decoded as latin1 it becomes "ï»¿", not
  // U+FEFF, so a string-level strip silently misses it and the file is
  // refused as "not an image" rather than as the SVG it is.
  let start = 0;
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) start = 3;

  const head = buf.subarray(start, start + 1024).toString('latin1').trimStart();

  // An SVG may open with an XML declaration, a DOCTYPE, comments, or the tag
  // itself — in any combination — so skip over that preamble rather than trying
  // to enumerate the orderings.
  const preamble = /^(?:<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->|\s+)*/;
  return /^<svg[\s>]/i.test(head.replace(preamble, ''));
};

/**
 * Classify an uploaded buffer.
 * @returns {{ ok: true, type: string } | { ok: false, reason: 'svg' | 'not-an-image' }}
 */
export const classifyImageBuffer = (buf) => {
  const type = imageTypeOf(buf);
  if (type) return { ok: true, type };
  if (looksLikeSvg(buf)) return { ok: false, reason: 'svg' };
  return { ok: false, reason: 'not-an-image' };
};
