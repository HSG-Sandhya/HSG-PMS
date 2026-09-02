import { requirePermission } from '../middleware/requireManage.js';
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getLogs, getStats, clearLogs } from '../controllers/activityLogController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission(['view_system_logs', 'admin_access']), getLogs);
router.get('/stats', requirePermission(['view_system_logs', 'admin_access']), getStats);
router.delete('/', clearLogs);

export default router;
