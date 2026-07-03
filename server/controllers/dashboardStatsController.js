import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Guest from '../models/Guest.js';
import BanquetBooking from '../models/BanquetBooking.js';
import Order from '../models/Order.js';
import AccountingEntry from '../models/AccountingEntry.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfToday = (start = startOfToday()) =>
  new Date(start.getTime() + 24 * 60 * 60 * 1000);
const startOfMonth = (today = new Date()) =>
  new Date(today.getFullYear(), today.getMonth(), 1);
const startOfYear = (today = new Date()) => new Date(today.getFullYear(), 0, 1);

const yearRange = (year) => ({
  $gte: new Date(`${year}-01-01`),
  $lte: new Date(`${year}-12-31`),
});

const sumPaidAmount = async (model, match = {}) => {
  const [result] = await model.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: null, total: { $sum: '$paidAmount' } } },
  ]);
  return result?.total || 0;
};

const sumTotalAmount = async (model, match = {}) => {
  const [result] = await model.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return result?.total || 0;
};

const monthlyAggregate = async (model, dateField, valueField, year, op = '$sum') => {
  const data = await model.aggregate([
    { $match: { [dateField]: yearRange(year) } },
    {
      $group: {
        _id: { $month: `$${dateField}` },
        value: { [op]: `$${valueField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return MONTH_NAMES.map((name, i) => ({
    month: name,
    value: data.find((d) => d._id === i + 1)?.value || 0,
  }));
};

// 1. Root index
export const getIndex = async (_req, res) => {
  try {
    res.json({
      message: 'Dashboard API is working',
      endpoints: [
        '/role-based',
        '/permissions',
        '/summary',
        '/occupancy-rate',
        '/revenue-summary',
        '/monthly-revenue',
        '/room-types',
        '/reservations/monthly',
        '/booking-stats',
        '/revenue-stats',
        '/banquet-bookings',
        '/restaurant/sales',
        '/restaurant/expenses',
        '/restaurant/stats',
        '/today-revenue',
        '/occupancy-history',
        '/recent-activities',
      ],
    });
  } catch (error) {
    console.error('Error in dashboard root route:', error);
    res.status(500).json({ message: 'Dashboard API error' });
  }
};

// 2. Recent activities
export const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const half = Math.ceil(limit / 2);

    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(half)
      .select('guestName bookingStatus createdAt totalAmount');

    const recentBanquet = await BanquetBooking.find()
      .sort({ createdAt: -1 })
      .limit(half)
      .select('customerName eventType createdAt totalAmount status');

    const activities = [
      ...recentBookings.map((b) => ({
        id: b._id,
        type: 'room_booking',
        description: `Room booking created for ${b.guestName}`,
        amount: b.totalAmount,
        status: b.bookingStatus,
        timestamp: b.createdAt,
      })),
      ...recentBanquet.map((b) => ({
        id: b._id,
        type: 'banquet_booking',
        description: `${b.eventType} event booking for ${b.customerName}`,
        amount: b.totalAmount,
        status: b.status,
        timestamp: b.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    res.json({
      success: true,
      data: activities,
      message: 'Recent activities retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities',
      error: error.message,
    });
  }
};

// 3. Occupancy rate
export const getOccupancyRate = async (_req, res) => {
  try {
    const totalRooms = await Room.countDocuments();
    const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    res.json({
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      rate: Math.round(occupancyRate),
    });
  } catch (error) {
    console.error('Error calculating occupancy rate:', error);
    res.status(500).json({ message: 'Error calculating occupancy rate' });
  }
};

// 4. Revenue summary
export const getRevenueSummary = async (_req, res) => {
  try {
    const today = startOfToday();
    const monthStart = startOfMonth();
    const yearStart = startOfYear();

    const [todayRev, monthRev, yearRev, pending] = await Promise.all([
      sumPaidAmount(Booking, { createdAt: { $gte: today, $lt: endOfToday(today) } }),
      sumPaidAmount(Booking, { createdAt: { $gte: monthStart } }),
      sumPaidAmount(Booking, { createdAt: { $gte: yearStart } }),
      Booking.aggregate([
        { $match: { paymentStatus: { $in: ['Pending', 'Partial'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } } } },
      ]).then((r) => r[0]?.total || 0),
    ]);

    res.json({ today: todayRev, month: monthRev, year: yearRev, pending });
  } catch (error) {
    console.error('Error fetching revenue summary:', error);
    res.status(500).json({ message: 'Error fetching revenue summary' });
  }
};

// 5. Monthly revenue chart
export const getMonthlyRevenue = async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const [roomData, banquetData, restData] = await Promise.all([
      monthlyAggregate(Booking, 'createdAt', 'paidAmount', year),
      monthlyAggregate(BanquetBooking, 'eventDate', 'totalAmount', year),
      // Room-service orders are already inside room paidAmount (folded at checkout),
      // so exclude them here to keep the monthly revenue total counted once.
      Order.aggregate([
        { $match: { status: 'Completed', orderType: { $ne: 'room' }, createdAt: yearRange(year) } },
        { $group: { _id: { $month: '$createdAt' }, value: { $sum: '$totalAmount' } } },
        { $sort: { _id: 1 } },
      ]).then((data) =>
        MONTH_NAMES.map((name, i) => ({
          month: name,
          value: data.find((d) => d._id === i + 1)?.value || 0,
        }))
      ),
    ]);

    const formatted = MONTH_NAMES.map((name, i) => ({
      name,
      revenue: roomData[i].value + banquetData[i].value + restData[i].value,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    res.status(500).json({ message: 'Error fetching monthly revenue' });
  }
};

// 6. Room type distribution
export const getRoomTypeDistribution = async (_req, res) => {
  try {
    const roomTypes = await Room.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { _id: 0, name: '$_id', value: '$count' } },
    ]);
    res.json(roomTypes);
  } catch (error) {
    console.error('Error fetching room type distribution:', error);
    res.status(500).json({ message: 'Error fetching room type distribution' });
  }
};

// 7. Monthly reservations
export const getMonthlyReservations = async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const data = await Booking.aggregate([
      { $match: { createdAt: yearRange(year) } },
      { $group: { _id: { $month: '$createdAt' }, bookings: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const formatted = MONTH_NAMES.map((month, i) => ({
      month,
      bookings: data.find((d) => d._id === i + 1)?.bookings || 0,
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching monthly reservations:', error);
    res.status(500).json({ message: 'Error fetching monthly reservations' });
  }
};

// 8. Summary (all stats)
export const getSummary = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);

    const rooms = await Room.find();
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
    const availableRooms = totalRooms - occupiedRooms;

    const bookings = await Booking.find();
    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter((b) => b.bookingStatus === 'Pending').length;
    const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'Confirmed').length;
    const completedBookings = bookings.filter((b) => b.bookingStatus === 'Completed').length;

    const totalGuests = await Guest.countDocuments();
    const totalRoomRevenue = bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const pendingPayments = bookings.reduce((sum, b) => {
      if (b.bookingStatus !== 'Cancelled') {
        return sum + ((b.totalAmount || 0) - (b.paidAmount || 0));
      }
      return sum;
    }, 0);

    const [banquetRev, banquetPending, restaurantRev, roomServiceFood, todayCheckIns, todayCheckOuts, todayBookings] =
      await Promise.all([
        sumTotalAmount(BanquetBooking),
        BanquetBooking.aggregate([
          { $match: { status: { $in: ['Pending', 'Confirmed'] } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $subtract: ['$totalAmount', '$advanceAmount'] } },
            },
          },
        ]).then((r) => r[0]?.total || 0),
        // All completed orders (table + POS + room-service) count as F&B revenue.
        sumTotalAmount(Order, { status: 'Completed' }),
        // Room-service food is folded into booking.paidAmount at checkout; subtract
        // it from room revenue so it is counted once, under Restaurant (F&B).
        sumTotalAmount(Order, { status: 'Completed', orderType: 'room' }),
        Booking.countDocuments({ checkIn: { $gte: today, $lt: tomorrow } }),
        Booking.countDocuments({ checkOut: { $gte: today, $lt: tomorrow } }),
        Booking.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      ]);

    const netRoomRevenue = Math.max(0, totalRoomRevenue - roomServiceFood);

    res.json({
      totalRooms,
      occupiedRooms,
      availableRooms,
      occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      totalGuests,
      totalRevenue: netRoomRevenue + banquetRev + restaurantRev,
      pendingPayments: pendingPayments + banquetPending,
      todayCheckIns,
      todayCheckOuts,
      todayBookings,
      revenueBreakdown: {
        roomBookings: netRoomRevenue,
        banquet: banquetRev,
        restaurant: restaurantRev,
      },
      pendingBreakdown: {
        roomBookings: pendingPayments,
        banquet: banquetPending,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Error fetching dashboard summary' });
  }
};

// 9. Booking stats
export const getBookingStats = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);
    const monthStart = startOfMonth();
    const yearStart = startOfYear();

    const [
      totalBookings,
      todayBookings,
      monthlyBookings,
      yearlyBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      todayCheckIns,
      todayCheckOuts,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Booking.countDocuments({ createdAt: { $gte: monthStart } }),
      Booking.countDocuments({ createdAt: { $gte: yearStart } }),
      Booking.countDocuments({ bookingStatus: 'Pending' }),
      Booking.countDocuments({ bookingStatus: 'Confirmed' }),
      Booking.countDocuments({ bookingStatus: 'Completed' }),
      Booking.countDocuments({ bookingStatus: 'Cancelled' }),
      Booking.countDocuments({ checkIn: { $gte: today, $lt: tomorrow } }),
      Booking.countDocuments({ checkOut: { $gte: today, $lt: tomorrow } }),
    ]);

    res.json({
      total: totalBookings,
      today: todayBookings,
      month: monthlyBookings,
      year: yearlyBookings,
      byStatus: {
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      todayCheckIns,
      todayCheckOuts,
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({ message: 'Error fetching booking stats' });
  }
};

// 10. Revenue stats
export const getRevenueStats = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);
    const monthStart = startOfMonth();
    const yearStart = startOfYear();

    const [total, todayRev, monthRev, yearRev, pending, avgBooking] = await Promise.all([
      sumPaidAmount(Booking),
      sumPaidAmount(Booking, { createdAt: { $gte: today, $lt: tomorrow } }),
      sumPaidAmount(Booking, { createdAt: { $gte: monthStart } }),
      sumPaidAmount(Booking, { createdAt: { $gte: yearStart } }),
      Booking.aggregate([
        { $match: { paymentStatus: { $in: ['Pending', 'Partial'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } } } },
      ]).then((r) => r[0]?.total || 0),
      Booking.aggregate([
        { $group: { _id: null, average: { $avg: '$totalAmount' } } },
      ]).then((r) => r[0]?.average || 0),
    ]);

    res.json({
      total,
      today: todayRev,
      month: monthRev,
      year: yearRev,
      pending,
      averageBookingValue: avgBooking,
    });
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({ message: 'Error fetching revenue stats' });
  }
};

// 11. Banquet bookings
export const getBanquetBookingsStats = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);
    const monthStart = startOfMonth();
    const yearStart = startOfYear();

    const [
      total,
      todayCount,
      monthlyCount,
      yearlyCount,
      pending,
      confirmed,
      completed,
      cancelled,
      totalRev,
      todayRev,
      monthRev,
      eventTypeStats,
    ] = await Promise.all([
      BanquetBooking.countDocuments(),
      BanquetBooking.countDocuments({ eventDate: { $gte: today, $lt: tomorrow } }),
      BanquetBooking.countDocuments({ eventDate: { $gte: monthStart } }),
      BanquetBooking.countDocuments({ eventDate: { $gte: yearStart } }),
      BanquetBooking.countDocuments({ status: 'Pending' }),
      BanquetBooking.countDocuments({ status: 'Confirmed' }),
      BanquetBooking.countDocuments({ status: 'Completed' }),
      BanquetBooking.countDocuments({ status: 'Cancelled' }),
      sumTotalAmount(BanquetBooking),
      sumTotalAmount(BanquetBooking, { eventDate: { $gte: today, $lt: tomorrow } }),
      sumTotalAmount(BanquetBooking, { eventDate: { $gte: monthStart } }),
      BanquetBooking.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
    ]);

    res.json({
      total,
      today: todayCount,
      month: monthlyCount,
      year: yearlyCount,
      byStatus: { pending, confirmed, completed, cancelled },
      revenue: { total: totalRev, today: todayRev, month: monthRev },
      eventTypes: eventTypeStats,
    });
  } catch (error) {
    console.error('Error fetching banquet bookings data:', error);
    res.status(500).json({ message: 'Error fetching banquet bookings data' });
  }
};

// 12. Restaurant sales
export const getRestaurantSales = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);
    const monthStart = startOfMonth();
    const yearStart = startOfYear();
    const year = new Date().getFullYear();

    const [total, todaySales, monthlySales, yearlySales, salesByType, monthlyChart] =
      await Promise.all([
        sumTotalAmount(Order, { status: 'Completed' }),
        sumTotalAmount(Order, { status: 'Completed', createdAt: { $gte: today, $lt: tomorrow } }),
        sumTotalAmount(Order, { status: 'Completed', createdAt: { $gte: monthStart } }),
        sumTotalAmount(Order, { status: 'Completed', createdAt: { $gte: yearStart } }),
        Order.aggregate([
          { $match: { status: 'Completed' } },
          { $group: { _id: '$orderType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
        ]),
        Order.aggregate([
          { $match: { status: 'Completed', createdAt: yearRange(year) } },
          { $group: { _id: { $month: '$createdAt' }, sales: { $sum: '$totalAmount' } } },
          { $sort: { _id: 1 } },
        ]).then((data) =>
          MONTH_NAMES.map((month, i) => ({
            month,
            sales: data.find((d) => d._id === i + 1)?.sales || 0,
          }))
        ),
      ]);

    res.json({
      total,
      today: todaySales,
      month: monthlySales,
      year: yearlySales,
      byType: salesByType,
      monthlyChart,
    });
  } catch (error) {
    console.error('Error fetching restaurant sales data:', error);
    res.status(500).json({ message: 'Error fetching restaurant sales data' });
  }
};

// 13. Restaurant expenses (placeholder)
export const getRestaurantExpenses = async (_req, res) => {
  try {
    res.json({
      total: 150000,
      today: 5000,
      month: 45000,
      year: 180000,
      categories: [
        { name: 'Ingredients', amount: 60000 },
        { name: 'Staff', amount: 45000 },
        { name: 'Utilities', amount: 25000 },
        { name: 'Equipment', amount: 20000 },
      ],
      monthlyChart: [
        { month: 'Jan', expenses: 15000 },
        { month: 'Feb', expenses: 14000 },
        { month: 'Mar', expenses: 16000 },
        { month: 'Apr', expenses: 15500 },
        { month: 'May', expenses: 17000 },
        { month: 'Jun', expenses: 16500 },
        { month: 'Jul', expenses: 18000 },
        { month: 'Aug', expenses: 17500 },
        { month: 'Sep', expenses: 19000 },
        { month: 'Oct', expenses: 18500 },
        { month: 'Nov', expenses: 20000 },
        { month: 'Dec', expenses: 19500 },
      ],
    });
  } catch (error) {
    console.error('Error fetching restaurant expenses data:', error);
    res.status(500).json({ message: 'Error fetching restaurant expenses data' });
  }
};

// 14. Restaurant stats
export const getRestaurantStats = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);
    const monthStart = startOfMonth();

    const [total, todayCount, monthlyCount, pending, inProgress, completed, cancelled, avgValue, byType] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Order.countDocuments({ createdAt: { $gte: monthStart } }),
        Order.countDocuments({ status: 'Pending' }),
        Order.countDocuments({ status: 'In Progress' }),
        Order.countDocuments({ status: 'Completed' }),
        Order.countDocuments({ status: 'Cancelled' }),
        Order.aggregate([
          { $group: { _id: null, average: { $avg: '$totalAmount' } } },
        ]).then((r) => r[0]?.average || 0),
        Order.aggregate([{ $group: { _id: '$orderType', count: { $sum: 1 } } }]),
      ]);

    res.json({
      totalOrders: total,
      todayOrders: todayCount,
      monthlyOrders: monthlyCount,
      byStatus: { pending, inProgress, completed, cancelled },
      averageOrderValue: avgValue,
      byType,
    });
  } catch (error) {
    console.error('Error fetching restaurant stats:', error);
    res.status(500).json({ message: 'Error fetching restaurant stats' });
  }
};

// 15. Today revenue — money actually received today.
// Revenue is recognised on the day the cash lands, not the day the booking was
// created. The AccountingEntry ledger already dates every receipt that way (a
// checkout or a banquet advance is posted on its settlement day, and every
// completed restaurant table/room/POS order posts on completion — see
// services/accountingSync.js), so all revenue is summed straight from the one
// ledger. This keeps the dashboard in step with the finance reports and fixes
// the cases where a stay booked earlier but paid/checked-out today, an advance
// for a future event, or a restaurant sale was invisible to the dashboard.
export const getTodayRevenue = async (_req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = endOfToday(today);

    const ledger = await AccountingEntry.aggregate([
      { $match: { entryType: 'income', date: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: '$category', total: { $sum: '$total' } } },
    ]);

    const byCategory = Object.fromEntries(ledger.map((r) => [r._id, r.total]));
    const bookingRev = byCategory['Room Revenue'] || 0;
    const banquetRev = byCategory['Banquet Revenue'] || 0;
    const restaurantRev = byCategory['Restaurant Revenue'] || 0;
    const ledgerTotal = ledger.reduce((sum, r) => sum + (r.total || 0), 0);

    res.json({
      total: ledgerTotal,
      bookings: bookingRev,
      banquet: banquetRev,
      restaurant: restaurantRev,
      // any manual income posted today outside the three operational streams
      other: ledgerTotal - bookingRev - banquetRev - restaurantRev,
    });
  } catch (error) {
    console.error("Error fetching today's revenue:", error);
    res.status(500).json({ message: "Error fetching today's revenue" });
  }
};

// 16. Occupancy history
export const getOccupancyHistory = async (_req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const monthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const targetMonth = currentMonth - i;
      const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
      const totalRooms = await Room.countDocuments();
      const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      monthlyData.push({
        name: MONTH_NAMES[actualMonth],
        rate: occupancyRate,
        totalRooms,
        occupiedRooms,
      });
    }

    res.json(monthlyData);
  } catch (error) {
    console.error('Error fetching occupancy history:', error);
    res.status(500).json({ message: 'Error fetching occupancy history' });
  }
};
