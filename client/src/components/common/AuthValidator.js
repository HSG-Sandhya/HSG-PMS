import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';

/**
 * Notices when a session dies mid-visit — expired, logged out elsewhere, or
 * revoked by an administrator.
 *
 * It used to decode the JWT from localStorage and check `exp` locally. The
 * credential is now an HttpOnly cookie, so the only way to know is to ask the
 * server; that also catches server-side revocation, which the local check never
 * could.
 */
const AuthValidator = () => {
  const { logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    const check = async () => {
      const user = await authService.fetchSession();
      if (!cancelled && !user) {
        console.warn('Session no longer valid — signing out');
        logout();
      }
    };

    // Every 5 minutes rather than every 30 seconds: this is a network call now,
    // and the axios interceptor already reacts to a 401 on any real request.
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, logout]);

  return null;
};

export default AuthValidator;
