import axios from 'axios';

// Store active request cancellation tokens by component ID
const activeRequests = new Map();

// Function to cancel active requests for a specific component
const cancelActiveRequests = (componentId) => {
  if (activeRequests.has(componentId)) {
    const cancelTokens = activeRequests.get(componentId);
    cancelTokens.forEach(cancelToken => {
      if (cancelToken && cancelToken.cancel) {
        cancelToken.cancel('Operation cancelled by user');
      }
    });
    activeRequests.delete(componentId);
  }
};

// Wrapper for API methods to handle cancellation tokens and consistent error handling
const wrapApiMethod = (apiMethod) => {
  return async (data, cancelToken, componentId) => {
    try {
      // If a component ID is provided, store the cancel token for potential cancellation
      if (componentId && cancelToken) {
        if (!activeRequests.has(componentId)) {
          activeRequests.set(componentId, []);
        }
        activeRequests.get(componentId).push(cancelToken);
      }

      // Call the API method with the provided data and cancel token
      const response = await apiMethod(data, cancelToken);
      
      // Remove the cancel token from active requests if it was stored
      if (componentId && cancelToken) {
        const tokens = activeRequests.get(componentId) || [];
        const tokenIndex = tokens.indexOf(cancelToken);
        if (tokenIndex !== -1) {
          tokens.splice(tokenIndex, 1);
        }
      }
      
      return response;
    } catch (error) {
      // Handle errors consistently
      if (axios.isCancel(error)) {
        return Promise.reject(new Error('Request was cancelled'));
      }
      
      // Remove the cancel token from active requests if it was stored
      if (componentId && cancelToken) {
        const tokens = activeRequests.get(componentId) || [];
        const tokenIndex = tokens.indexOf(cancelToken);
        if (tokenIndex !== -1) {
          tokens.splice(tokenIndex, 1);
        }
      }
      
      return Promise.reject(error);
    }
  };
};

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  // 2s was too aggressive — any payload with images (settings, room photos)
  // would consistently time out and the caller falls back to defaults.
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  response => {
    // Wrap successful responses in a resolved promise to ensure consistent handling
    return Promise.resolve(response);
  },
  error => {
    // Don't log cancelled requests as errors since they're intentional
    if (axios.isCancel(error)) {
      return Promise.reject(new Error('Request was cancelled'));
    }
    
    // Handle message channel closed errors (browser extension related)
    if (error.message && error.message.includes('message channel closed')) {
      return Promise.reject(new Error('Browser communication error'));
    }
    
    // Auto-clear stale auth when the token references a non-existent user (404
    // on /auth/profile) or when the server rejects the token (any 401, or a 403
    // whose message names a bad token).
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;
    const requestUrl = typeof error.config?.url === 'string' ? error.config.url : '';

    const isProfileMiss =
      status === 404 &&
      serverMessage === 'User not found' &&
      requestUrl.includes('/auth/profile');

    // Any 401 means the token was missing/invalid/expired — authenticateToken is
    // the only source of 401s on the API. The lone exception is a failed
    // /auth/login (wrong credentials), which the login form surfaces itself. A
    // 403 only counts when its message names a bad token; a plain permission
    // denial must NOT log the user out.
    const isBadTokenResponse =
      (status === 401 && !requestUrl.includes('/auth/login')) ||
      (status === 403 &&
        [
          'Invalid token',
          'Access denied. Invalid token.',
          'Token expired. Please login again.',
        ].includes(serverMessage));

    if (isProfileMiss || isBadTokenResponse) {
      // Wipe the full auth set, not just token/user, so no stale session
      // fragment can revive a dead login on the next load.
      ['token', 'user', 'refreshToken', 'app_session', 'auth_timestamp', 'tempAuth'].forEach(
        (key) => localStorage.removeItem(key),
      );
      window.dispatchEvent(new CustomEvent('auth-token-invalid'));

      if (
        window.location.pathname !== '/login' &&
        !window.location.pathname.startsWith('/website')
      ) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }
    
    // Handle aborted requests and timeout errors more gracefully
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }
    
    // Handle network errors that might cause message channel closed errors
    if (error.message.includes('Network Error')) {
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }
    
    // Handle component unmounting during requests
    if (error.message.includes('unmounted component')) {
      return Promise.reject(new Error('Operation cancelled'));
    }
    
    // Wrap all rejections in a controlled promise to prevent uncaught exceptions
    return Promise.reject(error);
  },
);

