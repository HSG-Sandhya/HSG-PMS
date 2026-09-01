import axiosInstance from '../api/axiosInstance';
import { readCachedUser, writeCachedUser, clearAuthStorage } from './authStorage';

/**
 * The single client-side authority on authentication.
 *
 * This replaces auth logic that was spread across api.auth.*, AuthContext,
 * authDebug.js, AuthValidator and the axios interceptor — five places that
 * drifted apart badly enough to leave a refresh path that could never succeed.
 *
 * The session credential is an HttpOnly cookie set by the server, so it is NOT
 * readable here by design: `document.cookie` cannot see it and neither can an
 * XSS payload. Consequences worth understanding:
 *
 *   • There is no local "is my token still valid?" check any more. The server
 *     is asked (`fetchSession`), because only it can see the credential.
 *   • Only the non-sensitive user profile is cached in localStorage, purely so
 *     the UI can render immediately on reload. It is a display cache, never
 *     proof of authentication.
 */

const authService = {
  /** Cached profile for first paint. NOT an authentication check. */
  getCachedUser: readCachedUser,

  /**
   * Ask the server who we are. The cookie rides along automatically
   * (withCredentials), so this is the only real answer to "am I signed in?".
   * Resolves to the user, or null when the session is gone.
   */
  async fetchSession() {
    try {
      const { data } = await axiosInstance.get('/auth/profile');
      const user = data?.data || data?.user || null;
      if (user) writeCachedUser(user);
      return user;
    } catch {
      // 401 here is normal: no session. The interceptor handles the redirect.
      return null;
    }
  },

  async login(credentials) {
    const { data } = await axiosInstance.post('/auth/login', credentials);
    if (!data?.success || !data?.user) {
      throw new Error(data?.message || 'Invalid login response');
    }
    // The credential itself arrives as an HttpOnly cookie; nothing to store.
    writeCachedUser(data.user);
    return data.user;
  },

  /**
   * Renew the session. The server re-issues the cookie and picks up any
   * permission changes. Failure is non-fatal — the existing session stands.
   */
  async refresh() {
    try {
      const { data } = await axiosInstance.post('/auth/refresh-token');
      if (data?.user) writeCachedUser(data.user);
      return Boolean(data?.success);
    } catch {
      return false;
    }
  },

  /** Ends the server session (revoking the token) and clears local state. */
  async logout() {
    try {
      await axiosInstance.post('/auth/logout');
    } catch {
      // Never block local cleanup on a network failure.
    }
    clearAuthStorage();
  },

  /** Local-only teardown, for when the server has already rejected us. */
  clear: clearAuthStorage,
};

export default authService;
