import express from 'express';
const router = express.Router();
import { createUserWithRole, getAllRoles, createRole, getAvailablePermissions } from '../controllers/userRoleController.js';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
const { requireSystemAdmin, requireAdminOrManager } = permissionMiddleware;

// Apply authentication to all routes
router.use(authenticateToken);

// User role management routes
router.post('/users', requireAdminOrManager, createUserWithRole);
router.get('/roles', requireAdminOrManager, getAllRoles);
router.post('/roles', requireSystemAdmin, createRole);
router.get('/permissions', requireAdminOrManager, getAvailablePermissions);

export default router;