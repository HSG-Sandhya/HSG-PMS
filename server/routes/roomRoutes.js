import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import imageUpload from '../middleware/uploadMemory.js';
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getRoomStats,
  getRoomsByStatus,
  getRoomsByType,
  bulkUpdateRoomStatus,
  uploadRoomImages,
  deleteRoomImage,
  getAvailableRooms,
} from '../controllers/roomController.js';

import { requireManage } from '../middleware/requireManage.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('room ID'));

router.get('/available', getAvailableRooms);
router.get('/stats/overview', getRoomStats);
router.get('/status/:status', getRoomsByStatus);
router.get('/type/:type', getRoomsByType);
router.patch('/bulk/status', requireManage('manage_rooms'), bulkUpdateRoomStatus);

router.get('/', getAllRooms);
router.get('/:id', getRoomById);
router.post('/', requireManage('manage_rooms'), createRoom);
router.put('/:id', requireManage('manage_rooms'), updateRoom);
router.put('/:id/status', requireManage('manage_rooms'), updateRoomStatus);
router.patch('/:id/status', requireManage('manage_rooms'), updateRoomStatus);
router.delete('/:id', requireManage('manage_rooms'), deleteRoom);

router.post('/:id/images', requireManage('manage_rooms'), imageUpload.array('images', 10), uploadRoomImages);
router.delete('/:id/images/:imageId', requireManage('manage_rooms'), deleteRoomImage);

export default router;
