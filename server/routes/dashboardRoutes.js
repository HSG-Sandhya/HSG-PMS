import express from 'express';
import { authenticateToken as isAuthenticated } from '../middleware/auth.js';
import { cacheResponse } from '../middleware/cache.js';
import { getDashboard, getUserPermissions } from '../controllers/dashboardController.js';
import {
  getIndex,
  getRecentActivities,
  getOccupancyRate,
  getRevenueSummary,
  getMonthlyRevenue,
  getRoomTypeDistribution,
  getMonthlyReservations,
  getSummary,
  getBookingStats,
  getRevenueStats,
  getBanquetBookingsStats,
  getRestaurantSales,
  getRestaurantExpenses,
  getRestaurantStats,
  getTodayRevenue,
  getOccupancyHistory,
} from '../controllers/dashboardStatsController.js';

const router = express.Router();

router.use(isAuthenticated);

// These stat endpoints are read-only and hit hard on every dashboard load (and
// again every 30s on auto-refresh). A short TTL cache makes reloads instant and
// spares the DB a burst of identical aggregations. 15s is well under the 30s
// refresh interval, so periodic refreshes still pull fresh numbers.
const cache = cacheResponse(15_000);

router.get('/role-based', getDashboard);
router.get('/permissions', getUserPermissions);

router.get('/', cache, getIndex);
router.get('/recent-activities', cache, getRecentActivities);
router.get('/occupancy-rate', cache, getOccupancyRate);
router.get('/revenue-summary', cache, getRevenueSummary);
router.get('/monthly-revenue', cache, getMonthlyRevenue);
router.get('/room-types', cache, getRoomTypeDistribution);
router.get('/reservations/monthly', cache, getMonthlyReservations);
router.get('/summary', cache, getSummary);
router.get('/booking-stats', cache, getBookingStats);
router.get('/revenue-stats', cache, getRevenueStats);
router.get('/banquet-bookings', cache, getBanquetBookingsStats);
router.get('/restaurant/sales', cache, getRestaurantSales);
router.get('/restaurant/expenses', cache, getRestaurantExpenses);
router.get('/restaurant/stats', cache, getRestaurantStats);
router.get('/today-revenue', cache, getTodayRevenue);
router.get('/occupancy-history', cache, getOccupancyHistory);

export default router;
