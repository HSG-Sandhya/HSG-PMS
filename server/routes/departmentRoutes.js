import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus,
  getDepartmentStats
} from '../controllers/departmentController.js';
import { authenticateToken } from '../middleware/auth.js';

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('department ID'));

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Department CRUD routes
router.get('/', getAllDepartments);
router.get('/stats', getDepartmentStats);
router.get('/:id', getDepartmentById);
router.post('/', requireManage('manage_departments'), createDepartment);
router.put('/:id', requireManage('manage_departments'), updateDepartment);
router.delete('/:id', requireManage('manage_departments'), deleteDepartment);
router.patch('/:id/toggle-status', requireManage('manage_departments'), toggleDepartmentStatus);

export default router;
