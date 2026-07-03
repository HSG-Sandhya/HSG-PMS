import ActivityLog from '../models/ActivityLog.js';

const parseRange = (q = {}) => {
  const filter = {};
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) { const d = new Date(q.from); d.setHours(0, 0, 0, 0); filter.createdAt.$gte = d; }
    if (q.to) { const d = new Date(q.to); d.setHours(23, 59, 59, 999); filter.createdAt.$lte = d; }
  }
  return filter;
};

// GET /activity-logs  (?audit=true for the audit trail subset)
export const getLogs = async (req, res) => {
  try {
    const filter = parseRange(req.query);
    if (req.query.audit === 'true') filter.audit = true;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    if (req.query.severity && req.query.severity !== 'all') filter.severity = req.query.severity;
    if (req.query.search) {
      const rx = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ userName: rx }, { action: rx }, { description: rx }, { resource: rx }];
    }
    const limit = Math.min(Number(req.query.limit) || 300, 1000);

    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: logs, message: 'Logs fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching logs', error: error.message });
  }
};

// GET /activity-logs/stats
export const getStats = async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [total, today, auditCount, byCategory, bySeverity] = await Promise.all([
      ActivityLog.countDocuments({}),
      ActivityLog.countDocuments({ createdAt: { $gte: startOfDay } }),
      ActivityLog.countDocuments({ audit: true }),
      ActivityLog.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      ActivityLog.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    ]);
    res.json({
      success: true,
      data: {
        total, today, auditCount,
        byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
        bySeverity: bySeverity.map((s) => ({ severity: s._id, count: s.count })),
      },
      message: 'Stats fetched',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
};

// DELETE /activity-logs  (?before=ISO to prune older; otherwise clears all).
// System-admin only — destructive.
export const clearLogs = async (req, res) => {
  try {
    if (!req.user?.isSystemAdmin) {
      return res.status(403).json({ success: false, message: 'Only a system administrator can clear logs' });
    }
    const filter = {};
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    const result = await ActivityLog.deleteMany(filter);
    res.json({ success: true, data: { deleted: result.deletedCount }, message: 'Logs cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing logs', error: error.message });
  }
};
