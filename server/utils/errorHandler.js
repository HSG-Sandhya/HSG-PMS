/**
 * Centralized error handling utilities
 */

import { HTTP_STATUS } from './constants.js';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a validation error
 */
export const createValidationError = (message, field = null) => {
  const error = new AppError(message, HTTP_STATUS.BAD_REQUEST);
  if (field) {
    error.field = field;
  }
  return error;
};

/**
 * Create a not found error
 */
export const createNotFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
};

/**
 * Create an unauthorized error
 */
export const createUnauthorizedError = (message = 'Unauthorized access') => {
  return new AppError(message, HTTP_STATUS.UNAUTHORIZED);
};

/**
 * Create a forbidden error
 */
export const createForbiddenError = (message = 'Access forbidden') => {
  return new AppError(message, HTTP_STATUS.FORBIDDEN);
};

/**
 * Create a conflict error
 */
export const createConflictError = (message = 'Resource already exists') => {
  return new AppError(message, HTTP_STATUS.CONFLICT);
};

/**
 * Handle MongoDB errors
 */
export const handleMongoError = (error) => {
  if (error.code === 11000) {
    // Duplicate key error
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return createConflictError(`${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`);
  }
  
  if (error.name === 'ValidationError') {
    // Mongoose validation error
    const messages = Object.values(error.errors).map(err => err.message);
    return createValidationError(messages.join('. '));
  }
  
  if (error.name === 'CastError') {
    // Invalid ObjectId
    return createValidationError(`Invalid ${error.path}: ${error.value}`);
  }
  
  return new AppError('Database error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR);
};

/**
 * Handle JWT errors
 */
export const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return createUnauthorizedError('Invalid token');
  }
  
  if (error.name === 'TokenExpiredError') {
    return createUnauthorizedError('Token expired');
  }
  
  return createUnauthorizedError('Authentication failed');
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (error, req, res, next) => {
  let appError = error;
  
  // Convert known errors to AppError
  if (error.name === 'MongoError' || error.name === 'ValidationError' || error.name === 'CastError') {
    appError = handleMongoError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    appError = handleJWTError(error);
  } else if (!(error instanceof AppError)) {
    appError = new AppError(
      error.message || 'Something went wrong',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
  
  // Log error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: appError.message,
      statusCode: appError.statusCode,
      stack: appError.stack,
      timestamp: appError.timestamp
    });
  }
  
  // Send error response
  const response = {
    success: false,
    message: appError.message,
    statusCode: appError.statusCode,
    timestamp: appError.timestamp
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = appError.stack;
  }
  
  res.status(appError.statusCode).json(response);
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req, res, next) => {
  const error = createNotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};