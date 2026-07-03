import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireManage } from '../middleware/requireManage.js';
import {
  exportBookings,
  exportRestaurantSales,
  exportTransactions,
  exportHousekeeping,
} from '../controllers/exportController.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @openapi
 * /api/exports/bookings:
 *   get:
 *     tags: [Exports]
 *     summary: Download bookings as an Excel (.xlsx) file
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Optional check-in range start (ISO date).
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Optional check-in range end (ISO date).
 *     responses:
 *       200:
 *         description: XLSX spreadsheet of bookings.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}
 */
router.get('/bookings', exportBookings);

/**
 * @openapi
 * /api/exports/restaurant-sales:
 *   get:
 *     tags: [Exports]
 *     summary: Download restaurant orders & sales as an Excel (.xlsx) file
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: XLSX spreadsheet of restaurant sales.
 */
router.get('/restaurant-sales', exportRestaurantSales);

/**
 * @openapi
 * /api/exports/transactions:
 *   get:
 *     tags: [Exports]
 *     summary: Download accounting transactions & account balances (.xlsx)
 *     description: Requires the `manage_accounting` permission.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: XLSX spreadsheet of transactions and balances.
 *       403:
 *         description: Missing manage_accounting permission.
 */
router.get('/transactions', requireManage('manage_accounting'), exportTransactions);

/**
 * @openapi
 * /api/exports/housekeeping:
 *   get:
 *     tags: [Exports]
 *     summary: Download the housekeeping task log as an Excel (.xlsx) file
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: XLSX spreadsheet of housekeeping tasks.
 */
router.get('/housekeeping', exportHousekeeping);

export default router;
