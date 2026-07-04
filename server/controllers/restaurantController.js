import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import Receipt from '../models/Receipt.js';
import Booking from '../models/Booking.js';
import Image from '../models/Image.js';
import { syncRestaurantOrderIncome, syncTableSettlement, removeEntriesBySource } from '../services/accountingSync.js';
import { optimizeImage } from '../utils/imageOptimizer.js';
import fs from 'fs';
import { parse } from 'csv-parse';

const ORDER_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Ready for Pickup', 'Picked Up'];

const escapeRegex = (value) => value.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getFirstValue = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value.toString().trim() !== '') {
      return value;
    }
  }
  return undefined;
};
const parseCsvPrice = (value) => {
  if (value === undefined || value === null) return NaN;
  return Number(value.toString().replace(/[₹,\s]/g, ''));
};
const isPositivePrice = (value) => !Number.isNaN(parseCsvPrice(value)) && parseCsvPrice(value) > 0;

const populateOrder = (query) =>
  query
    .populate('tableId')
    .populate({ path: 'roomId', populate: { path: 'roomId', model: 'Room' } })
    .populate('servedBy', 'name');

const releaseTableIfIdle = async (tableId, excludeOrderId) => {
  const activeOrdersCount = await Order.countDocuments({
    tableId,
    _id: { $ne: excludeOrderId },
    status: { $in: ['Pending', 'In Progress'] },
  });
  if (activeOrdersCount === 0) {
    await Table.findByIdAndUpdate(tableId, { status: 'Available' });
  }
};

// ── Menu Items ────────────────────────────────────────────────────────────────

export const getMenuItems = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (categoryId !== undefined) {
      const items = await MenuItem.find({ category: categoryId }).sort({ name: 1 });
      return res.json(items);
    }
    const menuItems = await MenuItem.find()
      .populate('category', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: menuItems, message: 'Menu items fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching menu items', error: error.message });
  }
};

export const createMenuItemBasic = async (req, res) => {
  try {
    const menuItem = new MenuItem(req.body);
    await menuItem.save();
    res.status(201).json({ success: true, data: menuItem, message: 'Menu item created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating menu item', error: error.message });
  }
};

export const getReports = async (_req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    res.json({
      success: true,
      data: { totalOrders, totalRevenue: totalRevenue[0]?.total || 0, reportDate: new Date() },
      message: 'Restaurant report generated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating restaurant report', error: error.message });
  }
};

// ── Categories ────────────────────────────────────────────────────────────────

