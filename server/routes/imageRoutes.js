import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { uploadImage, getImage, deleteImage, listImages } from '../controllers/imageController.js';
import imageUpload from '../middleware/uploadMemory.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('image ID'));

// Authenticated metadata list — used by the Appearance picker to show uploaded
// backgrounds. Declared before `/:id` so it isn't shadowed.
router.get('/', authenticateToken, listImages);

// Public — anyone can fetch an image by id (acts like a CDN URL)
router.get('/:id', getImage);

// Authenticated — upload and delete
router.post('/', authenticateToken, imageUpload.single('image'), uploadImage);
router.delete('/:id', authenticateToken, deleteImage);

export default router;
