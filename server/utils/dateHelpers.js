/**
 * Date and time utility functions
 */

import dayjs from 'dayjs';

/**
 * Number of billable nights between check-in and check-out.
 *
 * Single source of truth for the stay/checkout calculation (previously
 * duplicated inline in bookingController). Floors the day difference (min 1) and
 * applies the late-checkout rule: leaving after 12:00 noon bills one extra night.
 *
 * @param {Date|string} checkIn
 * @param {Date|string} checkOut
 * @param {string} [checkOutTime='11:00']  "HH:mm" — used for the late-checkout rule.
 * @returns {number} Billable nights (>= 1).
 */
export const calculateNights = (checkIn, checkOut, checkOutTime = '11:00') => {
  const start = dayjs(checkIn);
  const end = dayjs(checkOut);
  if (!start.isValid() || !end.isValid()) return 1;

  let nights = Math.max(1, end.diff(start, 'day'));

  if (typeof checkOutTime === 'string' && checkOutTime.includes(':')) {
    const [hours, minutes] = checkOutTime.split(':').map(Number);
    if (!Number.isNaN(hours)) {
      const checkoutHour = hours + (Number.isNaN(minutes) ? 0 : minutes / 60);
      if (checkoutHour > 12.0) nights += 1;
    }
  }

  return nights;
};

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'iso')
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString();
    case 'long':
      return dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'iso':
      return dateObj.toISOString();
    default:
      return dateObj.toLocaleDateString();
  }
};

/**
 * Calculate age from birth date
 * @param {Date|string} birthDate - Birth date
 * @returns {number} - Age in years
 */
export const calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Check if date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
export const isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is in the future
 */
export const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Get date range for filtering
 * @param {string} period - Period type ('today', 'week', 'month', 'year')
 * @returns {object} - Start and end dates
 */
export const getDateRange = (period) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: startOfDay,
        end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    case 'week':
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      return {
        start: startOfWeek,
        end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
      };
    case 'month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start: startOfMonth,
        end: endOfMonth
      };
    case 'year':
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        start: startOfYear,
        end: endOfYear
      };
    default:
      return {
        start: startOfDay,
        end: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
  }
};