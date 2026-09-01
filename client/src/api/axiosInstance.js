import axios from 'axios';
import { clearAuthStorage } from '../services/authStorage';

/**
 * The shared axios instance and its interceptors.
 *
 * Split out of api/index.js so authService can use it without a circular
 * import (api/index.js -> authService -> api/index.js).
 */

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  // 2s was too aggressive — any payload with images (settings, room photos)
  // would consistently time out and the caller falls back to defaults.
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// No request interceptor attaches a credential any more: the session is an
// HttpOnly cookie, sent automatically because of `withCredentials: true` above.
// Reading a token out of localStorage here is exactly what put a 30-day
// credential within reach of any XSS.

axiosInstance.interceptors.response.use(
  response => {
    // Wrap successful responses in a resolved promise to ensure consistent handling
    return Promise.resolve(response);
  },
  error => {
    // Don't log cancelled requests as errors since they're intentional
    if (axios.isCancel(error)) {
      return Promise.reject(new Error('Request was cancelled'));
    }
    
    // Handle message channel closed errors (browser extension related)
    if (error.message && error.message.includes('message channel closed')) {
      return Promise.reject(new Error('Browser communication error'));
    }
    
    // Auto-clear stale auth when the token references a non-existent user (404
    // on /auth/profile) or when the server rejects the token (any 401, or a 403
    // whose message names a bad token).
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;
    const requestUrl = typeof error.config?.url === 'string' ? error.config.url : '';

    const isProfileMiss =
      status === 404 &&
      serverMessage === 'User not found' &&
      requestUrl.includes('/auth/profile');

    // Any 401 means the token was missing/invalid/expired — authenticateToken is
    // the only source of 401s on the API. The lone exception is a failed
    // /auth/login (wrong credentials), which the login form surfaces itself. A
    // 403 only counts when its message names a bad token; a plain permission
    // denial must NOT log the user out.
    const isBadTokenResponse =
      (status === 401 && !requestUrl.includes('/auth/login')) ||
      (status === 403 &&
        [
          'Invalid token',
          'Access denied. Invalid token.',
          'Token expired. Please login again.',
        ].includes(serverMessage));

    if (isProfileMiss || isBadTokenResponse) {
      // Wipe the full auth set, not just token/user, so no stale session
      // fragment can revive a dead login on the next load.
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent('auth-token-invalid'));

      if (
        window.location.pathname !== '/login' &&
        !window.location.pathname.startsWith('/website')
      ) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }
    
    // Handle aborted requests and timeout errors more gracefully
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }
    
    // Handle network errors that might cause message channel closed errors
    if (error.message.includes('Network Error')) {
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }
    
    // Handle component unmounting during requests
    if (error.message.includes('unmounted component')) {
      return Promise.reject(new Error('Operation cancelled'));
    }
    
    // Wrap all rejections in a controlled promise to prevent uncaught exceptions
    return Promise.reject(error);
  },
);


export default axiosInstance;
