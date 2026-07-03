import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import {
  getBackupStatus,
  createBackup,
  getSystemStatus,
  scheduleMaintenance,
} from '../controllers/maintenanceController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(permissionMiddleware.requireAdmin);

router.get('/backup/status', getBackupStatus);
router.post('/backup/create', createBackup);
router.get('/system/status', getSystemStatus);
router.post('/system/maintenance', scheduleMaintenance);

export default router;
