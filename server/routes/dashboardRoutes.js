import express from 'express';
import { authenticateToken as isAuthenticated } from '../middleware/auth.js';
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

router.get('/role-based', getDashboard);
router.get('/permissions', getUserPermissions);

router.get('/', getIndex);
router.get('/recent-activities', getRecentActivities);
router.get('/occupancy-rate', getOccupancyRate);
router.get('/revenue-summary', getRevenueSummary);
router.get('/monthly-revenue', getMonthlyRevenue);
router.get('/room-types', getRoomTypeDistribution);
router.get('/reservations/monthly', getMonthlyReservations);
router.get('/summary', getSummary);
router.get('/booking-stats', getBookingStats);
router.get('/revenue-stats', getRevenueStats);
router.get('/banquet-bookings', getBanquetBookingsStats);
router.get('/restaurant/sales', getRestaurantSales);
router.get('/restaurant/expenses', getRestaurantExpenses);
router.get('/restaurant/stats', getRestaurantStats);
router.get('/today-revenue', getTodayRevenue);
router.get('/occupancy-history', getOccupancyHistory);

export default router;
