import { useEffect } from 'react';
import authService from '../../services/authService';

/**
 * Re-confirms the session when the tab comes back to the foreground.
 *
 * This used to sweep expired JWTs out of localStorage on a timer. There is no
 * client-side token to expire any more — the credential is an HttpOnly cookie —
 * so the useful remnant is refreshing the cached profile after the tab has been
 * idle, which also picks up permission changes made while it was away.
 */
const AutoCacheManager = ({ children }) => {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && authService.getCachedUser()) {
        authService.fetchSession();
      }
    };

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return children || null;
};

export default AutoCacheManager;
