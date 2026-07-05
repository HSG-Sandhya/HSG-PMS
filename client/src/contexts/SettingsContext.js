import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';
import { BILLING_DEFAULTS, OPERATIONS_DEFAULTS } from '../config/operationalDefaults';
import { setLiveBilling } from '../utils/billing';
import { setLiveHotelProfile } from '../utils/hotelProfile';
import { isNight, msUntilNextTransition } from '../utils/daylight';

// Default settings structure
const defaultSettings = {
  // Billing & Tariff — room/POS GST, breakfast charge, default check-in/out
  // times, invoice prefix, currency and discount rules (see operationalDefaults).
  billing: { ...BILLING_DEFAULTS },
  // Operations — housekeeping / payroll / accounting workflow defaults.
  operations: {
    housekeeping: { ...OPERATIONS_DEFAULTS.housekeeping },
    payroll: { ...OPERATIONS_DEFAULTS.payroll },
    accounting: { ...OPERATIONS_DEFAULTS.accounting },
  },
  // Guest messaging — WiFi + food-menu link sent on check-in
  guestMessaging: {
    enabled: true,
    wifiSsid: '',
    wifiPassword: '',
    wifiNetworks: [],
    websiteBaseUrl: '',
    countryCode: '91',
    messageTemplate: '',
  },
  // Hotel Profile Settings
  hotelProfile: {
    hotelName: 'Hotel Sandhya Grand & Marriage Hall',
    legalName: '',
    description: '',
    starRating: 0,
    yearEstablished: new Date().getFullYear(),
    logo: '',
    address: {
      line1: '',
      line2: '',
      area: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
    contact: {
      phone: '',
      altPhone: '',
      email: '',
      website: '',
      whatsappBusinessNumber: '',
    },
    social: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
      whatsapp: '',
    },
    businessRegistration: {
      gstNumber: '',
      panNumber: '',
      fssaiNumber: '',
      cin: '',
    },
    classification: {
      hotelType: 'Hotel',
      starRating: 0,
      amenities: {
        wifi: true,
        parking: true,
        pool: false,
        gym: false,
        restaurant: true,
        spa: false,
        laundry: true,
        reception24h: true,
      },
    },
  },

  // Payment Settings
  payment: {
    currency: 'INR',
    upi: {
      enabled: false,
      upiId: '',
      qrCode: '',
      merchantName: ''
    },
    razorpay: {
      enabled: false,
      environment: 'sandbox',
      keyId: '',
      keySecret: '',
    },
    payu: {
      enabled: false,
      environment: 'test',
      merchantKey: '',
      merchantSalt: '',
    },
    paytm: {
      enabled: false,
      environment: 'staging',
      merchantId: '',
      merchantKey: '',
    },
    stripe: {
      enabled: false,
      environment: 'test',
      publishableKey: '',
      secretKey: '',
    },
  },

  // Tax Settings
  tax: {
    gstNumber: '',
    panNumber: '',
    gstRate: 12,
    cgst: 6,
    sgst: 6,
    serviceCharge: 0,
    taxInclusive: false,
  },


  // Backup Settings
  backup: {
    enabled: false,
    frequency: 'weekly',
    time: '02:00',
    retention: 30,
    location: 'local',
    encryption: true,
    lastBackup: null,
    backupSize: 0,
  },

  // Security Settings
  security: {
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      passwordExpiry: 90,
    },
    loginSecurity: {
      maxAttempts: 5,
      lockoutDuration: 30,
      sessionTimeout: 43200, // 30 days in minutes for persistent login
    },
    twoFactor: {
      enabled: false,
      method: 'email',
    },
    auditLog: {
      enabled: true,
      retention: 365,
    },
  },

  // Integration Settings
  integrations: {
    emailService: {
      provider: 'smtp',
      smtp: {
        host: '',
        port: 587,
        username: '',
        password: '',
        secure: false,
      },
      sendgrid: {
        apiKey: '',
      },
      mailgun: {
        apiKey: '',
        domain: '',
      },
    },
    smsService: {
      provider: 'twilio',
      twilio: {
        accountSid: '',
        authToken: '',
        phoneNumber: '',
      },
      messagebird: {
        apiKey: '',
        originator: '',
      },
    },
    analytics: {
      googleAnalytics: {
        enabled: false,
        trackingId: '',
      },
    },
  },

  // Theme Settings
  theme: {
    mode: 'light',
    autoTheme: false,
    primaryColor: '#6366F1',
    secondaryColor: '#EC4899',
    accentColor: '#F59E0B',
    darkTextColor: '#f3f4f6',
    fontFamily: 'Inter',
    fontSize: 16,
    borderRadius: 8,
    backgroundPattern: 'none',
    backgroundStyle: 'none',
    backgroundImage: '',
    solidColor: '#f8fafc',
    solidColorOpacity: 1,
    gradientFrom: '#6366F1',
    gradientTo: '#EC4899',
    gradientAngle: 135,
    bgTexture: 'none',
    surfaceOpacity: 0.05,
    blurStrength: 8,
    darknessLevel: 60,
    compactMode: false,
  },

  // Staff Settings
  staff: {
    shifts: {
      morning: { start: '06:00', end: '14:00' },
      afternoon: { start: '14:00', end: '22:00' },
      night: { start: '22:00', end: '06:00' },
    },
    policies: {
      maxWeeklyHours: 40,
      breakDuration: 30,
      overtimeRate: 1.5,
    },
    notifications: {
      shiftReminders: true,
      overtimeAlerts: true,
      leaveRequests: true,
    },
    roles: [],
    departments: [],
  },

  // Notification Settings
  notifications: {
    email: {
      enabled: true,
      newBooking: true,
      cancellation: true,
      checkIn: true,
      checkOut: true,
      payment: true,
      maintenance: false,
      lowInventory: true,
      systemAlerts: true,
      dailyReports: false,
      weeklyReports: true,
      monthlyReports: true
    },
    sms: {
      enabled: false,
      newBooking: true,
      cancellation: true,
      checkIn: false,
      checkOut: false,
      payment: true,
      maintenance: false,
      lowInventory: false,
      systemAlerts: true,
      emergencyOnly: true
    },
    desktop: {
      enabled: true,
      newBooking: true,
      cancellation: true,
      checkIn: true,
      checkOut: true,
      payment: true,
      maintenance: true,
      lowInventory: true,
      systemAlerts: true,
      position: 'top-right',
      duration: 5000,
      showPreview: true
    },
    sound: {
      enabled: true,
      newBooking: true,
      cancellation: false,
      checkIn: true,
      checkOut: true,
      payment: true,
      maintenance: true,
      systemAlerts: true,
      volume: 70,
      soundTheme: 'default'
    },
    preferences: {
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      },
      priority: {
        high: ['payment', 'systemAlerts', 'maintenance'],
        medium: ['newBooking', 'cancellation'],
        low: ['checkIn', 'checkOut', 'lowInventory']
      },
      frequency: {
        immediate: ['payment', 'systemAlerts'],
        batched: ['checkIn', 'checkOut'],
        digest: ['lowInventory']
      }
    },
    customRecipients: []
  },

  // System Settings
  system: {
    language: 'en',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    maintenanceMode: false,
  },
};

