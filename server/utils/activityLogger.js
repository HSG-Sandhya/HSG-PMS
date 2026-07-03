import ActivityLog from '../models/ActivityLog.js';

// Best-effort activity/audit recorder. It must NEVER throw or block the
// operation it is logging — failures are swallowed.
export const logActivity = async (req, entry = {}) => {
  try {
    const u = (req && req.user) || {};
    const name = entry.userName
      || u.username || u.email
      || [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
      || 'System';

    await ActivityLog.create({
      user: u._id || u.id || entry.user || null,
      userName: name,
      action: entry.action || 'unknown',
      category: entry.category || 'system',
      severity: entry.severity || 'info',
      description: entry.description || '',
      resource: entry.resource || '',
      resourceId: entry.resourceId ? String(entry.resourceId) : '',
      changes: entry.changes,
      audit: !!entry.audit,
      ip: (req && (req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress)) || '',
      userAgent: (req && req.headers?.['user-agent']) || '',
    });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('activity log failed:', e.message);
    }
  }
};

export default logActivity;
