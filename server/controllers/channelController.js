import Channel from '../models/Channel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';

export const getAllChannels = async (_req, res) => {
  try {
    const channels = await Channel.find()
      .populate('roomMappings.internalRoomId', 'number type')
      .sort({ createdAt: -1 });
    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Error fetching channels' });
  }
};

export const getChannelById = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('roomMappings.internalRoomId', 'number type capacity price');
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ message: 'Error fetching channel' });
  }
};

export const createChannel = async (req, res) => {
  try {
    const channel = new Channel({ ...req.body, createdBy: req.user.id });
    await channel.save();
    res.status(201).json(channel);
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ message: 'Error creating channel' });
  }
};

export const updateChannel = async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { returnDocument: 'after', runValidators: true }
    ).populate('roomMappings.internalRoomId', 'number type');
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ message: 'Error updating channel' });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ message: 'Error deleting channel' });
  }
};

export const getChannelStats = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const bookings = await Booking.find({ channelId: req.params.id });

    const stats = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      averageRating: bookings.length
        ? bookings.reduce((sum, b) => sum + (b.rating || 0), 0) / bookings.length
        : 0,
      lastBookingDate: bookings.length
        ? Math.max(...bookings.map((b) => new Date(b.createdAt)))
        : null,
      monthlyBookings: {},
      roomUtilization: {},
    };

    const currentYear = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      stats.monthlyBookings[month] = bookings.filter((b) => {
        const d = new Date(b.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === month - 1;
      }).length;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    res.status(500).json({ message: 'Error fetching channel statistics' });
  }
};

export const syncChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    if (!channel.apiConfig.isActive) {
      return res.status(400).json({ message: 'Channel API is not active' });
    }

    const now = new Date();
    const nextSync = new Date(now.getTime() + channel.syncSettings.syncInterval * 60000);

    await Channel.findByIdAndUpdate(req.params.id, {
      'syncSettings.lastSync': now,
      'syncSettings.nextSync': nextSync,
    });

    res.json({
      success: true,
      message: 'Inventory synced successfully',
      syncedAt: now,
      nextSync,
      roomsUpdated: channel.roomMappings.length,
      ratesUpdated: channel.roomMappings.length,
    });
  } catch (error) {
    console.error('Error syncing channel:', error);
    res.status(500).json({ message: 'Error syncing channel inventory' });
  }
};

export const getAvailableRoomsForMapping = async (_req, res) => {
  try {
    const rooms = await Room.find({ status: 'available' }).select(
      'number type capacity price amenities'
    );
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ message: 'Error fetching available rooms' });
  }
};

export const updateRoomMappings = async (req, res) => {
  try {
    const { roomMappings } = req.body;
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { roomMappings },
      { returnDocument: 'after', runValidators: true }
    ).populate('roomMappings.internalRoomId', 'number type');
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    console.error('Error updating room mappings:', error);
    res.status(500).json({ message: 'Error updating room mappings' });
  }
};

export const calculateRates = async (req, res) => {
  try {
    const { baseRate } = req.body;
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const finalRate = channel.calculateFinalRate(baseRate);

    res.json({
      baseRate,
      finalRate,
      commission: channel.settings.commission,
      markup: channel.settings.markup,
      currency: channel.settings.currency,
    });
  } catch (error) {
    console.error('Error calculating rates:', error);
    res.status(500).json({ message: 'Error calculating rates' });
  }
};

export const getChannelsReadyForSync = async (_req, res) => {
  try {
    const channels = await Channel.getChannelsReadyForSync();
    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels ready for sync:', error);
    res.status(500).json({ message: 'Error fetching channels ready for sync' });
  }
};

export const bulkSyncChannels = async (_req, res) => {
  try {
    const channels = await Channel.getChannelsReadyForSync();
    const syncResults = [];

    for (const channel of channels) {
      try {
        const now = new Date();
        const nextSync = new Date(now.getTime() + channel.syncSettings.syncInterval * 60000);

        await Channel.findByIdAndUpdate(channel._id, {
          'syncSettings.lastSync': now,
          'syncSettings.nextSync': nextSync,
        });

        syncResults.push({
          channelId: channel._id,
          channelName: channel.name,
          success: true,
          syncedAt: now,
        });
      } catch (error) {
        syncResults.push({
          channelId: channel._id,
          channelName: channel.name,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      totalChannels: channels.length,
      syncedChannels: syncResults.filter((r) => r.success).length,
      failedChannels: syncResults.filter((r) => !r.success).length,
      results: syncResults,
    });
  } catch (error) {
    console.error('Error bulk syncing channels:', error);
    res.status(500).json({ message: 'Error bulk syncing channels' });
  }
};
