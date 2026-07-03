export const getConfigurations = async (_req, res) => {
  try {
    const configurations = [
      { id: '1', name: 'Booking.com', type: 'OTA', status: 'active', lastSync: new Date(), commission: 15 },
      { id: '2', name: 'Expedia', type: 'OTA', status: 'active', lastSync: new Date(), commission: 18 },
    ];
    res.json({ success: true, data: configurations, message: 'Channel configurations fetched successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching channel configurations', error: error.message });
  }
};

export const createConfiguration = async (req, res) => {
  try {
    const configuration = { id: Date.now().toString(), ...req.body, createdAt: new Date() };
    res.status(201).json({ success: true, data: configuration, message: 'Channel configuration created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating channel configuration', error: error.message });
  }
};

export const syncChannels = async (_req, res) => {
  try {
    const syncResult = {
      success: true,
      syncedChannels: ['Booking.com', 'Expedia'],
      syncTime: new Date(),
      roomsUpdated: 25,
      ratesUpdated: 50,
    };
    res.json({ success: true, data: syncResult, message: 'Channel sync completed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error syncing channels', error: error.message });
  }
};

export const getReports = async (_req, res) => {
  try {
    const reports = {
      totalBookings: 150,
      totalRevenue: 45000,
      channelBreakdown: [
        { channel: 'Booking.com', bookings: 85, revenue: 25500 },
        { channel: 'Expedia', bookings: 65, revenue: 19500 },
      ],
      reportDate: new Date(),
    };
    res.json({ success: true, data: reports, message: 'Channel reports generated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating channel reports', error: error.message });
  }
};
