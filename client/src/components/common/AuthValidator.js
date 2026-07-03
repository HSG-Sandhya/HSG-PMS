import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isTokenValid, cleanupExpiredAuth } from '../../utils/authDebug';

// Component to validate authentication state periodically
const AuthValidator = () => {
  const { logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check token validity every 30 seconds
    const interval = setInterval(() => {
      const token = localStorage.getItem('token');
      
      if (token && !isTokenValid(token)) {
        console.warn('🔄 Token expired during session, logging out');
        cleanupExpiredAuth();
        logout();
      }
    }, 30000); // 30 seconds

    // Initial check
    const token = localStorage.getItem('token');
    if (token && !isTokenValid(token)) {
      console.warn('🔄 Token expired on mount, logging out');
      cleanupExpiredAuth();
      logout();
    }

    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  return null; // This component doesn't render anything
};

export default AuthValidator;
