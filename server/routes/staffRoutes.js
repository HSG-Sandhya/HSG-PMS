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
import { requireManage, requirePermission } from '../middleware/requireManage.js';
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

// READS. The roster endpoints stay reachable by anyone signed in, because they
// are the list behind the housekeeping assignment picker and the front desk
// holds manage_housekeeping without view_staff. What changed is the RECORD:
// staffController now returns only picker fields — name, position, department,
// role, status — unless the caller holds a staff-detail permission. Salary,
// date of birth, home address, emergency contact, Aadhaar number and the
// Aadhaar scan URLs are withheld. See services/staffVisibility.js.
//
// The role/permission metadata below is a different thing: it describes what
// the system can grant, not who works here, and it belongs to whoever
// administers roles.
router.get('/', getAllStaff);
router.get('/search', searchStaff);
router.get('/roles', requirePermission(['view_staff', 'manage_staff', 'manage_roles']), getRolesWithPermissions);
router.get('/by-role/:role', getStaffByRole);
router.get('/by-department/:department', getStaffByDepartment);
router.get('/departments/list', getDepartmentsList);
router.get('/available-pages', requirePermission(['manage_roles', 'admin_access']), getAvailablePages);
router.get('/role/:role/page-permissions', requirePermission(['manage_roles', 'admin_access']), getRolePagePermissions);
// Editing what a ROLE can reach is access-control administration, not staff
// management — keep it with the role permission.
router.put('/role/:role/page-permissions', requireManage('manage_roles'), updateRolePagePermissions);
router.get('/:id', getStaffById);
// Staff writes honour the granular Staff permissions (see adminRoutes.js), with
// the same below-your-own-level ceiling for non-admin managers.
router.post('/', requireManage(['manage_staff', 'create_staff']), enforceStaffAuthority, createStaff);
router.put('/:id', requireManage(['manage_staff', 'edit_staff']), enforceStaffAuthority, updateStaff);
router.delete('/:id', requireManage('manage_staff'), enforceStaffAuthority, deleteStaff);
router.get('/:id/permissions', requirePermission(['view_staff', 'manage_staff', 'manage_roles']), getStaffPermissions);
router.post('/:id/check-permission', checkPermission);
router.post('/:id/assign-role', requireAdmin, assignRole);

export default router;
