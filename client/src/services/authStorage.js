/**
 * Everything the browser keeps about the session, in one place.
 *
 * The credential itself is NOT here — it is an HttpOnly cookie the server sets,
 * which JavaScript cannot read. What remains is a display cache of the user
 * profile so the UI can paint on reload without waiting for a round trip.
 *
 * Both authService and the axios interceptor clear through this module, so the
 * "what counts as auth state" list exists once rather than in two drifting
 * copies.
 */

export const USER_KEY = 'user';

// Written by builds that stored the JWT client-side. Nothing writes them now,
// but a returning browser can still hold them — including a real token — so
// they are swept on every teardown.
export const LEGACY_KEYS = ['token', 'refreshToken', 'auth_timestamp', 'app_session'];

export const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeCachedUser = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode / quota — the app still works, it just re-fetches */
  }
};

export const clearAuthStorage = () => {
  try {
    localStorage.removeItem(USER_KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('tempAuth');
  } catch {
    /* ignore */
  }
};
