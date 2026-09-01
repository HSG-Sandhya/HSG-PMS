import express from 'express';
const router = express.Router();
import { getAllUsers, getUserById, createUser, updateUser, changePassword, deactivateUser, activateUser, unlockUser, deleteUser, getUsersByDepartment, getUsersByRole } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateObjectId.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import { requireManage } from '../middleware/requireManage.js';
const { requireSystemAdmin, requireAdminOrManager } = permissionMiddleware;

// Apply authentication to all routes
router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('user ID'));

// User management routes (Admin only)
router.get('/users', requireAdminOrManager, getAllUsers);
router.get('/users/:id', requireAdminOrManager, getUserById);
router.post('/users', requireSystemAdmin, createUser);
router.put('/users/:id', requireAdminOrManager, updateUser);
router.put('/users/:id/password', requireAdminOrManager, changePassword);
router.put('/users/:id/deactivate', requireSystemAdmin, deactivateUser);
router.put('/users/:id/activate', requireSystemAdmin, activateUser);
// Clear a login lockout. Held to the same level as a password reset — it is a
// remediation a manager needs at the front desk, not a privilege change. There
// is no other way out of a lockout, so gating it higher would mean locking out
// the last admin requires database surgery.
router.put('/users/:id/unlock', requireManage(['manage_staff', 'admin_access']), unlockUser);
// Permanently delete a login credential (System Admin only).
router.delete('/users/:id', requireSystemAdmin, deleteUser);

// Query routes
router.get('/users/department/:departmentId', requireAdminOrManager, getUsersByDepartment);
router.get('/users/role/:roleId', requireAdminOrManager, getUsersByRole);

export default router;