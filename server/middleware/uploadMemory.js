import multer from 'multer';

// Must stay in sync with the client-side check in ThemeSection.js (8 MB).
// Images are stored as a single MongoDB document, so stay under the 16 MB cap.
export const MAX_UPLOAD_SIZE =
  parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 8 * 1024 * 1024;

// Tagged so the error handler answers 400 rather than 500.
const uploadRejection = (message) => Object.assign(new Error(message), { isUploadRejection: true });

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  // The claimed type is attacker-controlled, so this is only a cheap first pass;
  // verifyUploadedBuffers reads the real bytes afterwards. SVG is named here so
  // the common case is refused before the file is buffered at all.
  fileFilter: (_req, file, cb) => {
    const claimed = String(file.mimetype || '').toLowerCase();
    if (claimed.includes('svg')) {
      return cb(uploadRejection('SVG files are not accepted. Please upload a PNG, JPEG or WebP image.'));
    }
    if (!claimed.startsWith('image/')) {
      return cb(uploadRejection('Only image files are allowed'));
    }
    cb(null, true);
  },
});

export default imageUpload;
