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

import { requireManage, requirePermission } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('channel ID'));

router.get('/rooms/available', requirePermission(['view_channel_bookings', 'manage_channels']), getAvailableRoomsForMapping);
router.get('/sync/ready', requirePermission(['view_channel_bookings', 'manage_channels']), getChannelsReadyForSync);
router.post('/sync/bulk', requireManage('manage_channels'), bulkSyncChannels);

router.get('/', requirePermission(['view_channel_bookings', 'manage_channels']), getAllChannels);
router.post('/', requireManage('manage_channels'), createChannel);
router.get('/:id', requirePermission(['view_channel_bookings', 'manage_channels']), getChannelById);
router.put('/:id', requireManage('manage_channels'), updateChannel);
router.delete('/:id', requireManage('manage_channels'), deleteChannel);
router.get('/:id/stats', requirePermission(['view_channel_bookings', 'manage_channels']), getChannelStats);
router.post('/:id/sync', requireManage('manage_channels'), syncChannel);
router.put('/:id/room-mappings', requireManage('manage_channels'), updateRoomMappings);
router.post('/:id/calculate-rates', requireManage('manage_channels'), calculateRates);

export default router;
