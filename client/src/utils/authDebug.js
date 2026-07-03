// Decode a JWT payload segment. JWTs use base64url (`-`/`_`, no padding),
// which the browser's atob() does NOT accept — passing a url-encoded segment
// straight to atob throws on any `-`/`_`, which previously made valid tokens
// look invalid and logged users out immediately after login.
const decodeJwtPayload = (segment) => {
  let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  // restore the padding atob requires
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  // handle UTF-8 (e.g. accented names) correctly
  const decoded = decodeURIComponent(
    atob(b64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(decoded);
};

// Token validation utility
export const isTokenValid = (token) => {
  if (!token) return false;

  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return false;

    const payload = decodeJwtPayload(tokenParts[1]);
    const now = Date.now() / 1000;

    // Tokens without an exp claim (e.g. legacy refresh tokens) are treated as
    // non-expiring rather than invalid, so they don't trigger a spurious logout.
    if (!payload.exp) return true;
    return payload.exp > now;
  } catch (error) {
    return false;
  }
};

// Get token expiration info
export const getTokenInfo = (token) => {
  if (!token) return null;
  
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;

    const payload = decodeJwtPayload(tokenParts[1]);
    const now = Date.now() / 1000;

    return {
      valid: !payload.exp || payload.exp > now,
      expired: payload.exp ? payload.exp <= now : false,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
      userId: payload.id,
      email: payload.email,
      username: payload.username
    };
  } catch (error) {
    return null;
  }
};

// Clean up expired authentication data
export const cleanupExpiredAuth = () => {
  const token = localStorage.getItem('token');
  if (token && !isTokenValid(token)) {
    console.warn('🧹 Cleaning up expired authentication data');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return true;
  }
  return false;
};

// Client-side authentication debugging utility
export const debugClientAuth = () => {
  console.log('🔍 CLIENT AUTH DEBUG');
  console.log('====================');
  
  // Check localStorage
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('📦 localStorage state:');
  console.log('- Token exists:', !!token);
  console.log('- Token preview:', token ? token.substring(0, 20) + '...' : 'none');
  console.log('- User exists:', !!user);
  
  if (user) {
    try {
      const userData = JSON.parse(user);
      console.log('- User data:', {
        username: userData.username,
        email: userData.email,
        role: userData.role?.name
      });
    } catch (e) {
      console.log('- User data parse error:', e.message);
    }
  }
  
  // Check token validity
  if (token) {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const now = Date.now() / 1000;
        const isExpired = payload.exp && payload.exp < now;
        
        console.log('🔑 Token analysis:');
        console.log('- Structure valid:', true);
        console.log('- Expires:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'Never');
        console.log('- Is expired:', isExpired);
        console.log('- User ID:', payload.id);
        console.log('- Email:', payload.email);
        
        if (isExpired) {
          console.warn('⚠️ TOKEN IS EXPIRED - This is likely the cause of 401 errors');
          return { expired: true, token, payload };
        }
      }
    } catch (e) {
      console.error('❌ Token parsing failed:', e.message);
      return { invalid: true, token };
    }
  }
  
  return { valid: true, token, user };
};

// Function to test API calls with current token
export const testClientAPI = async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('❌ No token found in localStorage');
    return;
  }
  
  console.log('🧪 Testing API calls with current token...');
  
  try {
    // Test profile endpoint
    const profileResponse = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('👤 Profile endpoint:', profileResponse.status);
    if (!profileResponse.ok) {
      const error = await profileResponse.json();
      console.error('Profile error:', error);
    }

    // Test bookings endpoint
    const bookingsResponse = await fetch('/api/bookings', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Bookings endpoint:', bookingsResponse.status);
    if (!bookingsResponse.ok) {
      const error = await bookingsResponse.json();
      console.error('Bookings error:', error);
    }
    
  } catch (error) {
    console.error('🔥 API test failed:', error);
  }
};

// Auto-clear cache and tokens on app startup
export const autoCleanupOnAppStart = () => {
  // Only clean up if tokens are actually expired, not based on time intervals
  // This allows for persistent login sessions
  
  // Check for expired tokens only
  const cleaned = cleanupExpiredAuth();
  
  // Update app session timestamp for reference (but don't use it for cleanup)
  const currentAppSession = Date.now().toString();
  localStorage.setItem('app_session', currentAppSession);
  
  return cleaned;
};

// Enhanced cleanup function
export const clearAllAuthData = () => {
  // Clear localStorage auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('auth_timestamp');
  
  // Clear sessionStorage auth data
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('tempAuth');
  
  // Clear any auth-related cookies
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
};

// Force token refresh utility
export const forceTokenRefresh = async () => {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('auth_timestamp', Date.now().toString());
        return data.token;
      }
    }
  } catch (error) {
    // Silent fail for production
  }
  
  return null;
};

// Function to immediately clear invalid tokens and redirect
export const clearInvalidTokenAndRedirect = () => {
  console.warn('🧹 Clearing invalid authentication token');
  clearAllAuthData();
  
  // Dispatch event to update AuthContext
  window.dispatchEvent(new CustomEvent('auth-token-invalid'));
  
  // Redirect to login if not already there
  if (window.location.pathname !== '/login' && 
      !window.location.pathname.startsWith('/website')) {
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  }
};

// Auto-run debug on import in development
if (process.env.NODE_ENV === 'development') {
  // Add to window for manual testing
  window.debugClientAuth = debugClientAuth;
  window.testClientAPI = testClientAPI;
  window.clearAllAuthData = clearAllAuthData;
  window.autoCleanupOnAppStart = autoCleanupOnAppStart;
  window.clearInvalidTokenAndRedirect = clearInvalidTokenAndRedirect;
}

// Auto-run cleanup on module import and clear invalid tokens
autoCleanupOnAppStart();

// If we're in development and have an invalid token, clear it immediately
if (process.env.NODE_ENV === 'development') {
  const token = localStorage.getItem('token');
  if (token) {
    const tokenInfo = getTokenInfo(token);
    if (tokenInfo && (!tokenInfo.valid || tokenInfo.userId === 'test')) {
      console.warn('🧹 Detected invalid/test token, clearing automatically');
      clearInvalidTokenAndRedirect();
    }
  }
}
