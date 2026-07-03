/**
 * Common response formatting utilities
 */

/**
 * Standard success response format
 * @param {object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {object} - Formatted response
 */
export const successResponse = (data, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

/**
 * Standard error response format
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {object} error - Error details (optional)
 * @returns {object} - Formatted error response
 */
export const errorResponse = (message = 'Internal Server Error', statusCode = 500, error = null) => {
  const response = {
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString()
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.error = error;
  }

  return response;
};

/**
 * Pagination response format
 * @param {array} data - Response data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @param {string} message - Success message
 * @returns {object} - Formatted pagination response
 */
export const paginationResponse = (data, page, limit, total, message = 'Data fetched successfully') => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    message,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    timestamp: new Date().toISOString()
  };
};

/**
 * Handle async errors in Express routes
 * @param {function} fn - Async function to wrap
 * @returns {function} - Wrapped function with error handling
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};