import BanquetBooking from '../models/BanquetBooking.js';
import Housekeeping from '../models/Housekeeping.js';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { syncBanquetPayments, removeEntriesBySource } from '../services/accountingSync.js';

const EVENT_TYPE_PREFIXES = {
  birthday: 'BIRTH',
  wedding: 'MARR',
  engagement: 'ENG',
  reception: 'RECP',
  corporate: 'CORP',
};

const buildCustomerId = async (bookingData) => {
  let prefix = 'EVT';
  if (bookingData.eventType) {
    const key = bookingData.eventType.toLowerCase();
    prefix = EVENT_TYPE_PREFIXES[key] || bookingData.eventType.toUpperCase().slice(0, 4);
  }

  const datePart = bookingData.eventDate
    ? new Date(bookingData.eventDate).toISOString().replace(/[-:T.]/g, '').slice(0, 8)
    : Date.now();

  const lastBooking = await BanquetBooking.findOne({
    eventType: bookingData.eventType,
    eventDate: bookingData.eventDate,
  }).sort({ createdAt: -1 });

  let seq = 1001;
  if (lastBooking?.customerId) {
    const lastSeq = parseInt(lastBooking.customerId.slice(-4));
    seq = isNaN(lastSeq) ? 1001 : lastSeq + 1;
  }

  return `${prefix}${datePart}${seq}`;
};

export const getAllBookings = async (_req, res) => {
  try {
    const bookings = await BanquetBooking.find().sort({ eventDate: 1 });
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching marriage bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await BanquetBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createBooking = async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      menu: req.body.menu || { mealType: 'standard', side: {}, extra: {} },
      menuCost: req.body.menuCost || 0,
    };

    if (!['Birthday', 'Corporate'].includes(bookingData.eventType)) {
      bookingData.daysWithMeals =
        typeof req.body.daysWithMeals === 'number'
          ? req.body.daysWithMeals
          : parseInt(req.body.daysWithMeals, 10) || 0;
    }

    const start = new Date(bookingData.eventDate);
    const end = bookingData.endDate ? new Date(bookingData.endDate) : start;

    const conflict = await BanquetBooking.findOne({
      $or: [
        {
          eventDate: { $lte: end },
          endDate: { $gte: start },
          status: { $nin: ['Cancelled'] },
        },
        {
          eventDate: { $lte: end },
          endDate: { $exists: false },
          status: { $nin: ['Cancelled'] },
        },
      ],
    });

    if (conflict) {
      return res.status(400).json({ message: 'This date or range is already booked', conflict });
    }

    bookingData.customerId = await buildCustomerId(bookingData);

    const newBooking = new BanquetBooking(bookingData);
    const savedBooking = await newBooking.save();
    await syncBanquetPayments(savedBooking); // mirror any advance payments into accounting
    res.status(201).json(savedBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBooking = async (req, res) => {
  try {
    if (req.body.eventDate) {
      const start = new Date(req.body.eventDate);
      const end = req.body.endDate ? new Date(req.body.endDate) : start;

      const currentBooking = await BanquetBooking.findById(req.params.id);
      if (!currentBooking) return res.status(404).json({ message: 'Booking not found' });

      const currentStart = new Date(currentBooking.eventDate);
      const currentEnd = currentBooking.endDate ? new Date(currentBooking.endDate) : currentStart;
      const dateChanged =
        start.getTime() !== currentStart.getTime() || end.getTime() !== currentEnd.getTime();

      if (dateChanged) {
        const conflict = await BanquetBooking.findOne({
          _id: { $ne: req.params.id },
          status: { $nin: ['Cancelled'] },
          $or: [
            {
              endDate: { $exists: true },
              eventDate: { $lte: end },
              endDate: { $gte: start },
            },
            {
              endDate: { $exists: false },
              eventDate: { $gte: start, $lte: end },
            },
          ],
        });

        if (conflict) {
          return res.status(400).json({ message: 'This date or range is already booked', conflict });
        }
      }
    }

    // Load the full doc so we can save() it (findByIdAndUpdate would skip the
    // pre-save hook that re-derives advanceAmount / remainingAmount /
    // paymentStatus, leaving an edited booking's payment status stale).
    const updatedBooking = await BanquetBooking.findById(req.params.id);
    if (!updatedBooking) return res.status(404).json({ message: 'Booking not found' });
    const prevBooking = { status: updatedBooking.status, hallId: updatedBooking.hallId };

    const updateData = {
      ...req.body,
      menu: req.body.menu || { mealType: 'standard', side: {}, extra: {} },
      menuCost: req.body.menuCost || 0,
      updatedAt: Date.now(),
    };

    if (!['Birthday', 'Corporate'].includes(updateData.eventType)) {
      updateData.daysWithMeals =
        typeof req.body.daysWithMeals === 'number'
          ? req.body.daysWithMeals
          : parseInt(req.body.daysWithMeals, 10) || 0;
    }

    Object.assign(updatedBooking, updateData);
    await updatedBooking.save();

    await syncBanquetPayments(updatedBooking); // reconcile the payments ledger into accounting

    // When the event is completed, queue a cleaning task for the hall
    const becameCompleted = updatedBooking.status === 'Completed' && prevBooking.status !== 'Completed';
    const hallId = updatedBooking.hallId || prevBooking.hallId;
    if (becameCompleted && hallId) {
      try {
        await Housekeeping.ensureCleaningTask({
          hallId,
          source: 'banquet_checkout',
          notes: 'Banquet hall requires cleaning after the event.',
        });
      } catch (taskError) {
        console.error('Error creating banquet hall housekeeping task:', taskError);
      }
    }

    res.json(updatedBooking);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const deletedBooking = await BanquetBooking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) return res.status(404).json({ message: 'Booking not found' });
    await removeEntriesBySource('banquet_booking', req.params.id); // drop linked income entries
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAvailableDates = async (req, res) => {
  try {
    const { month, year } = req.params;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid month or year' });
    }

    const startDate = startOfMonth(new Date(yearNum, monthNum - 1));
    const endDate = endOfMonth(new Date(yearNum, monthNum - 1));

    const bookings = await BanquetBooking.find({
      eventDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ['Cancelled'] },
    });

    const bookedDates = new Set(
      bookings.map((b) => format(new Date(b.eventDate), 'yyyy-MM-dd'))
    );

    const allDates = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
      allDates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const availableDates = allDates.filter((d) => !bookedDates.has(d));
    res.json(availableDates);
  } catch (error) {
    console.error('Error fetching available dates:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
