import '../config/env.js';
import multer, { diskStorage } from 'multer';
import { dirname, extname, join, isAbsolute } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadDir = isAbsolute(UPLOAD_BASE_DIR)
  ? UPLOAD_BASE_DIR
  : join(__dirname, '..', UPLOAD_BASE_DIR);
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 5 * 1024 * 1024;

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },
  fileFilter: (req, file, cb) => {
    // Allow images and CSV files
    if (file.mimetype.startsWith('image/') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only images and CSV files are allowed'));
    }
  }
});

export default upload;