export const getCategories = async (_req, res) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const menuItemCount = await MenuItem.countDocuments({ category: req.params.id });
    if (menuItemCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category that is used by menu items' });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Menu (with images / detailed) ─────────────────────────────────────────────

export const getMenu = async (_req, res) => {
  try {
    const menuItems = await MenuItem.find()
      .populate('category')
      .sort({ 'category.displayOrder': 1, name: 1 });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveImageToDb = async (file, userId) => {
  const optimized = await optimizeImage(file.buffer, { contentType: file.mimetype });
  const image = new Image({
    data: optimized.buffer,
    contentType: optimized.contentType,
    filename: file.originalname,
    size: optimized.size,
    category: 'menu',
    uploadedBy: userId || null,
  });
  await image.save();
  return `/api/images/${image._id}`;
};

const extractImageId = (url) => {
  const match = typeof url === 'string' && url.match(/\/api\/images\/([0-9a-fA-F]{24})/);
  return match ? match[1] : null;
};

const buildMenuItemData = async (body, file, userId) => {
  const data = {
    ...body,
    price: Number(body.price),
    preparationTime: Number(body.preparationTime),
    isVeg: body.isVeg === 'true',
    popular: body.popular === 'true',
  };
  if (file) data.image = await saveImageToDb(file, userId);
  return data;
};

export const createMenuItem = async (req, res) => {
  try {
    const menuItemData = await buildMenuItemData(req.body, req.file, req.user?.id);
    const menuItem = new MenuItem(menuItemData);
    const savedMenuItem = await menuItem.save();
    const populatedItem = await MenuItem.findById(savedMenuItem._id).populate('category');
    res.status(201).json(populatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateMenuItem = async (req, res) => {
  try {
    let previousImageId = null;
    if (req.file) {
      const existing = await MenuItem.findById(req.params.id).select('image').lean();
      previousImageId = extractImageId(existing?.image);
    }

    const updateData = await buildMenuItemData(req.body, req.file, req.user?.id);
    const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('category');
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });

    if (previousImageId) {
      Image.findByIdAndDelete(previousImageId).catch(() => {});
    }

    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Toggle just the availability flag (used by the menu list "out of stock" switch).
export const setMenuItemAvailability = async (req, res) => {
  try {
    const isAvailable = req.body.isAvailable === true || req.body.isAvailable === 'true';
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { isAvailable },
      { returnDocument: 'after', runValidators: true }
    ).populate('category');
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Tables ────────────────────────────────────────────────────────────────────

export const getTables = async (_req, res) => {
  try {
    const tables = await Table.find().sort({ number: 1 });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTable = async (req, res) => {
  try {
    const table = new Table(req.body);
    const savedTable = await table.save();
    res.status(201).json(savedTable);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTable = async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!table) return res.status(404).json({ message: 'Table not found' });
    res.json(table);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Settle an occupied table: complete its active orders (each posts to accounting
// via the normal restaurant pipeline), record the remainder of the collected
// bill — the time-based table minimum above the food plus any packing charge —
// as restaurant revenue, and free the table. This is what makes a dine-in "table
// transaction" land in the books, even when the guest ordered nothing itemised.
export const settleTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { collectedTotal, paymentMethod = 'cash' } = req.body;

    const table = await Table.findById(id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    // 1) Complete this table's active orders → each posts its itemised value.
    const activeOrders = await Order.find({
      tableId: id,
      status: { $in: ['Pending', 'In Progress'] },
    });
    let ordersSum = 0;
    for (const order of activeOrders) {
      order.status = 'Completed';
      if (order.paymentMethod === 'none' && paymentMethod) order.paymentMethod = paymentMethod;
      await order.save();
      await syncRestaurantOrderIncome(order);
      ordersSum += Number(order.totalAmount) || 0;
    }

    // 2) Post the remainder of the collected bill (table minimum + packing) so
    // the ledger equals exactly what was collected. Never negative: the bill is
    // max(timeCharge, orders) + packing, so it always covers the itemised food.
    const collected = Math.round((Number(collectedTotal) || 0) * 100) / 100;
    const topUp = Math.round((collected - ordersSum) * 100) / 100;
    const settlementRef = `${id}-${Date.now()}`;
    if (topUp > 0) {
      await syncTableSettlement({
        tableId: id,
        settlementRef,
        amount: topUp,
        tableNumber: table.number,
        paymentMethod,
      });
    }

    // 3) Free the table.
    table.status = 'Available';
    table.occupiedAt = undefined;
    table.guests = 2;
    await table.save();

    res.json({
      success: true,
      message: 'Table settled successfully',
      data: {
        tableId: id,
        collected,
        ordersCompleted: activeOrders.length,
        ordersSum: Math.round(ordersSum * 100) / 100,
        tableCharge: topUp > 0 ? topUp : 0,
        table,
      },
    });
  } catch (error) {
    console.error('Error settling table:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTable = async (req, res) => {
  try {
    const orderCount = await Order.countDocuments({
      tableId: req.params.id,
      status: { $in: ['Pending', 'In Progress'] },
    });
    if (orderCount > 0) {
      return res.status(400).json({ message: 'Cannot delete table that has active orders' });
    }
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const getOrders = async (req, res) => {
  try {
    const { status, date, tableId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
    }
    if (tableId) query.tableId = tableId;

    const orders = await populateOrder(Order.find(query)).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Issue the dedicated payment receipt for a completed order — exactly once
// (the unique index on `order` makes double-issuing impossible even under
// races). Snapshots everything so the receipt survives later order edits.
// Never throws: a receipt failure must not break the order flow itself.
const issueReceiptForOrder = async (order, user) => {
  try {
    if (!order || order.status !== 'Completed') return null;

    const existing = await Receipt.findOne({ order: order._id });
    if (existing) return existing;

    const table = order.tableId; // populated doc or bare ObjectId
    const tableLabel =
      table && typeof table === 'object' && table.number ? `Table ${table.number}` : '';

    const receipt = new Receipt({
      order: order._id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      tableLabel,
      customerName: order.customerName || 'Walk-in Customer',
      customerPhone: order.customerPhone || 'N/A',
      items: (order.items || []).map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      // subtotal = base item prices; totalAmount = payable (incl. GST)
      subtotal: (order.items || []).reduce((sum, i) => sum + i.price * i.quantity, 0),
      gst: order.gst || 0,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod || 'cash',
      cashReceived: order.cashReceived || 0,
      changeAmount: order.changeAmount || 0,
      issuedBy: user?.id || null,
      issuedByName: user?.username || user?.name || '',
    });
    return await receipt.save();
  } catch (error) {
    // Duplicate-key race (two completions at once) → return the winner.
    if (error.code === 11000) return Receipt.findOne({ order: order._id });
    console.error('Receipt issue failed:', error.message);
    return null;
  }
};

export const createOrder = async (req, res) => {
  try {
    const { orderType, tableId, roomId } = req.body;

    // Validate the table / room link so every order is properly connected to a
    // real Table or a real room Booking before it is saved.
    if (orderType === 'table') {
      if (!tableId) {
        return res.status(400).json({ message: 'A table is required for a table order' });
      }
      const table = await Table.findById(tableId);
      if (!table) {
        return res.status(404).json({ message: 'Selected table not found' });
      }
    } else if (orderType === 'room') {
      if (!roomId) {
        return res.status(400).json({ message: 'A room booking is required for a room-service order' });
      }
      const booking = await Booking.findById(roomId);
      if (!booking) {
        return res.status(404).json({ message: 'Selected room booking not found' });
      }
    }

    const order = new Order(req.body);
    const savedOrder = await order.save();
    if (orderType === 'table' && tableId) {
      await Table.findByIdAndUpdate(tableId, { status: 'Occupied' });
    }
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('tableId')
      .populate({ path: 'roomId', populate: { path: 'roomId', model: 'Room' } });
    // POS orders arrive already Completed/paid — issue their receipt now and
    // return it with the order so the client prints the real receipt number.
    const receipt = await issueReceiptForOrder(populatedOrder, req.user);
    // Post the sale to the accounting ledger the moment it is completed/paid.
    await syncRestaurantOrderIncome(populatedOrder);
    res.status(201).json({ ...populatedOrder.toObject(), receipt });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateOrder = async (req, res) => {
  try {
    const order = await populateOrder(
      Order.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Completed' || order.status === 'Cancelled') {
      await releaseTableIfIdle(order.tableId, order._id);
    }
    if (order.status === 'Completed') {
      await issueReceiptForOrder(order, req.user);
    }
    // Reconcile the ledger: posts income on completion, removes it if the order
    // was reverted to pending or cancelled.
    await syncRestaurantOrderIncome(order);
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be deleted' });
    }
    await Order.findByIdAndDelete(req.params.id);
    await releaseTableIfIdle(order.tableId, order._id);
    // Only pending orders reach here (no ledger entry exists), but stay defensive.
    await removeEntriesBySource('restaurant_order', order._id);
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/restaurant/receipts — newest first, optional ?date=YYYY-MM-DD
export const getReceipts = async (req, res) => {
  try {
    const query = {};
    if (req.query.date) {
      const day = new Date(req.query.date);
      if (!isNaN(day)) {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        query.createdAt = { $gte: day, $lt: next };
      }
    }
    const receipts = await Receipt.find(query).sort({ createdAt: -1 }).limit(500);
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/restaurant/orders/:id/receipt — the receipt issued for an order
export const getReceiptByOrder = async (req, res) => {
  try {
    const receipt = await Receipt.findOne({ order: req.params.id });
    if (!receipt) return res.status(404).json({ message: 'No receipt issued for this order' });
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrdersByBooking = async (req, res) => {
  try {
    const orders = await Order.find({
      roomId: req.params.bookingId,
      orderType: 'room',
      status: { $ne: 'Cancelled' },
    })
      .populate('servedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await populateOrder(Order.findById(req.params.id));
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const order = await populateOrder(
      Order.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after', runValidators: true })
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (status === 'Completed' || status === 'Cancelled') {
      await releaseTableIfIdle(order.tableId, order._id);
    }
    if (status === 'Completed') {
      await issueReceiptForOrder(order, req.user);
    }
    // Reconcile the ledger: posts income on completion, removes it on revert/cancel.
    await syncRestaurantOrderIncome(order);
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const addItemToOrder = async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Item ID and quantity are required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending' && order.status !== 'In Progress') {
      return res.status(400).json({ message: 'Cannot add items to completed or cancelled orders' });
    }

    const menuItem = await MenuItem.findById(itemId);
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });

    const existingIndex = order.items.findIndex((it) => it.itemId.toString() === itemId);
    if (existingIndex >= 0) {
      order.items[existingIndex].quantity += quantity;
    } else {
      order.items.push({ itemId, name: menuItem.name, price: menuItem.price, quantity });
    }
    order.totalAmount = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('tableId')
      .populate('servedBy', 'name');
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const removeItemFromOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending' && order.status !== 'In Progress') {
      return res.status(400).json({ message: 'Cannot remove items from completed or cancelled orders' });
    }

    const itemIndex = order.items.findIndex((it) => it.itemId.toString() === req.params.itemId);
    if (itemIndex === -1) return res.status(404).json({ message: 'Item not found in order' });

    order.items.splice(itemIndex, 1);
    order.totalAmount = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('tableId')
      .populate('servedBy', 'name');
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await Order.find({
      createdAt: { $gte: today, $lt: tomorrow },
      status: { $ne: 'Cancelled' },
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const popularItems = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          name: { $first: '$items.name' },
          totalOrdered: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalOrdered: -1 } },
      { $limit: 5 },
    ]);

    const tableStats = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      {
        $group: { _id: '$tableId', orderCount: { $sum: 1 }, revenue: { $sum: '$totalAmount' } },
      },
      { $sort: { orderCount: -1 } },
    ]);
    const tableDetails = await Table.find({ _id: { $in: tableStats.map((s) => s._id) } });
    const tableUtilization = tableStats.map((stat) => {
      const tableInfo = tableDetails.find((t) => t._id.toString() === stat._id.toString());
      return {
        tableId: stat._id,
        tableNumber: tableInfo ? tableInfo.number : 'Unknown',
        orderCount: stat.orderCount,
        revenue: stat.revenue,
      };
    });

    res.json({ todayOrderCount: todayOrders.length, todayRevenue, popularItems, tableUtilization });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POS ───────────────────────────────────────────────────────────────────────

export const createPosOrder = async (req, res) => {
  try {
    const order = new Order({ ...req.body, orderType: 'pos' });
    const savedOrder = await order.save();
    const receipt = await issueReceiptForOrder(savedOrder, req.user);
    // POS orders are completed/paid on creation — post the sale to the ledger.
    await syncRestaurantOrderIncome(savedOrder);
    res.status(201).json({ ...savedOrder.toObject(), receipt });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getPosOrders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { orderType: 'pos' };
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPosSales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    const orders = await Order.find({
      orderType: 'pos',
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: 'Completed',
    });
    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const salesByPaymentMethod = {};
    orders.forEach((order) => {
      if (order.paymentMethod) {
        salesByPaymentMethod[order.paymentMethod] =
          (salesByPaymentMethod[order.paymentMethod] || 0) + order.totalAmount;
      }
    });
    res.json({ totalSales, salesByPaymentMethod, orderCount: orders.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CSV Import ────────────────────────────────────────────────────────────────

export const uploadMenuCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      imported: 0,
      errors: ['No file provided'],
    });
  }

  const filePath = req.file.path;
  const errors = [];
  let imported = 0;

  const cleanup = () => {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  };

  try {
    let fileContent = fs.readFileSync(filePath, 'utf8');
    if (fileContent.charCodeAt(0) === 0xfeff) fileContent = fileContent.slice(1);

    const results = [];

    await new Promise((resolve, reject) => {
      const stream = parse({
        columns: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      stream.on('readable', () => {
        let row;
        while ((row = stream.read())) results.push(row);
      });

      stream.on('error', reject);

      stream.on('end', async () => {
        try {
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowNumber = i + 2;

            try {
              const categoryValue = getFirstValue(row, ['category', 'Category', 'category_name']);
              const categoryNameFromCsv =
                categoryValue && !isPositivePrice(categoryValue)
                  ? categoryValue.toString().trim()
                  : '';
              const hindiName = getFirstValue(row, [
                'Hindi Name',
                'Item Hindi Name',
                'Item (Hindi Name)',
                'Item (Hindi Name) Price',
                'hindi_name',
              ]);

              const mappedRow = {
                name: getFirstValue(row, ['name', 'Item Name', 'item_name', 'itemName', 'Item']),
                price:
                  getFirstValue(row, [
                    'price',
                    'Price (INR)',
                    'price_inr',
                    'Price',
                    'price_inclusive_gst',
                    'Zomato/Swiggy Price',
                    'Zomato Price',
                    'Swiggy Price',
                    'Online Price',
                  ]) || (isPositivePrice(categoryValue) ? categoryValue : undefined),
                category:
                  categoryNameFromCsv ||
                  req.body.category ||
                  req.body.defaultCategory ||
                  'Imported Menu',
                description:
                  getFirstValue(row, ['description', 'Description', 'desc']) || hindiName,
                isVeg: getFirstValue(row, ['isVeg', 'Veg/Non-Veg', 'veg_non_veg', 'type']),
                preparationTime: getFirstValue(row, [
                  'preparationTime',
                  'Preparation Time (mins)',
                  'prep_time',
                  'preparation_time',
                ]),
                popular: getFirstValue(row, ['popular', 'Popular', 'is_popular']),
                isAvailable: getFirstValue(row, [
                  'isAvailable',
                  'Availability',
                  'available',
                  'is_available',
                ]),
                image: getFirstValue(row, ['image', 'Image', 'image_url']),
              };

              if (!mappedRow.name || !mappedRow.name.toString().trim()) {
                errors.push({ row: rowNumber, data: row, error: 'Name is required' });
                continue;
              }

              const parsedPrice = parseCsvPrice(mappedRow.price);
              if (!mappedRow.price || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
                errors.push({ row: rowNumber, data: row, error: 'Valid price is required' });
                continue;
              }

              if (!mappedRow.category || !mappedRow.category.toString().trim()) {
                errors.push({ row: rowNumber, data: row, error: 'Category is required' });
                continue;
              }

              const categoryName = mappedRow.category.toString().trim();
              let category = await Category.findOne({
                name: { $regex: new RegExp(`^${escapeRegex(categoryName)}$`, 'i') },
              });

              if (!category) {
                category = new Category({
                  name: categoryName,
                  description: 'Auto-created from CSV import',
                });
                await category.save();
              }

              const itemName = mappedRow.name.toString().trim();
              const existingItem = await MenuItem.findOne({
                name: { $regex: new RegExp(`^${escapeRegex(itemName)}$`, 'i') },
                category: category._id,
              });

              if (existingItem) {
                errors.push({ row: rowNumber, data: row, error: 'Menu item already exists' });
                continue;
              }

              const menuItemData = {
                name: itemName,
                description: mappedRow.description ? mappedRow.description.toString().trim() : '',
                price: parseFloat(parsedPrice.toFixed(2)),
                category: category._id,
                isVeg: ['true', '1', 'yes', 'y', 'veg', 'vegetarian'].includes(
                  (mappedRow.isVeg || 'true').toString().toLowerCase().trim()
                ),
                preparationTime:
                  mappedRow.preparationTime && !isNaN(Number(mappedRow.preparationTime))
                    ? Math.max(1, Number(mappedRow.preparationTime))
                    : 15,
                popular: ['true', '1', 'yes', 'y', 'popular'].includes(
                  (mappedRow.popular || 'false').toString().toLowerCase().trim()
                ),
                isAvailable:
                  mappedRow.isAvailable === undefined || mappedRow.isAvailable === ''
                    ? true
                    : ['true', '1', 'yes', 'y', 'available'].includes(
                        mappedRow.isAvailable.toString().toLowerCase().trim()
                      ),
                image: mappedRow.image ? mappedRow.image.toString().trim() : '',
              };

              await MenuItem.create(menuItemData);
              imported++;
            } catch (err) {
              errors.push({ row: rowNumber, data: row, error: err.message || 'Unknown error' });
            }
          }

          cleanup();

          const errorSummary = errors.reduce((summary, item) => {
            summary[item.error] = (summary[item.error] || 0) + 1;
            return summary;
          }, {});

          res.json({
            success: true,
            imported,
            errors,
            errorSummary,
            message: `Successfully imported ${imported} menu items${
              errors.length > 0 ? ` with ${errors.length} errors` : ''
            }`,
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      stream.write(fileContent);
      stream.end();
    });
  } catch (err) {
    cleanup();
    res.status(500).json({
      success: false,
      message: 'CSV parsing error',
      error: err.message,
      imported: 0,
      errors: [err.message],
    });
  }
};
