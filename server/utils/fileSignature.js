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
