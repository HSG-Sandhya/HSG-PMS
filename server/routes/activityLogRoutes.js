import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getLogs, getStats, clearLogs } from '../controllers/activityLogController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getLogs);
router.get('/stats', getStats);
router.delete('/', clearLogs);

export default router;
