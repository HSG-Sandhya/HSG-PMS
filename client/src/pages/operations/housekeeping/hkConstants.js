// Shared constants, palette, status metadata and small helpers for the
// Housekeeping Management dashboard. Presentational components in this folder
// consume these so colours and labels stay consistent across the page.

export const TASK_STATUS = ['Pending', 'In Progress', 'Completed'];
export const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Urgent'];
// Keep in sync with the taskType enum in server/models/Housekeeping.js.
export const TASK_TYPES = [
  'Regular Cleaning',
  'Deep Cleaning',
  'Checkout Cleaning',
  'Turndown Service',
  'Linen Change',
  'Restocking',
  'Laundry',
  'Inspection',
  'Sanitization',
  'Maintenance',
  'Other',
];

// Sophisticated hospitality palette (per the design brief).
export const HK = {
  primary: '#168FE5', // hotel blue
  success: '#10B981', // emerald
  warning: '#F59E0B', // amber
  danger: '#EF4444', // red
  slate: '#64748B', // neutral
  info: '#3B82F6',
  indigo: '#6366F1',
  purple: '#A855F7',
};

// Task status → colour used by chips, the table and charts.
export const STATUS_META = {
  Pending: { color: HK.warning },
  'In Progress': { color: HK.info },
  Completed: { color: HK.success },
  Cancelled: { color: HK.slate },
};

// Priority → colour.
export const PRIORITY_META = {
  Urgent: { color: HK.danger },
  High: { color: '#F97316' },
  Medium: { color: HK.warning },
  Low: { color: HK.success },
};

// Housekeeping display status for a room tile on the status board.
export const ROOM_STATUS_META = {
  clean: { label: 'Clean', color: HK.success },
  dirty: { label: 'Dirty', color: HK.danger },
  cleaning: { label: 'Cleaning', color: HK.info },
  inspection: { label: 'Inspection', color: HK.warning },
  occupied: { label: 'Occupied', color: HK.indigo },
  ooo: { label: 'Out of Order', color: HK.slate },
};

// Map a room + its active housekeeping task to a board display status.
// `activeTask` is the newest non-completed task targeting the room (or null).
export const deriveRoomStatus = (room, activeTask) => {
  if (activeTask) {
    if (activeTask.taskType === 'Inspection') return 'inspection';
    if (activeTask.status === 'In Progress') return 'cleaning';
    if (activeTask.status === 'Pending') {
      return activeTask.taskType === 'Maintenance' ? 'ooo' : 'dirty';
    }
  }
  switch (room?.status) {
    case 'maintenance': return 'ooo';
    case 'cleaning': return 'cleaning';
    case 'occupied': return 'occupied';
    case 'available':
    default: return 'clean';
  }
};

// Readable name from a populated staff/user document (or '' when unknown).
export const staffName = (m) => {
  if (!m || typeof m !== 'object') return '';
  if (m.firstName || m.lastName) return `${m.firstName || ''} ${m.lastName || ''}`.trim();
  return m.name || m.username || '';
};

// Two-letter initials for staff avatars.
export const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Current shift from the hour of day.
export const currentShift = (d = new Date()) => {
  const h = d.getHours();
  if (h >= 6 && h < 14) return 'Morning Shift';
  if (h >= 14 && h < 22) return 'Evening Shift';
  return 'Night Shift';
};

// Frosted "liquid glass" surface used by every dashboard panel: translucent
// fill + diagonal specular sheen + strong backdrop blur + a lit edge and inset
// top highlight. Driven by the app-wide glass tokens (AppThemeProvider); the
// per-mode literals are first-paint fallbacks used before those CSS vars exist.
export const glassCard = (isDark) => ({
  background: `var(--app-glass-sheen), var(--app-glass-fill-strong, ${isDark ? 'rgba(20,24,32,0.55)' : 'rgba(255,255,255,0.55)'})`,
  backdropFilter: 'var(--app-blur-strong)',
  WebkitBackdropFilter: 'var(--app-blur-strong)',
  border: `var(--app-glass-border, 1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)'})`,
  borderRadius: '16px',
  boxShadow: `var(--app-glass-shadow, ${isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 14px 44px -18px rgba(0,0,0,0.6)'
    : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 44px -18px rgba(15,23,42,0.28)'})`,
});

// Primary / secondary text colours tuned for the glass surfaces above.
export const textPrimary = (isDark) => (isDark ? '#f1f5f9' : '#1e293b');
export const textSecondary = (isDark) => (isDark ? 'rgba(226,232,240,0.65)' : 'rgba(51,65,85,0.7)');
