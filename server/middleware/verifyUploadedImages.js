import { unlink } from 'fs/promises';
import { imageTypeOfFile } from '../utils/fileSignature.js';
import logger from '../config/logger.js';

/**
 * Runs AFTER multer has written the upload to disk and rejects anything whose
 * real content isn't an image. multer's own filter only saw the filename and
 * the client-supplied Content-Type, both attacker-controlled, so a renamed
 * script or an HTML polyglot passed straight through and landed in a directory
 * that used to be publicly served.
 *
 * Any file that fails is unlinked before the request is refused.
 */
export const verifyUploadedImages = async (req, res, next) => {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : (req.file ? [req.file] : []);

  if (!files.length) return next();

  const bad = [];
  for (const file of files) {
    if (!file?.path) continue;
    const type = await imageTypeOfFile(file.path);
    if (type) {
      file.detectedType = type;
    } else {
      bad.push(file);
    }
  }

  if (!bad.length) return next();

  await Promise.all(files.map(async (f) => {
    try { await unlink(f.path); } catch { /* already gone — nothing to clean up */ }
  }));

  logger.warn('Rejected upload: content is not a valid image', {
    files: bad.map((f) => f.originalname),
    ip: req.ip,
    url: req.originalUrl,
  });

  return res.status(400).json({
    success: false,
    message: 'Uploaded file is not a valid image.',
  });
};

export default verifyUploadedImages;