// Create the context
export const SettingsContext = createContext();

// Settings are only fetched once authenticated, so pre-auth screens (the login
// page) would always render the default light theme. We cache the last-applied
// theme per device and seed from it, so login follows the app's appearance.
const THEME_CACHE_KEY = 'pms-theme-cache';

// Same idea as the theme cache, but for the hotel's visual identity (logo +
// name). Without it, a refresh renders `hotelProfile.logo = ''` from the
// defaults for a frame — so the sidebar flashes the initials monogram before
// the server fetch swaps in the real logo. Seeding from this cache puts the
// logo on screen from frame 1.
const IDENTITY_CACHE_KEY = 'pms-hotel-identity';

const readCache = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null; // missing/corrupt cache or blocked storage — use defaults
  }
};
const readCachedTheme = () => readCache(THEME_CACHE_KEY);
const readCachedIdentity = () => readCache(IDENTITY_CACHE_KEY);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const cachedTheme = readCachedTheme();
    const cachedIdentity = readCachedIdentity();
    return {
      ...defaultSettings,
      theme: cachedTheme ? { ...defaultSettings.theme, ...cachedTheme } : defaultSettings.theme,
      hotelProfile: cachedIdentity
        ? { ...defaultSettings.hotelProfile, ...cachedIdentity }
        : defaultSettings.hotelProfile,
    };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // useAuth() is a thin useContext wrapper that returns undefined (it never
  // throws) when no AuthProvider is mounted, so it's safe to call directly —
  // keeping it out of a try/catch also satisfies the rules-of-hooks lint.
  const authContext = useAuth();
  const isAuthenticated = authContext?.isAuthenticated || false;

  // Keep the device cache in sync with whatever theme is live in the app.
  // Only while authenticated — pre-auth error paths fall back to
  // defaultSettings and must not clobber a good cache with light mode.
  useEffect(() => {
    if (!isAuthenticated || !settings?.theme) return;
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(settings.theme));
    } catch {
      // storage full or blocked — login just won't be themed on this device
    }
  }, [settings?.theme, isAuthenticated]);

  // Cache the hotel logo + name so a refresh paints the real logo immediately
  // instead of flashing the initials monogram. Only cache the two identity
  // fields the sidebar seeds from — not the whole (large) hotelProfile.
  useEffect(() => {
    if (!isAuthenticated || !settings?.hotelProfile) return;
    try {
      localStorage.setItem(
        IDENTITY_CACHE_KEY,
        JSON.stringify({
          logo: settings.hotelProfile.logo || '',
          hotelName: settings.hotelProfile.hotelName || '',
        })
      );
    } catch {
      // storage full or blocked — refresh just flashes the monogram briefly
    }
  }, [settings?.hotelProfile?.logo, settings?.hotelProfile?.hotelName, isAuthenticated]);

  // Keep the module-level billing config in lock-step with settings so plain
  // (non-React) formatters, print/invoice builders and hook-less components read
  // the configured symbol and rates.
  useEffect(() => {
    setLiveBilling(settings?.billing);
  }, [settings?.billing]);

  // Keep the module-level hotel identity in sync so print/receipt/invoice
  // builders render the configured name, GSTIN, phone and address.
  useEffect(() => {
    setLiveHotelProfile(settings?.hotelProfile);
  }, [settings?.hotelProfile]);

  const loadSettings = useCallback(async (retryCount = 0) => {
    await fetchFreshSettings(retryCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchFreshSettings = useCallback(async (retryCount = 0) => {
    const maxRetries = 2;
    
    // Only skip loading if user is explicitly not authenticated AND auth is not loading
    if (isAuthenticated === false && authContext?.loading === false) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.settings.getAll();
      // API response received
      
      // Handle different response formats
      let settingsData = defaultSettings;
      
      if (response.data) {
        if (response.data.success && response.data.data) {
          // New API format: { success: true, data: {...}, message: "..." }
          settingsData = { ...defaultSettings, ...response.data.data };

          // Ensure all sections are properly loaded
          Object.keys(defaultSettings).forEach(key => {
            if (!settingsData[key] && response.data.data[key]) {
              settingsData[key] = response.data.data[key];
            }
          });
        } else if (response.data.success === false) {
          // API returned error
          setError(response.data.message || 'Failed to load settings');
          // Don't reset to defaults on API error - keep existing settings
          return;
        } else if (typeof response.data === 'object') {
          // Old/direct format: settings object directly
          settingsData = { ...defaultSettings, ...response.data };
        }
      }
      
      setSettings(settingsData);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load settings';
      // Error loading settings
      
      // Handle authentication errors specifically
      if (error.response?.status === 401) {
        // Authentication failed, user will be redirected to login
        // Don't set error state for auth failures - let the API interceptor handle it
        // Reset to defaults but KEEP the live theme — the login page must stay
        // on the configured appearance, not flash back to light defaults.
        setSettings((prev) => ({ ...defaultSettings, theme: prev?.theme || defaultSettings.theme }));
        setError(null);
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        // Handle timeout errors with retry logic
        if (retryCount < maxRetries) {
          // Request timeout, retrying...
          setTimeout(() => {
            fetchFreshSettings(retryCount + 1);
          }, 500 * (retryCount + 1)); // Faster retry
          return; // Don't set loading to false yet
        } else {
          // Max retries reached, using default settings (theme preserved)
          setSettings((prev) => ({ ...defaultSettings, theme: prev?.theme || defaultSettings.theme }));
          setError('Settings loading timed out. Using cached configuration.');
        }
      } else {
        setError(errorMessage);
        
        // Only use default settings if we don't have any settings loaded yet
        // This prevents overwriting existing settings on network errors
        setSettings(prevSettings => {
          if (!prevSettings || Object.keys(prevSettings).length === 0) {
            return defaultSettings;
          }
          return prevSettings;
        });
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove isAuthenticated dependency to prevent infinite loops

  // Update specific section of settings
  const updateSettings = useCallback(async (section, data) => {
    try {
      setError(null);
      
      // Updating settings section
      
      const response = await api.settings.updateSection(section, data);
      // Update response received
      
      if (response.data.success) {
        // Update only the specific section instead of replacing entire settings
        setSettings(prev => ({
          ...prev,
          [section]: response.data.data[section] || response.data.data
        }));
        return { success: true, message: response.data.message };
      } else {
        throw new Error(response.data.message || 'Failed to update settings');
      }
    } catch (error) {
      setError(error.message || 'Failed to update settings');
      return { success: false, error: error.message };
    }
  }, []);

  // Update settings temporarily (for real-time preview without saving)
  const updateSettingsTemporary = useCallback((section, data) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data }
    }));
  }, []);

  // Get specific section
  const getSection = useCallback(async (section) => {
    try {
      const response = await api.settings.getSection(section);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to get section');
      }
    } catch (error) {
      return settings[section] || {};
    }
  }, [settings]);

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      setError(null);
      
      const response = await api.settings.reset();
      
      if (response.data.success) {
        setSettings(response.data.data);
        return { success: true, message: response.data.message };
      } else {
        throw new Error(response.data.message || 'Failed to reset settings');
      }
    } catch (error) {
      setError(error.message || 'Failed to reset settings');
      return { success: false, error: error.message };
    }
  }, []);

  // Upload logo
  const uploadLogo = useCallback(async (logoFile) => {
    try {
      setError(null);
      
      const response = await api.settings.uploadLogo(logoFile);
      
      if (response.data.success) {
        // Update the logo in current settings
        setSettings(prev => ({
          ...prev,
          hotelProfile: {
            ...prev.hotelProfile,
            logo: response.data.data.logoUrl,
          },
        }));
        return { success: true, logoUrl: response.data.data.logoUrl };
      } else {
        throw new Error(response.data.message || 'Failed to upload logo');
      }
    } catch (error) {
      setError(error.message || 'Failed to upload logo');
      return { success: false, error: error.message };
    }
  }, []);

  // Toggle auto theme
  const toggleAutoTheme = useCallback(async () => {
    const newAutoTheme = !settings.theme.autoTheme;
    
    try {
      const result = await updateSettings('theme', {
        ...settings.theme,
        autoTheme: newAutoTheme,
      });
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [settings.theme, updateSettings]);

  // Export settings
  const exportSettings = useCallback(async () => {
    try {
      const response = await api.settings.export();
      
      if (response.data.success) {
        // Create and download file
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `hotel-settings-${new Date().toISOString().slice(0,10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        return { success: true, message: 'Settings exported successfully' };
      } else {
        throw new Error(response.data.message || 'Failed to export settings');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Import settings
  const importSettings = useCallback(async (settingsData) => {
    try {
      setError(null);
      
      const response = await api.settings.import(settingsData);
      
      if (response.data.success) {
        setSettings(response.data.data);
        return { success: true, message: response.data.message };
      } else {
        throw new Error(response.data.message || 'Failed to import settings');
      }
    } catch (error) {
      setError(error.message || 'Failed to import settings');
      return { success: false, error: error.message };
    }
  }, []);

  // Load settings when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      // User authenticated, loading settings immediately...
      // Load settings immediately (will use cache if available)
      loadSettings();
      return undefined;
    }
    // Not signed in (login screen). The full settings need auth, but the
    // appearance must apply globally — fetch the public theme section. Until
    // it arrives (or if the server is unreachable) the device-cached theme
    // seeded at startup keeps the page themed.
    let active = true;
    (async () => {
      try {
        const { data } = await api.settings.getPublicTheme();
        const theme = data?.data;
        if (active && theme && typeof theme === 'object') {
          setSettings((prev) => ({
            ...prev,
            theme: { ...defaultSettings.theme, ...theme },
          }));
        }
      } catch {
        // offline / server starting — cached theme still applies
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isAuthenticated, loadSettings]); // Include loadSettings dependency

  // Refetch settings whenever a settings section is changed somewhere in the app
  // (sections broadcast `pms:settings-changed`). This keeps the Sidebar and any
  // other consumer of `useSettings()` in lock-step with the server.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      if (isAuthenticated) loadSettings();
    };
    window.addEventListener('pms:settings-changed', handler);
    return () => window.removeEventListener('pms:settings-changed', handler);
  }, [isAuthenticated, loadSettings]);

  // Automatic light/dark: when theme.autoTheme is on, the app is dark from
  // sunset to sunrise based on the system clock (see utils/daylight). The
  // computed darkMode is applied in-memory only (never persisted) so it never
  // fights a manual save, and it re-evaluates exactly at the next sunrise /
  // sunset — with a ≤5-min safety re-check so it self-corrects after any save.
  useEffect(() => {
    if (!settings?.theme?.autoTheme) return undefined;
    let timer;
    const tick = () => {
      const dark = isNight();
      setSettings((prev) => {
        if (!prev?.theme?.autoTheme || prev.theme.darkMode === dark) return prev;
        return { ...prev, theme: { ...prev.theme, darkMode: dark } };
      });
      timer = setTimeout(tick, Math.min(msUntilNextTransition(), 5 * 60 * 1000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [settings?.theme?.autoTheme]);

  const contextValue = {
    settings,
    loading,
    error,
    updateSettings,
    updateSettingsTemporary,
    getSection,
    resetSettings,
    uploadLogo,
    toggleAutoTheme,
    exportSettings,
    importSettings,
    reload: loadSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use settings
export const useSettings = () => {
  const context = useContext(SettingsContext);
  
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  
  return context;
};

export default SettingsProvider;