import sharp from 'sharp';

/**
 * Resize + compress an uploaded image buffer with sharp.
 *
 * Used by every memory-buffer → MongoDB `Image` upload path (menu items, room
 * photos, generic image uploads). Output is WebP, which is broadly supported and
 * markedly smaller than the equivalent JPEG/PNG.
 *
 * Resilience: any failure (a non-image payload, a corrupt file, a sharp error)
 * returns the ORIGINAL buffer untouched so an upload never breaks — optimization
 * is a best-effort enhancement, not a hard dependency.
 *
 * @param {Buffer} buffer                  Raw uploaded bytes (multer memoryStorage).
 * @param {object} [opts]
 * @param {number} [opts.maxWidth=1600]    Downscale wider images to this width (no enlargement).
 * @param {number} [opts.quality=80]       WebP quality (1-100).
 * @param {string} [opts.contentType]      Original mimetype, returned on fallback.
 * @returns {Promise<{buffer: Buffer, contentType: string, size: number}>}
 */
export const optimizeImage = async (
  buffer,
  { maxWidth = 1600, quality = 80, contentType = 'application/octet-stream' } = {}
) => {
  const original = {
    buffer,
    contentType,
    size: Buffer.isBuffer(buffer) ? buffer.length : 0,
  };

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return original;
  }

  try {
    const optimized = await sharp(buffer)
      .rotate() // honor EXIF orientation, then strip metadata
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    if (!optimized || optimized.length === 0) return original;

    return { buffer: optimized, contentType: 'image/webp', size: optimized.length };
  } catch {
    // Non-image or sharp failure — keep the upload working with the raw bytes.
    return original;
  }
};

export default optimizeImage;
