// Shared palette, status metadata, glass styling and formatters for the Banquet
// & Event Management dashboard. Presentational components in this folder consume
// these so the luxury blue + gold theme stays consistent.
import { currencySym } from '../../../utils/billing';

// Premium hospitality palette (blue + wedding gold accent).
export const BQ = {
  primary: '#1598E5', // luxury blue
  gold: '#D4AF37', // wedding / event premium accent
  success: '#10B981', // emerald
  warning: '#F59E0B', // amber
  danger: '#EF4444', // red
  slate: '#64748B', // neutral
  indigo: '#6366F1',
  purple: '#A855F7',
  blue: '#3B82F6',
};

// Event type → accent colour (weddings gold, corporate blue, parties purple…).
export const EVENT_TYPE_META = {
  Wedding: { color: BQ.gold },
  Reception: { color: '#C99A2E' },
  Engagement: { color: '#EC4899' },
  Anniversary: { color: BQ.gold },
  Birthday: { color: BQ.purple },
  Party: { color: BQ.purple },
  Corporate: { color: BQ.blue },
  Conference: { color: BQ.blue },
  Meeting: { color: BQ.slate },
  Other: { color: BQ.slate },
};

export const eventColor = (type) => (EVENT_TYPE_META[type] || EVENT_TYPE_META.Other).color;

// Booking lifecycle status → colour.
export const STATUS_META = {
  Pending: { color: BQ.warning },
  Confirmed: { color: BQ.success },
  Completed: { color: BQ.blue },
  Cancelled: { color: BQ.danger },
};

// Payment status → colour.
export const PAYMENT_META = {
  Pending: { color: BQ.danger },
  Partial: { color: BQ.warning },
  Paid: { color: BQ.success },
};

// Frosted "liquid glass" surface: translucent fill + diagonal specular sheen +
// strong backdrop blur + a lit edge and inset top highlight. Driven by the
// app-wide glass tokens (set in AppThemeProvider); the per-mode literals are
// first-paint fallbacks used before those CSS vars exist.
export const glassCard = (isDark) => ({
  background: `var(--app-glass-sheen), var(--app-glass-fill-strong, ${isDark ? 'rgba(20,24,32,0.55)' : 'rgba(255,255,255,0.55)'})`,
  backdropFilter: 'var(--app-blur-strong)',
  WebkitBackdropFilter: 'var(--app-blur-strong)',
  border: `var(--app-glass-border, 1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)'})`,
  borderRadius: '18px',
  boxShadow: `var(--app-glass-shadow, ${isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 14px 44px -18px rgba(0,0,0,0.6)'
    : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 44px -18px rgba(15,23,42,0.28)'})`,
});

export const textPrimary = (isDark) => (isDark ? '#f1f5f9' : '#1e293b');
export const textSecondary = (isDark) => (isDark ? 'rgba(226,232,240,0.65)' : 'rgba(51,65,85,0.7)');

// Full currency, e.g. ₹1,50,000.
export const money = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;

// Compact Indian currency, e.g. ₹25.5L / ₹1.2Cr / ₹4.8L.
export const moneyShort = (n) => {
  const v = Number(n) || 0;
  const s = currencySym();
  const trim = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  if (v >= 1e7) return `${s}${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${s}${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${s}${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${s}${v.toLocaleString('en-IN')}`;
};

// Resolve a booking's hall name whether hallId is populated or an id.
export const hallLabel = (booking, halls = []) => {
  const h = booking?.hallId;
  if (h && typeof h === 'object' && h.name) return h.name;
  const found = halls.find((x) => String(x._id) === String(h));
  return found ? found.name : '—';
};

// Combine a booking's eventDate + startTime into a Date (start of day if no time).
export const eventStart = (booking) => {
  if (!booking?.eventDate) return null;
  const d = new Date(booking.eventDate);
  if (booking.startTime && /^\d{1,2}:\d{2}/.test(booking.startTime)) {
    const [h, m] = booking.startTime.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
  }
  return d;
};

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const isSameDay = (a, b) => Boolean(a) && Boolean(b) && startOfDay(a).getTime() === startOfDay(b).getTime();

// A booking counts as active (not cancelled) for occupancy / timeline purposes.
export const isActiveBooking = (b) => b.status !== 'Cancelled';
