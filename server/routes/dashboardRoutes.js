import { requirePermission } from '../middleware/requireManage.js';
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

router.get('/', requirePermission(['view_dashboard']), cache, getIndex);
router.get('/recent-activities', requirePermission(['view_dashboard']), cache, getRecentActivities);
router.get('/occupancy-rate', requirePermission(['view_dashboard']), cache, getOccupancyRate);
router.get('/revenue-summary', requirePermission(['view_dashboard']), cache, getRevenueSummary);
router.get('/monthly-revenue', requirePermission(['view_dashboard']), cache, getMonthlyRevenue);
router.get('/room-types', requirePermission(['view_dashboard']), cache, getRoomTypeDistribution);
router.get('/reservations/monthly', requirePermission(['view_dashboard']), cache, getMonthlyReservations);
router.get('/summary', requirePermission(['view_dashboard']), cache, getSummary);
router.get('/booking-stats', requirePermission(['view_dashboard']), cache, getBookingStats);
router.get('/revenue-stats', requirePermission(['view_dashboard']), cache, getRevenueStats);
router.get('/banquet-bookings', requirePermission(['view_dashboard']), cache, getBanquetBookingsStats);
router.get('/restaurant/sales', requirePermission(['view_dashboard']), cache, getRestaurantSales);
router.get('/restaurant/expenses', requirePermission(['view_dashboard']), cache, getRestaurantExpenses);
router.get('/restaurant/stats', requirePermission(['view_dashboard']), cache, getRestaurantStats);
router.get('/today-revenue', requirePermission(['view_dashboard']), cache, getTodayRevenue);
router.get('/occupancy-history', requirePermission(['view_dashboard']), cache, getOccupancyHistory);

export default router;
