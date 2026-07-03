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

router.get('/configurations', getConfigurations);
router.post('/configurations', createConfiguration);
router.post('/sync', syncChannels);
router.get('/reports', getReports);

export default router;
