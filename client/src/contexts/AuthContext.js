import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Display label for the header/menu only. Authorisation is decided by
// PermissionContext.isAdmin() and by the server — never by this string.
const roleOf = (user) => (user?.isSystemAdmin ? 'admin' : user?.role?.name || 'user');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // 🔹 Establish the session on startup.
  //
  // The credential is an HttpOnly cookie, so the client cannot inspect it — the
  // only way to know whether we are signed in is to ask. A cached profile is
  // painted immediately to avoid a flash of the login screen, then confirmed
  // (or discarded) by the server's answer.
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const cached = authService.getCachedUser();
        if (cached) {
          setUser(cached);
          setRole(roleOf(cached));
        }

        const confirmed = await authService.fetchSession();
        if (confirmed) {
          setUser(confirmed);
          setRole(roleOf(confirmed));
          setIsAuthenticated(true);
          // Roll the session forward so permission changes are picked up and
          // the cookie's life is extended on an active user.
          authService.refresh();
        } else {
          // No valid session — never leave the optimistic paint authenticated.
          authService.clear();
          setUser(null);
          setRole(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        authService.clear();
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
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
      const loggedIn = await authService.login(credentials);
      setUser(loggedIn);
      setRole(roleOf(loggedIn));
      setIsAuthenticated(true);
      navigate('/dashboard');
      return { success: true };
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
    await authService.logout();   // revokes server-side, clears the cookie
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