// Create a version of the API service that uses the wrapper for all methods
const api = {
  // Basic HTTP methods
  get: (url, config) => axiosInstance.get(url, config),
  post: (url, data, config) => axiosInstance.post(url, data, config),
  put: (url, data, config) => axiosInstance.put(url, data, config),
  delete: (url, config) => axiosInstance.delete(url, config),
  patch: (url, data, config) => axiosInstance.patch(url, data, config),

  auth: {
    login: wrapApiMethod((credentials, cancelToken) => {
      return axiosInstance.post('/auth/login', credentials, cancelToken ? { cancelToken } : undefined);
    }),

    // First-run setup: is the database empty (no users yet)?
    getSetupStatus: () => axiosInstance.get('/auth/setup-status'),
    // Send / verify the email or phone OTP during first-run setup.
    sendSetupOtp: (data) => axiosInstance.post('/auth/setup/otp/send', data),
    verifySetupOtp: (data) => axiosInstance.post('/auth/setup/otp/verify', data),
    // Create the very first admin on an empty database.
    setup: (data) => axiosInstance.post('/auth/setup', data),

    profile: () => {
      return axiosInstance.get('/auth/profile');
    },

    // Self-service: logged-in user changes their own password.
    changeOwnPassword: ({ currentPassword, newPassword }) => {
      return axiosInstance.put('/auth/change-password', { currentPassword, newPassword });
    },

    refreshToken: () => {
      return axiosInstance.post('/auth/refresh-token');
    },
    
    logout: async (componentId) => {
      try {
        // Cancel any pending requests for this component before logout
        if (componentId) {
          cancelActiveRequests(componentId);
        }
        
        await axiosInstance.post('/auth/logout').catch((_error) => {
          // Backend logout endpoint not available
        });
      } catch (_error) {
        // Error calling logout endpoint
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('marriageSettings');
      }
      return { success: true };
    },
  },

  // Dashboard API
  dashboard: {
    getSummary: () => axiosInstance.get('/dashboard/summary'),
    getOccupancyRate: () => axiosInstance.get('/dashboard/occupancy-rate'),
    getRevenueSummary: () => axiosInstance.get('/dashboard/revenue-summary'),
    getMonthlyRevenue: () => axiosInstance.get('/dashboard/monthly-revenue'),
    getRoomTypes: () => axiosInstance.get('/dashboard/room-types'),
    getReservationsMonthly: () => axiosInstance.get('/dashboard/reservations/monthly'),
    getBookingStats: () => axiosInstance.get('/dashboard/booking-stats'),
    getRevenueStats: () => axiosInstance.get('/dashboard/revenue-stats'),
    getBanquetBookings: () => axiosInstance.get('/dashboard/banquet-bookings'),
    getRestaurantSales: () => axiosInstance.get('/dashboard/restaurant/sales'),
    getRestaurantExpenses: () => axiosInstance.get('/dashboard/restaurant/expenses'),
    getRestaurantStats: () => axiosInstance.get('/dashboard/restaurant/stats'),
    getTodayRevenue: () => axiosInstance.get('/dashboard/today-revenue'),
    getOccupancyHistory: () => axiosInstance.get('/dashboard/occupancy-history'),
    getRecentActivities: (limit) => axiosInstance.get(`/dashboard/recent-activities${limit ? `?limit=${limit}` : ''}`),
  },
  rooms: {
    getAll: () => axiosInstance.get('/rooms'),
    getAvailable: (checkIn, checkOut) =>
      axiosInstance.get('/rooms/available', { params: { checkIn, checkOut } }),
    getById: (id) => axiosInstance.get(`/rooms/${id}`),
    create: (roomData) => axiosInstance.post('/rooms', roomData),
    update: (id, roomData) => axiosInstance.put(`/rooms/${id}`, roomData),
    delete: (id) => axiosInstance.delete(`/rooms/${id}`),
    updateStatus: (id, status) => axiosInstance.patch(`/rooms/${id}/status`, { status }),
    getStats: () => axiosInstance.get('/rooms/stats/overview'),
    getByStatus: (status) => axiosInstance.get(`/rooms/status/${status}`),
    getByType: (type) => axiosInstance.get(`/rooms/type/${type}`),
    bulkUpdateStatus: (roomIds, status) => axiosInstance.patch('/rooms/bulk/status', { roomIds, status }),
    uploadImages: (id, formData) => axiosInstance.post(`/rooms/${id}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  },
  bookings: {
    // Optional params, e.g. { status: 'Pending' } or { status: 'Pending,Confirmed', limit: 50 },
    // let callers fetch a filtered slice server-side instead of the whole collection.
    getAll: (params) => axiosInstance.get('/bookings', params ? { params } : undefined),
    getById: (id) => axiosInstance.get(`/bookings/${id}`),
    // Room IDs reserved by a banquet/marriage event over [checkIn, checkOut).
    getBanquetBlocked: (checkIn, checkOut) =>
      axiosInstance.get('/bookings/banquet-blocked', { params: { checkIn, checkOut } }),
    create: (data) => {
      if (data instanceof FormData) {
        return axiosInstance.post('/bookings', data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      return axiosInstance.post('/bookings', data);
    },
    update: (id, data) => {
      if (data instanceof FormData) {
        return axiosInstance.put(`/bookings/${id}`, data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      return axiosInstance.put(`/bookings/${id}`, data);
    },
    delete: (id) => axiosInstance.delete(`/bookings/${id}`),
    // Group booking — one coordinator, several rooms, one master folio.
    createGroup: (data) => axiosInstance.post('/bookings/group', data),
    // Company booking — several employee bookings under one company + credit terms.
    createCompany: (data) => axiosInstance.post('/bookings/company', data),
    // Rooming list: fetch a group/company cluster, then assign rooms per slot.
    getGroup: (groupId) => axiosInstance.get(`/bookings/group/${groupId}`),
    assignRoom: (id, data) => axiosInstance.patch(`/bookings/${id}/assign-room`, data),
    // Advance a whole cluster through the status workflow.
    updateGroupStatus: (groupId, status) => axiosInstance.patch(`/bookings/group/${groupId}/status`, { status }),
    // Append one more room/guest to an existing cluster.
    addRoomToGroup: (groupId, data) => axiosInstance.post(`/bookings/group/${groupId}/room`, data),
    // Move a checked-in guest to a different room mid-stay.
    transfer: (id, data) => axiosInstance.post(`/bookings/${id}/transfer`, data),
    // Physical check-in — flips checkedIn=true and occupies the room.
    checkIn: (id) => axiosInstance.put(`/bookings/${id}/checkin`),
    // Physical check-out — clears presence, frees the room (→ cleaning).
    checkOut: (id) => axiosInstance.put(`/bookings/${id}/checkout`),
    getByDateRange: (startDate, endDate) =>
      axiosInstance.get(`/bookings/range?start=${startDate}&end=${endDate}`),
  },
  // Corporate accounts — rate plans + credit (Phase 2).
  companies: {
    getAll: (params) => axiosInstance.get('/companies', params ? { params } : undefined),
    getAnalytics: () => axiosInstance.get('/companies/analytics'),
    getById: (id) => axiosInstance.get(`/companies/${id}`),
    getHistory: (id) => axiosInstance.get(`/companies/${id}/history`),
    create: (data) => axiosInstance.post('/companies', data),
    update: (id, data) => axiosInstance.put(`/companies/${id}`, data),
    delete: (id) => axiosInstance.delete(`/companies/${id}`),
    recordCreditPayment: (id, amount) => axiosInstance.patch(`/companies/${id}/credit-payment`, { amount }),
  },
  guests: {
    getAll: () => axiosInstance.get('/guests'),
    getById: (id) => axiosInstance.get(`/guests/${id}`),
    create: (data) => axiosInstance.post('/guests', data),
    update: (id, data) => axiosInstance.put(`/guests/${id}`, data),
    delete: (id) => axiosInstance.delete(`/guests/${id}`),
    search: (query) => axiosInstance.get(`/guests/search?q=${query}`),
  },
  users: {
    getAll: () => axiosInstance.get('/users'),
    getById: (id) => axiosInstance.get(`/users/${id}`),
    create: (userData) => axiosInstance.post('/users', userData),
    update: (id, userData) => axiosInstance.put(`/users/${id}`, userData),
    delete: (id) => axiosInstance.delete(`/users/${id}`),
    toggleStatus: (id) => axiosInstance.patch(`/users/${id}/toggle-status`),
  },
  housekeeping: {
    getAll: () => axiosInstance.get('/housekeeping'),
    getById: (id) => axiosInstance.get(`/housekeeping/${id}`),
    create: (data) => {
      // A task must target a room or a banquet hall, and have a task type
      const missingFields = [];
      if (!data.roomId && !data.hallId) missingFields.push('roomId or hallId');
      if (!data.taskType) missingFields.push('taskType');

      if (missingFields.length > 0) {
        // Return a rejected promise with formatted error
        return Promise.reject({
          response: {
            status: 400,
            data: { message: `Missing required fields: ${missingFields.join(', ')}` },
          },
        });
      }

      // Use the exact enum values expected by the backend
      const validStatuses = ['Pending', 'In Progress', 'Completed'];
      const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];

      // Create a new object with validated values and defaults for missing fields
      const taskData = {
        createdAt: new Date().toISOString(),
        ...data,
        status: data.status && validStatuses.includes(data.status) ? data.status : 'Pending',
        priority: data.priority && validPriorities.includes(data.priority) ? data.priority : 'Medium',
      };

      return axiosInstance.post('/housekeeping', taskData);
    },
    update: (id, data) => {
      // Ensure valid enum values if present
      const validStatuses = ['Pending', 'In Progress', 'Completed'];
      const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
      
      const taskData = { ...data };
      
      if (data.status && !validStatuses.includes(data.status)) {
        // Invalid status value, using 'Pending' instead
        taskData.status = 'Pending';
      }
      
      if (data.priority && !validPriorities.includes(data.priority)) {
        // Invalid priority value, using 'Medium' instead
        taskData.priority = 'Medium';
      }
      
      return axiosInstance.put(`/housekeeping/${id}`, taskData);
    },
    delete: async (id) => {
      try {
        return await axiosInstance.delete(`/housekeeping/${id}`);
      } catch (error) {
        if (error.response?.status === 404) {
          // Housekeeping task not found or already deleted
          return { data: { success: true, message: 'Task already removed' } };
        }
        // Error deleting housekeeping task
        throw error;
      }
    },
    // Removed completeTask method - use update method instead
    getForRoom: (roomId) => axiosInstance.get(`/housekeeping/room/${roomId}`),
    // Add these new methods to match what HousekeepingContext is expecting
    getTasks: () => axiosInstance.get('/housekeeping'),
    getTaskById: (id) => axiosInstance.get(`/housekeeping/${id}`),
    addTask: (data) => {
      // A task must target a room or a banquet hall, and have a task type
      const missingFields = [];
      if (!data.roomId && !data.hallId) missingFields.push('roomId or hallId');
      if (!data.taskType) missingFields.push('taskType');

      if (missingFields.length > 0) {
        // Return a rejected promise with formatted error
        return Promise.reject({
          response: {
            status: 400,
            data: { message: `Missing required fields: ${missingFields.join(', ')}` },
          },
        });
      }
      
      // Ensure valid enum values
      const validStatuses = ['Pending', 'In Progress', 'Completed'];
      const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
      
      // Create a new object with validated values and defaults for missing fields
      const taskData = {
        createdAt: new Date().toISOString(),
        ...data,
        status: data.status && validStatuses.includes(data.status) ? data.status : 'Pending',
        priority: data.priority && validPriorities.includes(data.priority) ? data.priority : 'Medium',
      };
      
      return axiosInstance.post('/housekeeping', taskData);
    },
    updateTask: (id, data) => axiosInstance.put(`/housekeeping/${id}`, data),
    deleteTask: async (id) => {
      try {
        return await axiosInstance.delete(`/housekeeping/${id}`);
      } catch (error) {
        if (error.response?.status === 404) {
          // Housekeeping task not found or already deleted
          return { data: { success: true, message: 'Task already removed' } };
        }
        // Error deleting housekeeping task
        throw error;
      }
    },
    assignTask: (id, staffId) => axiosInstance.post(`/housekeeping/${id}/assign`, { staffId }),
  },
  restaurant: {
    getMenuItems: wrapApiMethod((cancelToken) =>
      axiosInstance.get('/restaurant/menu', cancelToken ? { cancelToken } : undefined)),
    createMenuItem: wrapApiMethod((formData, cancelToken) =>
      axiosInstance.post('/restaurant/menu', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...(cancelToken ? { cancelToken } : {}),
      })),
    updateMenuItem: wrapApiMethod((id, formData, cancelToken) =>
      axiosInstance.put(`/restaurant/menu/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...(cancelToken ? { cancelToken } : {}),
      })),
    setMenuItemAvailability: wrapApiMethod((id, isAvailable, cancelToken) =>
      axiosInstance.patch(`/restaurant/menu/${id}/availability`, { isAvailable }, cancelToken ? { cancelToken } : undefined)),
    deleteMenuItem: wrapApiMethod((id, cancelToken) =>
      axiosInstance.delete(`/restaurant/menu/${id}`, cancelToken ? { cancelToken } : undefined)),
    getCategories: wrapApiMethod((cancelToken) =>
      axiosInstance.get('/restaurant/categories', cancelToken ? { cancelToken } : undefined)),
    createCategory: wrapApiMethod((categoryData, cancelToken) =>
      axiosInstance.post('/restaurant/categories', categoryData, cancelToken ? { cancelToken } : undefined)),
    updateCategory: wrapApiMethod((id, categoryData, cancelToken) =>
      axiosInstance.put(`/restaurant/categories/${id}`, categoryData, cancelToken ? { cancelToken } : undefined)),
    deleteCategory: wrapApiMethod((id, cancelToken) =>
      axiosInstance.delete(`/restaurant/categories/${id}`, cancelToken ? { cancelToken } : undefined)),
    // Add CSV upload function
    uploadMenuCSV: wrapApiMethod((formData, cancelToken) =>
      axiosInstance.post('/restaurant/menu/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...(cancelToken ? { cancelToken } : {}),
      })),
    // Orders
    getAll: () => axiosInstance.get('/restaurant/orders'),
    getOrder: (id) => axiosInstance.get(`/restaurant/orders/${id}`),
    getOrdersByBooking: (bookingId) => {
      // Add validation for bookingId to prevent invalid ObjectId errors
      if (!bookingId || typeof bookingId !== 'string' || bookingId.length !== 24) {
        return Promise.resolve({ data: [] }); // Return empty array for invalid booking IDs
      }
      return axiosInstance.get(`/restaurant/orders/booking/${bookingId}`);
    },
    createOrder: (data) => axiosInstance.post('/restaurant/orders', data),
    // Receipts — immutable payment records, one per completed order
    getReceipts: (params) => axiosInstance.get('/restaurant/receipts', { params }),
    getOrderReceipt: (orderId) => axiosInstance.get(`/restaurant/orders/${orderId}/receipt`),
    updateOrder: (id, data) => axiosInstance.put(`/restaurant/orders/${id}`, data),
    deleteOrder: (id) => axiosInstance.delete(`/restaurant/orders/${id}`),
    updateOrderStatus: (id, status) => axiosInstance.patch(`/restaurant/orders/${id}/status`, { status }),
    // Tables
    getTables: wrapApiMethod((cancelToken) =>
      axiosInstance.get('/restaurant/tables', cancelToken ? { cancelToken } : undefined)),
  },
  tables: {
    getAll: () => axiosInstance.get('/restaurant/tables'),
    getTable: (id) => axiosInstance.get(`/restaurant/tables/${id}`),
    createTable: (data) => axiosInstance.post('/restaurant/tables', data),
    updateTable: (id, data) => axiosInstance.put(`/restaurant/tables/${id}`, data),
    // Settle an occupied table: completes its active orders + records the
    // collected dine-in bill in accounting, then frees the table.
    settleTable: (id, data) => axiosInstance.post(`/restaurant/tables/${id}/settle`, data),
    deleteTable: (id) => axiosInstance.delete(`/restaurant/tables/${id}`),
  },
  marriageBookings: {
    getAll: () => axiosInstance.get('/marriage-bookings'),
    getById: (id) => axiosInstance.get(`/marriage-bookings/${id}`),
    create: (bookingData) => axiosInstance.post('/marriage-bookings', bookingData),
    update: (id, bookingData) => axiosInstance.put(`/marriage-bookings/${id}`, bookingData),
    delete: (id) => axiosInstance.delete(`/marriage-bookings/${id}`),
    getAvailableDates: (month, year) => 
      axiosInstance.get(`/marriage-bookings/available-dates/${month}/${year}`),
  },
  // Settings API - Unified Settings Management
  settings: {
    // Core Settings Operations
    getAll: () => axiosInstance.get('/settings'),
    getSection: (section) => axiosInstance.get(`/settings/section/${section}`),
    // No auth — used by the login screen to follow the app theme.
    getPublicTheme: () => axiosInstance.get('/settings/public/theme'),
    updateSection: (section, data) => axiosInstance.put(`/settings/section/${section}`, data),
    // Authentication
    login: (credentials) => axiosInstance.post('/auth/login', credentials),
    logout: () => axiosInstance.post('/auth/logout'),
    getProfile: () => axiosInstance.get('/auth/profile'),
    refreshToken: () => axiosInstance.post('/auth/refresh-token'),
    updateAll: (data) => axiosInstance.put('/settings', data),
    reset: () => axiosInstance.post('/settings/reset'),
    
    // Hotel Profile Management
    uploadLogo: (logoFile) => {
      const formData = new FormData();
      formData.append('logo', logoFile);
      return axiosInstance.post('/settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    
    // Payment Gateway Management
    testPaymentGateway: (gateway, config) => axiosInstance.post('/settings/payment/test-connection', { gateway, config }),
    
    // Tax & Regulatory
    validateGSTNumber: (gstNumber) => axiosInstance.post('/settings/tax/validate-gst', { gstNumber }),
    validatePANNumber: (panNumber) => axiosInstance.post('/settings/tax/validate-pan', { panNumber }),
    
    // Notification Management
    testNotification: (type, config) => axiosInstance.post('/settings/notifications/test', { type, config }),
    
    
    // Backup Management
    createManualBackup: () => axiosInstance.post('/settings/backup/manual'),
    getBackupHistory: () => axiosInstance.get('/settings/backup/history'),
    downloadBackup: (filename) => axiosInstance.get(`/settings/backup/download/${filename}`, { responseType: 'blob' }),
    restoreBackup: (filename) => axiosInstance.post(`/settings/backup/restore/${filename}`),
    deleteBackup: (filename) => axiosInstance.delete(`/settings/backup/${filename}`),
    getStorageStats: () => axiosInstance.get('/settings/backup/storage-stats'),
    
    // Security Management
    updateSecurityPolicy: (policy) => axiosInstance.put('/settings/security/policy', policy),
    testSecuritySettings: () => axiosInstance.post('/settings/security/test'),
    
    // Integration Management
    testIntegrationConnection: (service, config) => axiosInstance.post('/settings/integrations/test-connection', { service, config }),
    updateEmailService: (config) => axiosInstance.put('/settings/integrations/email', config),
    updateSmsService: (config) => axiosInstance.put('/settings/integrations/sms', config),
    updateChannelManager: (config) => axiosInstance.put('/settings/integrations/channel-manager', config),
    updateAnalytics: (config) => axiosInstance.put('/settings/integrations/analytics', config),
    
    // Theme Management
    applyTheme: (themeData) => axiosInstance.post('/settings/theme/apply', themeData),
    getThemePresets: () => axiosInstance.get('/settings/theme/presets'),
    
    // Staff Management
    getShiftTemplates: () => axiosInstance.get('/settings/staff/shift-templates'),
    createRole: (roleData) => axiosInstance.post('/settings/staff/roles', roleData),
    updateRole: (id, roleData) => axiosInstance.put(`/settings/staff/roles/${id}`, roleData),
    deleteRole: (id) => axiosInstance.delete(`/settings/staff/roles/${id}`),
    getAllRoles: () => axiosInstance.get('/settings/staff/roles'),
    
    createDepartment: (deptData) => axiosInstance.post('/settings/staff/departments', deptData),
    updateDepartment: (id, deptData) => axiosInstance.put(`/settings/staff/departments/${id}`, deptData),
    deleteDepartment: (id) => axiosInstance.delete(`/settings/staff/departments/${id}`),
    getAllDepartments: () => axiosInstance.get('/settings/staff/departments'),
    
    // Room Categories Management
    getRoomCategories: () => axiosInstance.get('/settings/room-categories'),
    addRoomCategory: (categoryData) => axiosInstance.post('/settings/room-categories', categoryData),
    updateRoomCategory: (id, categoryData) => axiosInstance.put(`/settings/room-categories/${id}`, categoryData),
    deleteRoomCategory: (id) => axiosInstance.delete(`/settings/room-categories/${id}`),
    
    // Data Management
    exportSettings: () => axiosInstance.get('/settings/export'),
    importSettings: (settingsData) => axiosInstance.post('/settings/import', { settingsData }),
    
    // Static Data
    getCountries: () => axiosInstance.get('/settings/static/countries'),
    getStates: (country) => axiosInstance.get(`/settings/static/states/${country}`),
    getCurrencies: () => axiosInstance.get('/settings/static/currencies'),
    getTimezones: () => axiosInstance.get('/settings/static/timezones'),
    
    // Legacy Support (for backward compatibility)
    getMarriageSettings: async () => {
      try {
        const response = await axiosInstance.get('/settings/section/banquet');
        return response;
      } catch (error) {
        const savedSettings = localStorage.getItem('marriageSettings');
        return savedSettings ? { data: JSON.parse(savedSettings) } : { data: {} };
      }
    },
    
    updateMarriageSettings: async (settingsData) => {
      try {
        return await axiosInstance.put('/settings/section/banquet', settingsData);
      } catch (error) {
        localStorage.setItem('marriageSettings', JSON.stringify(settingsData));
        return { data: settingsData };
      }
    },
    
    getBanquetHallBookingSettings: async () => {
      try {
        const response = await axiosInstance.get('/settings/section/banquet');
        return response;
      } catch (error) {
        const savedSettings = localStorage.getItem('banquetHallBookingSettings');
        return savedSettings ? { data: JSON.parse(savedSettings) } : { data: {} };
      }
    },
    
    updateBanquetHallBookingSettings: async (settingsData) => {
      try {
        return await axiosInstance.put('/settings/section/banquet', settingsData);
      } catch (error) {
        localStorage.setItem('banquetHallBookingSettings', JSON.stringify(settingsData));
        return { data: settingsData };
      }
    }
  },
  staff: {
    getAll: () => axiosInstance.get('/staff'),
    getById: (id) => axiosInstance.get(`/staff/${id}`),
    create: (data) => axiosInstance.post('/staff', data),
    update: (id, data) => axiosInstance.put(`/staff/${id}`, data),
    delete: (id) => axiosInstance.delete(`/staff/${id}`),
    search: (query) => axiosInstance.get(`/staff/search?q=${query}`),
    
    // Role-based endpoints
    getRoles: () => axiosInstance.get('/staff/roles'),
    getByRole: (role) => axiosInstance.get(`/staff/by-role/${role}`),
    getByDepartment: (department) => axiosInstance.get(`/staff/by-department/${department}`),
    getPermissions: (id) => axiosInstance.get(`/staff/${id}/permissions`),
    checkPermission: (id, permission) => axiosInstance.post(`/staff/${id}/check-permission`, { permission }),
    assignRole: (id, role) => axiosInstance.post(`/staff/${id}/assign-role`, { role }),
    getDepartments: () => axiosInstance.get('/staff/departments/list'),
    
    // Page permission management
    getAvailablePages: () => axiosInstance.get('/staff/available-pages'),
    getRolePagePermissions: (role) => axiosInstance.get(`/staff/role/${role}/page-permissions`),
    updateRolePagePermissions: (role, pagePermissions) => axiosInstance.put(`/staff/role/${role}/page-permissions`, { pagePermissions }),
  },
  // Removed staffAttendance API
  // User Management API
  userManagement: {
    getAllUsers: () => axiosInstance.get('/user-management/users'),
    getUserById: (id) => axiosInstance.get(`/user-management/users/${id}`),
    createUser: (userData) => axiosInstance.post('/user-management/users', userData),
    updateUser: (id, userData) => axiosInstance.put(`/user-management/users/${id}`, userData),
    changePassword: (id, passwordData) => axiosInstance.put(`/user-management/users/${id}/password`, passwordData),
    deactivateUser: (id) => axiosInstance.put(`/user-management/users/${id}/deactivate`),
    activateUser: (id) => axiosInstance.put(`/user-management/users/${id}/activate`),
    deleteUser: (id) => axiosInstance.delete(`/user-management/users/${id}`),
    getUsersByDepartment: (departmentId) => axiosInstance.get(`/user-management/users/department/${departmentId}`),
    getUsersByRole: (roleId) => axiosInstance.get(`/user-management/users/role/${roleId}`),
  },
  roomsetting: {
    getAll: () => axiosInstance.get('/settings/rooms'),
    update: (data) => axiosInstance.put('/settings/rooms', data),
    addRoomType: (roomTypeData) => axiosInstance.post('/settings/rooms/types', roomTypeData),
    updateRoomType: (index, roomTypeData) => axiosInstance.put(`/settings/rooms/types/${index}`, roomTypeData),
    deleteRoomType: (index) => axiosInstance.delete(`/settings/rooms/types/${index}`),
    addSeasonalRate: (rateData) => axiosInstance.post('/settings/rooms/seasonal-rates', rateData),
    updateSeasonalRate: (index, rateData) => axiosInstance.put(`/settings/rooms/seasonal-rates/${index}`, rateData),
    deleteSeasonalRate: (index) => axiosInstance.delete(`/settings/rooms/seasonal-rates/${index}`),
  },
  channels: {
    getAll: () => axiosInstance.get('/channels'),
    getById: (id) => axiosInstance.get(`/channels/${id}`),
    create: (data) => axiosInstance.post('/channels', data),
    update: (id, data) => axiosInstance.put(`/channels/${id}`, data),
    delete: (id) => axiosInstance.delete(`/channels/${id}`),
    getStats: (id) => axiosInstance.get(`/channels/${id}/stats`),
    sync: (id) => axiosInstance.post(`/channels/${id}/sync`),
    bulkSync: () => axiosInstance.post('/channels/sync/bulk'),
    getAvailableRooms: () => axiosInstance.get('/channels/rooms/available'),
    updateRoomMappings: (id, roomMappings) => axiosInstance.put(`/channels/${id}/room-mappings`, { roomMappings }),
    calculateRates: (id, rateData) => axiosInstance.post(`/channels/${id}/calculate-rates`, rateData),
    getChannelsReadyForSync: () => axiosInstance.get('/channels/sync/ready'),
  },
  images: {
    list: (category) => axiosInstance.get('/images', { params: category ? { category } : {} }),
    upload: (file, category = 'other') => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', category);
      return axiosInstance.post('/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    delete: (id) => axiosInstance.delete(`/images/${id}`),
  },
  backup: {
    createManual: () => axiosInstance.post('/settings/backup/manual'),
    getAll: () => axiosInstance.get('/settings/backup'),
    getStorageStats: () => axiosInstance.get('/settings/backup/storage-stats'),
    restore: (filename) => axiosInstance.post(`/settings/backup/restore/${filename}`),
    download: (filename) => axiosInstance.get(`/settings/backup/download/${filename}`, { responseType: 'blob' }),
    delete: (filename) => axiosInstance.delete(`/settings/backup/${filename}`),
    upload: (backupFile) => {
      const formData = new FormData();
      formData.append('backup', backupFile);
      return axiosInstance.post('/settings/backup/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  },
  // Bank-account register — now surfaced inside the Accounting module's
  // "Bank Accounts" tab. Transaction/report endpoints were retired in favour
  // of the richer Accounting entries + consolidated reports.
  banking: {
    getAccounts: () => axiosInstance.get('/banking/accounts'),
    getAccountById: (id) => axiosInstance.get(`/banking/accounts/${id}`),
    createAccount: (accountData) => axiosInstance.post('/banking/accounts', accountData),
    updateAccount: (id, accountData) => axiosInstance.put(`/banking/accounts/${id}`, accountData),
    deleteAccount: (id) => axiosInstance.delete(`/banking/accounts/${id}`),
  },
  activityLog: {
    getLogs: (params) => axiosInstance.get('/activity-logs', { params }),
    getStats: () => axiosInstance.get('/activity-logs/stats'),
    clear: (params) => axiosInstance.delete('/activity-logs', { params }),
  },
  accounting: {
    // Income & expense entries
    getEntries: (params) => axiosInstance.get('/accounting/entries', { params }),
    createEntry: (data) => axiosInstance.post('/accounting/entries', data),
    updateEntry: (id, data) => axiosInstance.put(`/accounting/entries/${id}`, data),
    deleteEntry: (id) => axiosInstance.delete(`/accounting/entries/${id}`),
    // Consolidated reports: cash book, ledger, GST, P&L, balance sheet
    getReports: (params) => axiosInstance.get('/accounting/reports', { params }),
  },
  departments: {
    getAll: () => axiosInstance.get('/departments'),
    getById: (id) => axiosInstance.get(`/departments/${id}`),
    create: (departmentData) => axiosInstance.post('/departments', departmentData),
    update: (id, departmentData) => axiosInstance.put(`/departments/${id}`, departmentData),
    delete: (id) => axiosInstance.delete(`/departments/${id}`),
    toggleStatus: (id) => axiosInstance.patch(`/departments/${id}/toggle-status`),
    getStats: () => axiosInstance.get('/departments/stats'),
  },
  
  // Banquet Management API - Missing endpoints added
  banquet: {
    // Banquet Halls
    getHalls: () => axiosInstance.get('/banquet/halls'),
    createHall: (hallData) => axiosInstance.post('/banquet/halls', hallData),
    
    // Banquet Bookings
    getBookings: () => axiosInstance.get('/banquet/bookings'),
    getBookingById: (id) => axiosInstance.get(`/banquet/bookings/${id}`),
    createBooking: (bookingData) => axiosInstance.post('/banquet/bookings', bookingData),
    updateBooking: (id, bookingData) => axiosInstance.put(`/banquet/bookings/${id}`, bookingData),
    deleteBooking: (id) => axiosInstance.delete(`/banquet/bookings/${id}`),

    // Event packages (reusable bundles)
    getPackages: () => axiosInstance.get('/banquet/packages'),
    createPackage: (data) => axiosInstance.post('/banquet/packages', data),
    updatePackage: (id, data) => axiosInstance.put(`/banquet/packages/${id}`, data),
    deletePackage: (id) => axiosInstance.delete(`/banquet/packages/${id}`),

    // Catering packages (reusable per-plate menu bundles)
    getCateringPackages: () => axiosInstance.get('/banquet/catering-packages'),
    createCateringPackage: (data) => axiosInstance.post('/banquet/catering-packages', data),
    updateCateringPackage: (id, data) => axiosInstance.put(`/banquet/catering-packages/${id}`, data),
    deleteCateringPackage: (id) => axiosInstance.delete(`/banquet/catering-packages/${id}`),

    // Decoration packages (reusable flat-price décor bundles)
    getDecorationPackages: () => axiosInstance.get('/banquet/decoration-packages'),
    createDecorationPackage: (data) => axiosInstance.post('/banquet/decoration-packages', data),
    updateDecorationPackage: (id, data) => axiosInstance.put(`/banquet/decoration-packages/${id}`, data),
    deleteDecorationPackage: (id) => axiosInstance.delete(`/banquet/decoration-packages/${id}`),

    // Utensil / cookware inventory (live stock; pass ?excludeBooking when editing)
    getUtensilItems: (excludeBooking) => axiosInstance.get('/banquet/utensil-items', { params: excludeBooking ? { excludeBooking } : {} }),
    createUtensilItem: (data) => axiosInstance.post('/banquet/utensil-items', data),
    updateUtensilItem: (id, data) => axiosInstance.put(`/banquet/utensil-items/${id}`, data),
    deleteUtensilItem: (id) => axiosInstance.delete(`/banquet/utensil-items/${id}`),

    // Event calendar — bookings for a month
    getMonthEvents: (year, month) => axiosInstance.get(`/banquet/calendar/${year}/${month}`),

    // Advance collection ledger
    addPayment: (id, payment) => axiosInstance.post(`/banquet/bookings/${id}/payments`, payment),
    deletePayment: (id, paymentId) => axiosInstance.delete(`/banquet/bookings/${id}/payments/${paymentId}`),

    // Reports
    getReports: () => axiosInstance.get('/banquet/reports'),
    
    // Invoice Generation
    generateInvoice: (bookingId) => axiosInstance.post(`/invoices/booking/${bookingId}`),
    getInvoiceData: (bookingId) => axiosInstance.get(`/invoices/booking/${bookingId}/data`),
  },
  
  // Admin Management API - Enhanced
  admin: {
    // Roles
    getRoles: () => axiosInstance.get('/admin/roles'),
    createRole: (roleData) => axiosInstance.post('/admin/roles', roleData),
    updateRole: (id, roleData) => axiosInstance.put(`/admin/roles/${id}`, roleData),
    deleteRole: (id) => axiosInstance.delete(`/admin/roles/${id}`),
    
    // Staff
    getStaff: () => axiosInstance.get('/admin/staff'),
    createStaff: (staffData) => axiosInstance.post('/admin/staff', staffData),
    updateStaff: (id, staffData) => axiosInstance.put(`/admin/staff/${id}`, staffData),
    deleteStaff: (id) => axiosInstance.delete(`/admin/staff/${id}`),
    resetStaffPassword: (id, body) => axiosInstance.patch(`/admin/staff/${id}/password`, body),
  },

  // Attendance Management API
  attendance: {
    // Get all attendance records with filtering
    getAll: (params) => axiosInstance.get('/attendance', { params }),
    
    // Get daily attendance for all staff
    getDaily: (date) => axiosInstance.get('/attendance/daily', { params: { date } }),
    
    // Get eligible staff for attendance (excluding admin/system admin)
    getEligibleStaff: () => axiosInstance.get('/attendance/eligible-staff'),
    
    // Get attendance statistics
    getStats: (params) => axiosInstance.get('/attendance/stats', { params }),
    
    // Get attendance history for specific staff
    getStaffAttendance: (staffId, params) => axiosInstance.get(`/attendance/staff/${staffId}`, { params }),
    
    // Mark attendance for staff
    markAttendance: (attendanceData) => axiosInstance.post('/attendance', attendanceData),
    
    // Bulk mark attendance for multiple staff
    bulkMarkAttendance: (bulkData) => axiosInstance.post('/attendance/bulk', bulkData),
    
    // Update attendance record
    updateAttendance: (id, updateData) => axiosInstance.put(`/attendance/${id}`, updateData),
    
    // Delete attendance record
    deleteAttendance: (id) => axiosInstance.delete(`/attendance/${id}`),
  },

  // Payroll Management
  payroll: {
    // Get all payrolls
    getAll: (params) => axiosInstance.get('/payroll', { params }),
    
    // Get payroll by ID
    getById: (id) => axiosInstance.get(`/payroll/${id}`),
    
    // Generate payroll for staff
    generatePayroll: (payrollData) => axiosInstance.post('/payroll/generate', payrollData),
    
    // Generate and download payroll PDF
    generatePDF: (id) => axiosInstance.get(`/payroll/${id}/pdf`, { 
      responseType: 'blob',
      headers: { 'Accept': 'application/pdf' }
    }),
    
    // Approve payroll
    approvePayroll: (id) => axiosInstance.put(`/payroll/${id}/approve`),
    
    // Mark payroll as paid
    markAsPaid: (id, paymentData) => axiosInstance.put(`/payroll/${id}/pay`, paymentData),
    
    // Get payroll summary
    getSummary: (params) => axiosInstance.get('/payroll/summary', { params }),
  },

  // Staff Transactions
  staffTransactions: {
    // Get all transactions
    getAll: (params) => axiosInstance.get('/staff-transactions', { params }),
    
    // Get staff transactions
    getByStaff: (staffId, params) => axiosInstance.get(`/staff-transactions/${staffId}/transactions`, { params }),
    
    // Create new transaction
    create: (transactionData) => axiosInstance.post('/staff-transactions', transactionData),
    
    // Update transaction status
    update: (id, updateData) => axiosInstance.put(`/staff-transactions/transactions/${id}`, updateData),
    
    // Delete transaction
    delete: (id) => axiosInstance.delete(`/staff-transactions/transactions/${id}`),
    
    // Get staff transaction summary
    getSummary: (staffId, params) => axiosInstance.get(`/staff-transactions/${staffId}/transactions/summary`, { params }),
  },

  // Staff Recharges
  staffRecharges: {
    // Get all recharges
    getAll: (params) => axiosInstance.get('/staff-recharges', { params }),
    
    // Get staff recharges
    getByStaff: (staffId, params) => axiosInstance.get(`/staff-recharges/${staffId}/recharges`, { params }),
    
    // Create new recharge
    create: (rechargeData) => axiosInstance.post('/staff-recharges', rechargeData),
    
    // Update recharge status
    update: (id, updateData) => axiosInstance.put(`/staff-recharges/recharges/${id}`, updateData),
    
    // Cancel recharge
    cancel: (id) => axiosInstance.delete(`/staff-recharges/recharges/${id}`),
    
    // Get staff recharge summary
    getSummary: (staffId, params) => axiosInstance.get(`/staff-recharges/${staffId}/recharges/summary`, { params }),
    
    // Get recharge by transaction ID
    getByTransactionId: (transactionId) => axiosInstance.get(`/staff-recharges/recharges/transaction/${transactionId}`),
    
    // Get monthly stats
    getMonthlyStats: (year, month) => axiosInstance.get(`/staff-recharges/recharges/stats/${year}/${month}`),
  },

  // Guest Print Forms
  guestPrint: {
    // Generate guest print form HTML
    generateForm: (bookingId, options = {}) => axiosInstance.get(`/guest-print/${bookingId}`, { params: options }),
    
    // Generate guest print form HTML with POST data
    generateFormPost: (bookingId, options = {}) => axiosInstance.post(`/guest-print/${bookingId}`, options),
    
    // Get guest data for form generation
    getGuestData: (bookingId) => axiosInstance.get(`/guest-print/data/${bookingId}`),
  },
};

export default api;