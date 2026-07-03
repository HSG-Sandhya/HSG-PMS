// Shared static metadata + helpers for the Channel Manager page and its
// sub-components (cards, dialogs).
import { format, parseISO } from 'date-fns';
import { currencySym } from '../../../utils/billing';

export const CHANNEL_TYPES = [
  { value: 'ota', label: 'Online Travel Agency' },
  { value: 'direct', label: 'Direct Booking' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'travel_agent', label: 'Travel Agent' },
  { value: 'other', label: 'Other' },
];

export const CHANNEL_STATUSES = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'inactive', label: 'Inactive', color: 'default' },
  { value: 'suspended', label: 'Suspended', color: 'error' },
];

// Quick-start presets — selecting one prefills the form's name + type.
export const CHANNEL_PRESETS = [
  { name: 'Booking.com', type: 'ota', color: '#003580' },
  { name: 'MakeMyTrip', type: 'ota', color: '#EB2026' },
  { name: 'Goibibo', type: 'ota', color: '#2276E3' },
  { name: 'Agoda', type: 'ota', color: '#5C2D91' },
  { name: 'Expedia', type: 'ota', color: '#1B3C6E' },
  { name: 'Airbnb', type: 'ota', color: '#FF5A5F' },
  { name: 'Cleartrip', type: 'ota', color: '#F47A20' },
  { name: 'Website (Direct)', type: 'direct', color: '#10B981' },
  { name: 'Walk-in', type: 'direct', color: '#6366F1' },
  { name: 'Corporate Desk', type: 'corporate', color: '#0EA5E9' },
];

export const PALETTE = ['#003580', '#EB2026', '#2276E3', '#5C2D91', '#10B981', '#6366F1', '#0EA5E9', '#F47A20', '#FF5A5F', '#8B5CF6'];

export const GLASS = {
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
  boxShadow:
    '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

export const typeLabel = (type) => CHANNEL_TYPES.find((t) => t.value === type)?.label || type;
export const statusMeta = (status) => CHANNEL_STATUSES.find((s) => s.value === status) || CHANNEL_STATUSES[1];

export const channelColor = (channel) => {
  const preset = CHANNEL_PRESETS.find((p) => p.name.toLowerCase() === (channel.name || '').toLowerCase());
  if (preset) return preset.color;
  let hash = 0;
  for (let i = 0; i < (channel.name || '').length; i++) hash = channel.name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

export const channelInitials = (name = '') =>
  name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'CH';

export const formatDate = (value) => (value ? format(parseISO(value), 'dd MMM yyyy, HH:mm') : 'Never');
export const inr = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;

export const emptyForm = () => ({
  name: '',
  type: 'ota',
  status: 'active',
  settings: { commission: 15, markup: 0, currency: 'INR', timezone: 'Asia/Kolkata' },
  apiConfig: { endpoint: '', apiKey: '', secretKey: '', username: '', password: '', isActive: false },
  syncSettings: { autoSync: false, syncInterval: 30 },
  rateSettings: { baseRateMultiplier: 1.0, minRate: '', maxRate: '', dynamicPricing: false },
  bookingRules: { minAdvanceBooking: 0, maxAdvanceBooking: 365, allowSameDayBooking: true, allowOverbooking: false },
  contact: { name: '', email: '', phone: '', address: '' },
});
