import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getReports,
  getTasksByRoom,
  completeTask,
  assignTask,
} from '../controllers/housekeepingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('task ID'));
router.param('roomId', objectIdParam('room ID'));

// Housekeeping tasks were previously open — require a valid login for all of
// them (read and mutate).
router.use(authenticateToken);

router.get('/', getAllTasks);
router.get('/tasks', getAllTasks);
router.get('/reports', getReports);
router.get('/room/:roomId', getTasksByRoom);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/complete', completeTask);
router.post('/:id/assign', assignTask);

export default router;
