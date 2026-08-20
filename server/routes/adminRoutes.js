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

// Being able to change the roster implies being able to SEE it. Granting a
// Hotel Manager create/edit/deactivate without `view_staff` used to leave them
// managing an invisible list — they could add a staff member and then not find
// them again. enforceStaffAuthority still caps WHICH staff they may act on, so
// widening the read here doesn't widen their authority.
const SEE_STAFF = [...VIEW_STAFF, 'create_staff', 'edit_staff', 'deactivate_staff'];

router.post('/staff', requireManage(['manage_staff', 'create_staff']), enforceStaffAuthority, adminStaffController.createStaff);
router.get('/staff', requireManage(SEE_STAFF), adminStaffController.getAllStaff);
router.get('/staff/stats', requireManage(SEE_STAFF), adminStaffController.getStaffStats);
router.get('/staff/:id', requireManage(SEE_STAFF), adminStaffController.getStaffById);
router.put('/staff/:id', requireManage(['manage_staff', 'edit_staff']), enforceStaffAuthority, adminStaffController.updateStaff);
router.patch('/staff/:id/status', requireManage(['manage_staff', 'deactivate_staff']), enforceStaffAuthority, adminStaffController.toggleStaffStatus);
// Password resets are administrator-only — the controller enforces it too, so
// the rule holds even if this route is ever re-pointed. A manager maintaining
// staff records has no business taking over their accounts.
router.patch('/staff/:id/password', permissionMiddleware.requireAdmin, enforceStaffAuthority, adminStaffController.resetStaffPassword);
// Hard delete — administrator-only. Destroying the record also destroys the
// attendance and payroll history hanging off it, so a manager gets
// `deactivate_staff` (the status route) instead, which is reversible.
router.delete('/staff/:id', permissionMiddleware.requireAdmin, enforceStaffAuthority, adminStaffController.deleteStaff);

// Reading the role list is part of creating/editing staff (the role picker), so
// it follows the staff permissions rather than admin-only.
router.get('/roles', requireManage([...SEE_STAFF, 'manage_roles']), adminRoleController.getAllRoles);
router.get('/roles/permissions', requireManage([...SEE_STAFF, 'manage_roles']), adminRoleController.getAvailablePermissions);

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
