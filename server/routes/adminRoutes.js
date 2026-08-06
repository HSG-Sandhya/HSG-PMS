import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import { requireManage } from '../middleware/requireManage.js';
import { enforceStaffAuthority } from '../middleware/staffAuthority.js';
import * as adminStaffController from '../controllers/adminStaffController.js';
import * as adminRoleController from '../controllers/adminRoleController.js';
import * as adminSettingsController from '../controllers/adminSettingsController.js';

const router = express.Router();

// Everything here needs a login.
router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));

// ── Staff management ────────────────────────────────────────────────────────
// These are the endpoints the staff UI actually calls, so they honour the
// granular Staff permissions an admin can grant to a role (Settings → Roles),
// not just "is an admin". `manage_staff` is the umbrella grant; the specific
// ones work on their own too. enforceStaffAuthority then caps a non-admin
// manager to staff/roles below their own level.
const VIEW_STAFF = ['manage_staff', 'view_staff'];

router.post('/staff', requireManage(['manage_staff', 'create_staff']), enforceStaffAuthority, adminStaffController.createStaff);
router.get('/staff', requireManage(VIEW_STAFF), adminStaffController.getAllStaff);
router.get('/staff/stats', requireManage(VIEW_STAFF), adminStaffController.getStaffStats);
router.get('/staff/:id', requireManage(VIEW_STAFF), adminStaffController.getStaffById);
router.put('/staff/:id', requireManage(['manage_staff', 'edit_staff']), enforceStaffAuthority, adminStaffController.updateStaff);
router.patch('/staff/:id/status', requireManage(['manage_staff', 'deactivate_staff']), enforceStaffAuthority, adminStaffController.toggleStaffStatus);
router.patch('/staff/:id/password', requireManage(['manage_staff', 'edit_staff']), enforceStaffAuthority, adminStaffController.resetStaffPassword);
// Hard delete — umbrella grant only (`deactivate_staff` is for the status route).
router.delete('/staff/:id', requireManage('manage_staff'), enforceStaffAuthority, adminStaffController.deleteStaff);

// Reading the role list is part of creating/editing staff (the role picker), so
// it follows the staff permissions rather than admin-only.
router.get('/roles', requireManage([...VIEW_STAFF, 'create_staff', 'edit_staff', 'manage_roles']), adminRoleController.getAllRoles);
router.get('/roles/permissions', requireManage([...VIEW_STAFF, 'create_staff', 'edit_staff', 'manage_roles']), adminRoleController.getAvailablePermissions);

// ── Everything below is administrator-only ──────────────────────────────────
router.use(permissionMiddleware.requireAdmin);

// Role Management Routes (Admin Only)
router.post('/roles', adminRoleController.createRole);
router.get('/roles/stats', adminRoleController.getRoleStats);
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
