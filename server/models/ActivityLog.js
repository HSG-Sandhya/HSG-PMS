import mongoose from 'mongoose';

// A single audit / activity record. General user actions land here; the
// security-sensitive ones (role & permission changes, user management, logins)
// are flagged `audit: true` so they also surface in the Audit Trail view.
const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, default: 'System', trim: true },

  // Machine action key, e.g. 'login', 'role.update', 'user.deactivate'.
  action: { type: String, required: true, trim: true },

  category: {
    type: String,
    enum: ['auth', 'role', 'user', 'data', 'security', 'system'],
    default: 'system',
    index: true,
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },

  description: { type: String, default: '', trim: true },
  resource: { type: String, default: '', trim: true },   // 'Role', 'User', …
  resourceId: { type: String, default: '', trim: true },

  // { before, after } snapshot for audit diffs (optional).
  changes: { type: mongoose.Schema.Types.Mixed, default: undefined },

  audit: { type: Boolean, default: false, index: true },

  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
