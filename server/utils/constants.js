/**
 * Application-wide constants
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FRONT_DESK: 'Front Desk',
  HOUSEKEEPING_SUPERVISOR: 'Housekeeping Supervisor',
  HOUSEKEEPING_STAFF: 'Housekeeping Staff',
  RESTAURANT_MANAGER: 'Restaurant Manager',
  RESTAURANT_STAFF: 'Restaurant Staff',
  ACCOUNTANT: 'Accountant',
  MAINTENANCE: 'Maintenance',
  SECURITY: 'Security',
  GUEST: 'Guest'
};

// Room Status
export const ROOM_STATUS = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  DIRTY: 'Dirty',
  MAINTENANCE: 'Maintenance',
  OUT_OF_ORDER: 'Out of Order',
  RESERVED: 'Reserved'
};

// Booking Status
export const BOOKING_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show'
};

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  FAILED: 'Failed'
};

// Housekeeping Task Types
export const TASK_TYPES = {
  REGULAR_CLEANING: 'Regular Cleaning',
  DEEP_CLEANING: 'Deep Cleaning',
  LAUNDRY: 'Laundry',
  MAINTENANCE: 'Maintenance',
  INSPECTION: 'Inspection',
  OTHER: 'Other'
};

// Priority Levels
export const PRIORITY_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent'
};

// Task Status
export const TASK_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\d{10}$/,
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  GST_NUMBER: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PAN_NUMBER: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAR_NUMBER: /^\d{12}$/
};

// Default Values
export const DEFAULTS = {
  PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  SESSION_TIMEOUT: 3600000, // 1 hour in milliseconds
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900000 // 15 minutes in milliseconds
};

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB in bytes
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Date Formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm'
};