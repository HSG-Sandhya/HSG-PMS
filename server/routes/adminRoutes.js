import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import * as adminStaffController from '../controllers/adminStaffController.js';
import * as adminRoleController from '../controllers/adminRoleController.js';
import * as adminSettingsController from '../controllers/adminSettingsController.js';

const router = express.Router();

// Apply authentication and admin-only access to all routes
router.use(authenticateToken);
router.use(permissionMiddleware.requireAdmin);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));

// Staff Management Routes (Admin Only)
router.post('/staff', adminStaffController.createStaff);
router.get('/staff', adminStaffController.getAllStaff);
router.get('/staff/stats', adminStaffController.getStaffStats);
router.get('/staff/:id', adminStaffController.getStaffById);
router.put('/staff/:id', adminStaffController.updateStaff);
router.patch('/staff/:id/status', adminStaffController.toggleStaffStatus);
router.patch('/staff/:id/password', adminStaffController.resetStaffPassword);
router.delete('/staff/:id', adminStaffController.deleteStaff);

// Role Management Routes (Admin Only)
router.post('/roles', adminRoleController.createRole);
router.get('/roles', adminRoleController.getAllRoles);
router.get('/roles/stats', adminRoleController.getRoleStats);
router.get('/roles/permissions', adminRoleController.getAvailablePermissions);
router.get('/roles/:id', adminRoleController.getRoleById);
router.put('/roles/:id', adminRoleController.updateRole);
router.patch('/roles/:id/status', adminRoleController.toggleRoleStatus);
router.patch('/roles/:id/permissions', adminRoleController.assignPermissions);
router.delete('/roles/:id', adminRoleController.deleteRole);

// Settings Management Routes (Admin Only)
router.get('/settings', adminSettingsController.getSystemSettings);
router.get('/settings/users', adminSettingsController.getUserManagementSettings);
router.put('/settings/users', adminSettingsController.updateUserManagementSettings);
router.get('/settings/role-templates', adminSettingsController.getRolePermissionsTemplate);
router.post('/settings/role-from-template', adminSettingsController.createRoleFromTemplate);
router.get('/settings/logs', adminSettingsController.getSystemLogs);
router.post('/settings/backup', adminSettingsController.backupSystemData);

export default router;
