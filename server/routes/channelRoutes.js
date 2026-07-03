import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAllChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelStats,
  syncChannel,
  getAvailableRoomsForMapping,
  updateRoomMappings,
  calculateRates,
  getChannelsReadyForSync,
  bulkSyncChannels,
} from '../controllers/channelController.js';

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('channel ID'));

router.get('/rooms/available', getAvailableRoomsForMapping);
router.get('/sync/ready', getChannelsReadyForSync);
router.post('/sync/bulk', requireManage('manage_channels'), bulkSyncChannels);

router.get('/', getAllChannels);
router.post('/', requireManage('manage_channels'), createChannel);
router.get('/:id', getChannelById);
router.put('/:id', requireManage('manage_channels'), updateChannel);
router.delete('/:id', requireManage('manage_channels'), deleteChannel);
router.get('/:id/stats', getChannelStats);
router.post('/:id/sync', requireManage('manage_channels'), syncChannel);
router.put('/:id/room-mappings', requireManage('manage_channels'), updateRoomMappings);
router.post('/:id/calculate-rates', requireManage('manage_channels'), calculateRates);

export default router;
