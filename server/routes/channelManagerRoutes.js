import { requirePermission } from '../middleware/requireManage.js';
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getConfigurations,
  createConfiguration,
  syncChannels,
  getReports,
} from '../controllers/channelManagerController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/configurations', requirePermission(['view_channel_bookings', 'manage_channels']), getConfigurations);
router.post('/configurations', createConfiguration);
router.post('/sync', syncChannels);
router.get('/reports', requirePermission(['view_channel_bookings', 'manage_channels']), getReports);

export default router;
