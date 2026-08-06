import express from 'express';
import {
  getAllStaff,
  searchStaff,
  getRolesWithPermissions,
  getStaffByRole,
  getStaffByDepartment,
  getDepartmentsList,
  getAvailablePages,
  getRolePagePermissions,
  updateRolePagePermissions,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffPermissions,
  checkPermission,
  assignRole,
} from '../controllers/staffController.js';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import { requireManage } from '../middleware/requireManage.js';
import { enforceStaffAuthority } from '../middleware/staffAuthority.js';
import { objectIdParam } from '../middleware/validateObjectId.js';

const router = express.Router();

// Staff records hold salary and personal data, and several endpoints mutate
// roles/permissions — require a valid login for everything here. Access-control
// mutations are additionally restricted to administrators.
router.use(authenticateToken);

// Reject a malformed :id with a clean 400 instead of a Mongoose CastError 500
// (covers every /:id route below — e.g. a stray GET /api/staff/permissions).
router.param('id', objectIdParam('staff ID'));

const requireAdmin = permissionMiddleware.requireAdmin;

router.get('/', getAllStaff);
router.get('/search', searchStaff);
router.get('/roles', getRolesWithPermissions);
router.get('/by-role/:role', getStaffByRole);
router.get('/by-department/:department', getStaffByDepartment);
router.get('/departments/list', getDepartmentsList);
router.get('/available-pages', getAvailablePages);
router.get('/role/:role/page-permissions', getRolePagePermissions);
// Editing what a ROLE can reach is access-control administration, not staff
// management — keep it with the role permission.
router.put('/role/:role/page-permissions', requireManage('manage_roles'), updateRolePagePermissions);
router.get('/:id', getStaffById);
// Staff writes honour the granular Staff permissions (see adminRoutes.js), with
// the same below-your-own-level ceiling for non-admin managers.
router.post('/', requireManage(['manage_staff', 'create_staff']), enforceStaffAuthority, createStaff);
router.put('/:id', requireManage(['manage_staff', 'edit_staff']), enforceStaffAuthority, updateStaff);
router.delete('/:id', requireManage('manage_staff'), enforceStaffAuthority, deleteStaff);
router.get('/:id/permissions', getStaffPermissions);
router.post('/:id/check-permission', checkPermission);
router.post('/:id/assign-role', requireAdmin, assignRole);

export default router;
