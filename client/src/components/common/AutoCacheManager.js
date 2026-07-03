import { useEffect } from 'react';
import { autoCleanupOnAppStart } from '../../utils/authDebug';

/**
 * AutoCacheManager — drops expired tokens on app start, on tab focus, and
 * every 5 minutes. Valid tokens are left alone so persistent login keeps working.
 */
const AutoCacheManager = ({ children }) => {
  useEffect(() => {
    // Initial sweep: only removes the token if it's expired.
    autoCleanupOnAppStart();

    const interval = setInterval(autoCleanupOnAppStart, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') autoCleanupOnAppStart();
    };
    const handleFocus = () => autoCleanupOnAppStart();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return children || null;
};

export default AutoCacheManager;
