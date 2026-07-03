import multer from 'multer';

// Must stay in sync with the client-side check in ThemeSection.js (8 MB).
// Images are stored as a single MongoDB document, so stay under the 16 MB cap.
export const MAX_UPLOAD_SIZE =
  parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 8 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export default imageUpload;
