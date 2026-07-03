import express from 'express';
const router = express.Router();
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  changePassword,
  deactivateUser,
  activateUser,
  getUsersByDepartment,
  getUsersByRole
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
const { requireSystemAdmin, requireAdminOrManager } = permissionMiddleware;

// Public health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'User API is running',
    timestamp: new Date().toISOString()
  });
});

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// Basic CRUD Routes (accessible to authenticated users with appropriate permissions)
router.get('/', getAllUsers);
router.get('/role/:role', getUsersByRole);
router.get('/:id', getUserById);
router.post('/', requireSystemAdmin, createUser);
router.put('/:id', requireAdminOrManager, updateUser);
router.delete('/:id', requireSystemAdmin, deleteUser);
router.patch('/:id/toggle-status', requireAdminOrManager, toggleUserStatus);

// Advanced Management Routes (Admin/Manager only)
router.get('/department/:departmentId', requireAdminOrManager, getUsersByDepartment);
router.get('/role-id/:roleId', requireAdminOrManager, getUsersByRole);
router.put('/:id/password', requireAdminOrManager, changePassword);
router.put('/:id/deactivate', requireSystemAdmin, deactivateUser);
router.put('/:id/activate', requireSystemAdmin, activateUser);

export default router;