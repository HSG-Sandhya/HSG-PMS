import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  isTokenValid,
  autoCleanupOnAppStart,
  clearAllAuthData,
  forceTokenRefresh,
} from '../utils/authDebug';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // 🔹 Initialize auth state from localStorage with auto-cleanup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, run auto-cleanup to clear stale data
        const wasCleared = autoCleanupOnAppStart();
        
        if (wasCleared) {
          setLoading(false);
          return;
        }
        
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
          // Use utility function to validate token
          if (!isTokenValid(storedToken)) {
            // Try to refresh token first
            const newToken = await forceTokenRefresh();
            if (!newToken) {
              setToken(storedToken);
            } else {
              setToken(newToken);
            }
          } else {
            setToken(storedToken);
          }
          
          const userData = JSON.parse(storedUser);
          
          setUser(userData);
          setIsAuthenticated(true);
          
          // Set role with special handling for admin users
          let userRole = userData.role?.name || 'user';
          if (userData.isSystemAdmin || userRole?.toLowerCase().includes('admin')) {
            userRole = 'admin';
          }
          setRole(userRole);
          
        }
      } catch (error) {
        // Auth initialization error
        // Clear corrupted data
        clearAllAuthData();
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    
    // Listen for token invalidation events from API interceptor
    const handleTokenInvalid = () => {
      // Token invalidated, clearing auth state
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setRole(null);
      setError('Session expired. Please login again.');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login' && 
          !window.location.pathname.startsWith('/website')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
    };
    
    window.addEventListener('auth-token-invalid', handleTokenInvalid);

    initializeAuth();

    return () => {
      window.removeEventListener('auth-token-invalid', handleTokenInvalid);
    };
  }, []);

  // 🔹 Login
  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post('/auth/login', credentials);
      
      if (res.data.success && res.data.token) {
        const { token, user } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        setToken(token);
        setUser(user);
        setIsAuthenticated(true);
        
        // Set role with special handling for admin users
        let userRole = user.role?.name || 'user';
        if (user.isSystemAdmin || userRole?.toLowerCase().includes('admin')) {
          userRole = 'admin';
        }
        setRole(userRole);

        navigate('/dashboard');
        return { success: true };
      } else {
        setError('Invalid login response');
        setIsAuthenticated(false);
        return { success: false, error: 'Invalid login response' };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      setIsAuthenticated(false);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Logout
  const logout = async () => {
    // Notify server so the session token can be invalidated, but don't block
    // local cleanup if the network call fails (e.g. offline, expired token).
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore — local cleanup must still happen.
    }

    clearAllAuthData();

    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setRole(null);
    setError(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        role,
        loading,
        error,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
