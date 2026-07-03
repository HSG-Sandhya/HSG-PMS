import logger from '../config/logger.js';
import { MAX_UPLOAD_SIZE } from './uploadMemory.js';

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  logger.error(`Error ${err.message}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: err.stack
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMb = Math.round(MAX_UPLOAD_SIZE / (1024 * 1024));
    const message = `File too large — maximum upload size is ${maxMb} MB`;
    error = { message, statusCode: 413 };
  }

  // CORS errors
  if (err.message && err.message.includes('CORS policy')) {
    error = { message: 'CORS policy violation', statusCode: 403 };
  }

  // Rate limiting errors
  if (err.message && err.message.includes('Too many requests')) {
    error = { message: 'Rate limit exceeded', statusCode: 429 };
  }

  // Use err.status, err.statusCode, or default to 500
  const statusCode = err.status || err.statusCode || error.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler for unmatched routes
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export default { errorHandler, asyncHandler, notFound };
