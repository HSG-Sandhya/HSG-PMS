import { io } from 'socket.io-client';

// Resolve the Socket.IO server origin. WebSockets connect directly to the API
// server (the CRA dev proxy only forwards HTTP /api calls):
//   • REACT_APP_SOCKET_URL — explicit override, if set
//   • else derive from REACT_APP_API_URL by stripping a trailing /api
//   • else dev → http://localhost:5002, prod → same origin as the page
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  (process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')
    : '') ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:5002'
    : (typeof window !== 'undefined' ? window.location.origin : ''));

let socket = null;

/**
 * Connect (or reuse) the authenticated staff socket. The server rejects the
 * handshake without a valid JWT, so a token is required.
 */
export const connectSocket = (token) => {
  if (!token) return null;
  if (socket && socket.auth?.token === token) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};
