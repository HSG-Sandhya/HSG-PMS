import Housekeeping from '../models/Housekeeping.js';
import Room from '../models/Room.js';
import { emitHousekeepingTask } from '../config/socket.js';

// Get all tasks
export const getAllTasks = async (req, res) => {
  try {
    const tasks = await Housekeeping.find()
      .populate('roomId', 'roomNumber type')
      .populate('hallId', 'name capacity')
      .populate('assignedTo', 'firstName lastName username role')
      .populate('completedBy', 'firstName lastName username role')
      .sort({ scheduledFor: 1 });

    res.json({
      success: true,
      data: tasks,
      message: 'Tasks fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get task by ID
export const getTaskById = async (req, res) => {
  try {
    const task = await Housekeeping.findById(req.params.id)
      .populate('roomId', 'roomNumber type')
      .populate('hallId', 'name capacity')
      .populate('assignedTo', 'firstName lastName username role')
      .populate('completedBy', 'firstName lastName username role');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create task
export const createTask = async (req, res) => {
  try {
    const task = new Housekeeping(req.body);
    await task.save();

    // Reflect the task on the room: maintenance tasks mark the room under
    // maintenance, everything else marks it for cleaning.
    let roomDoc = null;
    if (task.roomId) {
      const roomStatus = task.taskType === 'Maintenance' ? 'maintenance' : 'cleaning';
      roomDoc = await Room.findByIdAndUpdate(
        task.roomId,
        { status: roomStatus },
        { new: true }
      );
    }

    // Notify housekeeping clients in real time (no-op if sockets are off).
    emitHousekeepingTask(task, roomDoc);

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update task
export const updateTask = async (req, res) => {
  try {
    if (req.body.assignedTo && !req.body.assignedTo.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid ObjectId format for assignedTo field' });
    }

    const task = await Housekeeping.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isCompletingTask =
      req.body.status === 'Completed' && task.status !== 'Completed';

    Object.assign(task, req.body);
    task.updatedAt = Date.now();

    // Record who completed the task — use the explicit value if provided,
    // otherwise credit the assigned staff member.
    if (isCompletingTask) {
      task.completedBy = req.body.completedBy || task.assignedTo || task.completedBy;
    }

    const updatedTask = await task.save();
    await updatedTask.populate([
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'hallId', select: 'name capacity' },
      { path: 'assignedTo', select: 'firstName lastName username role' },
      { path: 'completedBy', select: 'firstName lastName username role' },
    ]);

    if (isCompletingTask && updatedTask.roomId) {
      await Room.findByIdAndUpdate(updatedTask.roomId, { status: 'available' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(400).json({ message: error.message });
  }
};

// Get housekeeping reports / counts
export const getReports = async (req, res) => {
  try {
    const totalTasks = await Housekeeping.countDocuments();
    const completedTasks = await Housekeeping.countDocuments({ status: 'Completed' });
    const pendingTasks = await Housekeeping.countDocuments({ status: 'Pending' });
    const inProgressTasks = await Housekeeping.countDocuments({ status: 'In Progress' });

    res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        completionRate:
          totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        reportDate: new Date(),
      },
      message: 'Housekeeping report generated successfully',
    });
  } catch (error) {
    console.error('Error generating housekeeping report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating housekeeping report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// Get non-completed tasks for a specific room
export const getTasksByRoom = async (req, res) => {
  try {
    const tasks = await Housekeeping.find({
      roomId: req.params.roomId,
      status: { $ne: 'Completed' },
    }).sort({ scheduledFor: 1 });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks for room:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mark task as completed (with side effect on room status when sourced from notification)
export const completeTask = async (req, res) => {
  try {
    const task = await Housekeeping.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'Completed';
    task.completedBy = req.body?.completedBy || task.assignedTo || task.completedBy;
    task.updatedAt = Date.now();
    const updatedTask = await task.save();

    // A completed task means the room no longer needs attention.
    if (task.roomId) {
      await Room.findByIdAndUpdate(task.roomId, { status: 'available' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(400).json({ message: error.message });
  }
};

// Assign a task to a staff member
export const assignTask = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId || !staffId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'A valid staffId is required' });
    }

    const task = await Housekeeping.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.assignedTo = staffId;
    // Picking up an unstarted task moves it into progress.
    if (task.status === 'Pending') task.status = 'In Progress';
    task.updatedAt = Date.now();

    const updatedTask = await task.save();
    await updatedTask.populate([
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'hallId', select: 'name capacity' },
      { path: 'assignedTo', select: 'firstName lastName username role' },
      { path: 'completedBy', select: 'firstName lastName username role' },
    ]);

    res.json(updatedTask);
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete task
export const deleteTask = async (req, res) => {
  try {
    const task = await Housekeeping.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};