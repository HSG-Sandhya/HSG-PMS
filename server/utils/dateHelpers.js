/**
 * Date and time utility functions
 */

import dayjs from 'dayjs';

/**
 * Number of billable nights between check-in and check-out.
 *
 * Single source of truth for the stay/checkout calculation (previously
 * duplicated inline in bookingController). Floors the day difference, min 1.
 *
 * This used to add a night when checkout fell after 12:00 noon. Late checkout is
 * now a charge the front desk enters by hand at checkout, not an extra night
 * conjured by the clock — so nights track the dates and nothing else. Callers may
 * still pass a third argument; it is ignored.
 *
 * @param {Date|string} checkIn
 * @param {Date|string} checkOut
 * @returns {number} Billable nights (>= 1).
 */
export const calculateNights = (checkIn, checkOut) => {
  const start = dayjs(checkIn);
  const end = dayjs(checkOut);
  if (!start.isValid() || !end.isValid()) return 1;
  // Calendar days, not elapsed 24h periods: a 6:44 PM arrival on the 1st leaving
  // on the 7th is 6 nights, but the raw difference is 5 days 5 hours, which
  // truncated to 5 and quietly billed a night short.
  return Math.max(1, end.startOf('day').diff(start.startOf('day'), 'day'));
};

/**
 * Parse a user-picked calendar day ('YYYY-MM-DD') into a Date.
 *
 * Anchored at 12:00 UTC rather than midnight: `new Date('2026-08-06')` is UTC
 * midnight, which renders as the 5th anywhere west of Greenwich and would shift
 * a backdated entry into the previous day (and, on the 1st, the previous month).
 * Noon keeps the calendar day intact from UTC-11 through UTC+12. Values that
 * already carry a time pass through as-is; blank/invalid input returns undefined
 * so the caller can fall back to the schema default.
 *
 * @param {string|Date} value
 * @returns {Date|undefined}
 */
export const parseDateOnly = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
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