import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './logger.js';

// ── Module singleton ────────────────────────────────────────────────────────
let io = null;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const JWT_ALGORITHMS = process.env.JWT_ALGORITHMS
  ? process.env.JWT_ALGORITHMS.split(',').map((a) => a.trim()).filter(Boolean)
  : ['HS256'];

// Mirror the CORS allow-list logic used for the HTTP server in app.js.
const normalizeOrigin = (origin) => origin.trim().replace(/\/$/, '');
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5002'].map(
      normalizeOrigin
    );

/**
 * Attach a Socket.IO server to an existing HTTP server.
 *
 * Connections must present a valid JWT (same secret/algorithms as the REST API)
 * on the handshake — only logged-in staff receive live events. On connect each
 * client joins a general `staff` room and the `housekeeping` room (the target
 * for checkout → cleaning notifications).
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || !IS_PRODUCTION) return callback(null, true);
        if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT handshake guard.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || !process.env.JWT_SECRET) {
      return next(new Error('unauthorized'));
    }
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('staff');
    socket.join('housekeeping');
    logger.info('Socket connected', {
      id: socket.id,
      user: socket.user?.username || socket.user?.id || 'unknown',
    });
    socket.on('disconnect', () => logger.info('Socket disconnected', { id: socket.id }));
  });

  logger.info('Socket.IO initialized');
  return io;
};

export const getIO = () => io;

export const closeSocket = () => {
  if (io) {
    io.close();
    io = null;
  }
};

// ── Safe emit helpers (no-op when sockets aren't initialized) ────────────────

export const emitToRoom = (room, event, payload) => {
  if (!io) return;
  io.to(room).emit(event, payload);
};

/**
 * Broadcast a freshly-submitted website booking to all logged-in staff so the
 * back-office can pop a live alert. No-op when sockets aren't initialized.
 * @param {object} payload  Flat, display-ready booking summary.
 */
export const emitNewWebsiteBooking = (payload) => {
  if (!io || !payload) return;
  io.to('staff').emit('booking:new-website', payload);
};

/**
 * Broadcast a new/updated housekeeping task to the `housekeeping` room.
 * @param {object} task        Housekeeping document (or null — then no-op).
 * @param {object} [room]      Populated Room doc, for the room number.
 */
export const emitHousekeepingTask = (task, room) => {
  if (!io || !task) return;
  const roomNumber = room?.roomNumber || task.roomNumber || null;
  io.to('housekeeping').emit('housekeeping:new-task', {
    taskId: task._id?.toString?.() ?? null,
    roomNumber,
    taskType: task.taskType || 'Regular Cleaning',
    priority: task.priority || 'Medium',
    status: task.status || 'Pending',
    message: roomNumber
      ? `Room ${roomNumber} — ${task.taskType || 'cleaning'} required`
      : 'New housekeeping task',
    createdAt: task.createdAt || new Date(),
  });
};
