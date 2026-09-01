import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './logger.js';
import { getCurrentTenant } from '../db/tenantContext.js';
import { resolveTenantForHost } from '../middleware/resolveTenant.js';
import { AUTH_COOKIE } from '../utils/authCookie.js';

// ── Module singleton ────────────────────────────────────────────────────────
let io = null;

// Live events are isolated per hotel: staff only ever join their own tenant's
// rooms, and emit helpers target the room for whichever hotel is in context.
const staffRoom = (slug) => `staff:${slug}`;
const housekeepingRoom = (slug) => `housekeeping:${slug}`;

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

  // JWT + tenant handshake guard. A valid signature isn't enough: the token must
  // have been issued for the same hotel the socket is connecting to (resolved
  // from the connection's host), or a hotel-A token could subscribe to hotel-B's
  // live events. The JWT secret is shared across hotels, so this check is what
  // enforces isolation.
  // The session credential is an HttpOnly cookie the browser attaches to the
  // handshake (client sets withCredentials; CORS above allows credentials), so
  // it is read from the cookie header. `auth.token` remains supported for API
  // clients and for sessions issued before the cookie rollout.
  const tokenFromHandshake = (socket) => {
    const raw = socket.handshake.headers?.cookie;
    if (typeof raw === 'string') {
      for (const part of raw.split(';')) {
        const [k, ...rest] = part.trim().split('=');
        if (k === AUTH_COOKIE && rest.length) {
          return decodeURIComponent(rest.join('='));
        }
      }
    }
    return socket.handshake.auth?.token || socket.handshake.query?.token || null;
  };

  io.use(async (socket, next) => {
    const token = tokenFromHandshake(socket);
    if (!token || !process.env.JWT_SECRET) {
      return next(new Error('unauthorized'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
    } catch {
      return next(new Error('unauthorized'));
    }

    const host =
      socket.handshake.headers['x-forwarded-host'] || socket.handshake.headers.host || '';
    let tenantSlug;
    try {
      const result = await resolveTenantForHost(host);
      if (result.error) return next(new Error('unknown tenant'));
      tenantSlug = result.tenant.slug;
    } catch (err) {
      logger.warn('Socket tenant resolution failed', { host, error: err.message });
      return next(new Error('tenant resolution failed'));
    }

    if ((decoded.tenant || 'base') !== tenantSlug) {
      logger.warn('Socket rejected: token tenant mismatch', {
        tokenTenant: decoded.tenant || 'base',
        host,
      });
      return next(new Error('tenant mismatch'));
    }

    socket.user = decoded;
    socket.tenantSlug = tenantSlug;
    return next();
  });

  io.on('connection', (socket) => {
    const slug = socket.tenantSlug || 'base';
    socket.join(staffRoom(slug));
    socket.join(housekeepingRoom(slug));
    logger.info('Socket connected', {
      id: socket.id,
      tenant: slug,
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

// Emit to a base room name, scoped to the current hotel (from tenant context).
export const emitToRoom = (room, event, payload) => {
  if (!io) return;
  io.to(`${room}:${getCurrentTenant().slug}`).emit(event, payload);
};

/**
 * Broadcast a freshly-submitted website booking to the current hotel's staff so
 * the back-office can pop a live alert. No-op when sockets aren't initialized.
 * @param {object} payload  Flat, display-ready booking summary.
 */
export const emitNewWebsiteBooking = (payload) => {
  if (!io || !payload) return;
  io.to(staffRoom(getCurrentTenant().slug)).emit('booking:new-website', payload);
};

/**
 * Broadcast a new/updated housekeeping task to the `housekeeping` room.
 * @param {object} task        Housekeeping document (or null — then no-op).
 * @param {object} [room]      Populated Room doc, for the room number.
 */
export const emitHousekeepingTask = (task, room) => {
  if (!io || !task) return;
  const roomNumber = room?.roomNumber || task.roomNumber || null;
  io.to(housekeepingRoom(getCurrentTenant().slug)).emit('housekeeping:new-task', {
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
