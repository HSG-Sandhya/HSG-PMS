import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import upload from '../middleware/upload.js';
import imageUpload from '../middleware/uploadMemory.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getMenuItems,
  createMenuItemBasic,
  getReports,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenu,
  createMenuItem,
  updateMenuItem,
  setMenuItemAvailability,
  deleteMenuItem,
  getTables,
  createTable,
  updateTable,
  settleTable,
  deleteTable,
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrdersByBooking,
  getOrderById,
  getReceipts,
  getReceiptByOrder,
  updateOrderStatus,
  addItemToOrder,
  removeItemFromOrder,
  getStats,
  createPosOrder,
  getPosOrders,
  getPosSales,
  uploadMenuCsv,
} from '../controllers/restaurantController.js';

import { requireManage, requirePermission } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));
router.param('bookingId', objectIdParam('booking ID'));

// Menu items (basic listing + create)
router.get('/menu-items', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getMenuItems);
router.post('/menu-items', requireManage('manage_restaurant'), createMenuItemBasic);

// Reports
router.get('/reports', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getReports);

// Categories
router.get('/categories', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getCategories);
router.post('/categories', requireManage('manage_restaurant'), createCategory);
router.put('/categories/:id', requireManage('manage_restaurant'), updateCategory);
router.delete('/categories/:id', requireManage('manage_restaurant'), deleteCategory);

// Menu (full, with images)
router.get('/menu', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getMenu);
router.post('/menu', requireManage('manage_restaurant'), imageUpload.single('image'), createMenuItem);
router.put('/menu/:id', requireManage('manage_restaurant'), imageUpload.single('image'), updateMenuItem);
router.patch('/menu/:id/availability', requireManage('manage_restaurant'), setMenuItemAvailability);
router.delete('/menu/:id', requireManage('manage_restaurant'), deleteMenuItem);
router.post('/menu/upload-csv', requireManage('manage_restaurant'), upload.single('file'), uploadMenuCsv);

// Tables
router.get('/tables', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getTables);
router.post('/tables', requireManage('manage_restaurant'), createTable);
router.put('/tables/:id', requireManage('manage_restaurant'), updateTable);
router.post('/tables/:id/settle', requireManage('manage_restaurant'), settleTable);
router.delete('/tables/:id', requireManage('manage_restaurant'), deleteTable);

// Receipts — immutable payment records, issued automatically on completion
router.get('/receipts', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getReceipts);
router.get('/orders/:id/receipt', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getReceiptByOrder);

// Orders
router.get('/orders', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getOrders);
router.post('/orders', requireManage('manage_restaurant'), createOrder);
router.get('/orders/booking/:bookingId', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getOrdersByBooking);
router.get('/orders/:id', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getOrderById);
router.put('/orders/:id', requireManage('manage_restaurant'), updateOrder);
router.delete('/orders/:id', requireManage('manage_restaurant'), deleteOrder);
router.patch('/orders/:id/status', requireManage('manage_restaurant'), updateOrderStatus);
router.post('/orders/:id/items', requireManage('manage_restaurant'), addItemToOrder);
router.delete('/orders/:id/items/:itemId', requireManage('manage_restaurant'), removeItemFromOrder);

// POS
router.post('/pos-orders', requireManage('manage_restaurant'), createPosOrder);
router.get('/pos-orders', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getPosOrders);
router.get('/pos-sales', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getPosSales);

// Stats
router.get('/stats', requirePermission(['view_restaurant_orders', 'manage_restaurant', 'manage_pos']), getStats);

export default router;
