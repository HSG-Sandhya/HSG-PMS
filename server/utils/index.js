/**
 * Utility functions index
 * Centralized exports for all utility functions
 */

// Validation utilities
export {
  isValidEmail,
  isValidPhone,
  isValidObjectId,
  validatePasswordStrength,
  sanitizeString,
  generateEmployeeId
} from './validation.js';

// Response helpers
export {
  successResponse,
  errorResponse,
  paginationResponse,
  asyncHandler
} from './responseHelpers.js';

// Date helpers
export {
  formatDate,
  calculateAge,
  isPastDate,
  isFutureDate,
  getDateRange
} from './dateHelpers.js';

// Error handling
export {
  AppError,
  createValidationError,
  createNotFoundError,
  createUnauthorizedError,
  createForbiddenError,
  createConflictError,
  handleMongoError,
  handleJWTError,
  globalErrorHandler,
  notFoundHandler
} from './errorHandler.js';

// Constants
export * from './constants.js';

// Add this function to your utils/index.js file

export const generateRandomPassword = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};