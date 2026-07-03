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

import { requireManage } from '../middleware/requireManage.js';
const router = express.Router();

router.use(authenticateToken);

// Malformed :id -> 400 instead of a Mongoose CastError 500.
router.param('id', objectIdParam('ID'));
router.param('bookingId', objectIdParam('booking ID'));

// Menu items (basic listing + create)
router.get('/menu-items', getMenuItems);
router.post('/menu-items', requireManage('manage_restaurant'), createMenuItemBasic);

// Reports
router.get('/reports', getReports);

// Categories
router.get('/categories', getCategories);
router.post('/categories', requireManage('manage_restaurant'), createCategory);
router.put('/categories/:id', requireManage('manage_restaurant'), updateCategory);
router.delete('/categories/:id', requireManage('manage_restaurant'), deleteCategory);

// Menu (full, with images)
router.get('/menu', getMenu);
router.post('/menu', requireManage('manage_restaurant'), imageUpload.single('image'), createMenuItem);
router.put('/menu/:id', requireManage('manage_restaurant'), imageUpload.single('image'), updateMenuItem);
router.patch('/menu/:id/availability', requireManage('manage_restaurant'), setMenuItemAvailability);
router.delete('/menu/:id', requireManage('manage_restaurant'), deleteMenuItem);
router.post('/menu/upload-csv', requireManage('manage_restaurant'), upload.single('file'), uploadMenuCsv);

// Tables
router.get('/tables', getTables);
router.post('/tables', requireManage('manage_restaurant'), createTable);
router.put('/tables/:id', requireManage('manage_restaurant'), updateTable);
router.post('/tables/:id/settle', requireManage('manage_restaurant'), settleTable);
router.delete('/tables/:id', requireManage('manage_restaurant'), deleteTable);

// Receipts — immutable payment records, issued automatically on completion
router.get('/receipts', getReceipts);
router.get('/orders/:id/receipt', getReceiptByOrder);

// Orders
router.get('/orders', getOrders);
router.post('/orders', requireManage('manage_restaurant'), createOrder);
router.get('/orders/booking/:bookingId', getOrdersByBooking);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id', requireManage('manage_restaurant'), updateOrder);
router.delete('/orders/:id', requireManage('manage_restaurant'), deleteOrder);
router.patch('/orders/:id/status', requireManage('manage_restaurant'), updateOrderStatus);
router.post('/orders/:id/items', requireManage('manage_restaurant'), addItemToOrder);
router.delete('/orders/:id/items/:itemId', requireManage('manage_restaurant'), removeItemFromOrder);

// POS
router.post('/pos-orders', requireManage('manage_restaurant'), createPosOrder);
router.get('/pos-orders', getPosOrders);
router.get('/pos-sales', getPosSales);

// Stats
router.get('/stats', getStats);

export default router;
