import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { uploadImage, getImage, deleteImage, listImages } from '../controllers/imageController.js';
import imageUpload from '../middleware/uploadMemory.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requireManage.js';
import { verifyUploadedBuffers } from '../middleware/verifyUploadedBuffers.js';

const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('image ID'));

// Writing to the image store was gated on nothing but a valid login, so any
// employee calling the API directly could upload assets into the database — the
// bytes live in MongoDB, not on disk — or delete the hotel's logo and login
// background. Those ids are rendered on the public site and the sign-in screen,
// so a deletion is visible to guests, not just staff.
//
// manage_settings is accepted alongside manage_media so the Appearance picker
// keeps working for the administrators who already use it, while a hotel can
// delegate media without handing over the whole settings panel.
const canManageMedia = requirePermission(['manage_media', 'manage_settings']);

// Metadata list — the Appearance picker's gallery. Declared before `/:id` so it
// isn't shadowed. Not public: it enumerates everything uploaded.
router.get('/', authenticateToken, canManageMedia, listImages);

// Public — anyone can fetch an image by id (acts like a CDN URL). This one has
// to stay open: the login screen and the public site render these through
// <img src>, which cannot send an Authorization header.
router.get('/:id', getImage);

router.post('/', authenticateToken, canManageMedia, imageUpload.single('image'), verifyUploadedBuffers, uploadImage);
router.delete('/:id', authenticateToken, canManageMedia, deleteImage);

export default router;
