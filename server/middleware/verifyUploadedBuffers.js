import { classifyImageBuffer, CONTENT_TYPE_BY_EXT } from '../utils/fileSignature.js';
import logger from '../config/logger.js';

/**
 * The memory-storage counterpart of verifyUploadedImages.
 *
 * multer's own filter sees only the filename and the client-supplied
 * Content-Type — both attacker-controlled — so the settings upload accepted
 * anything ending in .jpg and the generic image upload accepted anything
 * claiming to be image/*. This reads the actual leading bytes instead, the same
 * principle already applied to booking identity uploads.
 *
 * SVG is refused by name rather than merely failing the bitmap check, because
 * the reason matters: an SVG is active content. Served from our own origin as
 * image/svg+xml — which /api/images/:id does, publicly — any script inside runs
 * in the page's context. Nothing in branding needs one.
 *
 * On success each file carries `detectedType` and `safeContentType`, so callers
 * store what the bytes actually are and never echo what the client claimed.
 */
export const verifyUploadedBuffers = (req, res, next) => {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : (req.file ? [req.file] : []);

  if (!files.length) return next();

  for (const file of files) {
    if (!file?.buffer) continue;
    const result = classifyImageBuffer(file.buffer);

    if (!result.ok) {
      logger.warn('Rejected upload: content is not an accepted image', {
        filename: file.originalname,
        claimedType: file.mimetype,
        reason: result.reason,
        ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        message: result.reason === 'svg'
          ? 'SVG files are not accepted. Please upload a PNG, JPEG or WebP image.'
          : 'That file is not an image. Please upload a PNG, JPEG, GIF or WebP.',
      });
    }

    file.detectedType = result.type;
    file.safeContentType = CONTENT_TYPE_BY_EXT[result.type] || 'application/octet-stream';
  }

  return next();
};

export default verifyUploadedBuffers;
