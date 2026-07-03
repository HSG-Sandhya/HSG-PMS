// Shared constants, formatters and styling for the Accounting module.
// Currency symbol comes from the live billing settings (utils/billing), so the
// whole module follows the configured currency without hardcoding the glyph.
import { currencySym } from '../../utils/billing';

export const fmt = (n) =>
  `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtShort = (n) =>
  `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

// yyyy-MM-dd for <input type="date">
export const toInputDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const INCOME_CATEGORIES = [
  'Room Revenue', 'Restaurant Sales', 'Banquet & Events', 'Bar Sales', 'Laundry', 'Other Income',
];

export const EXPENSE_CATEGORIES = [
  'Salaries & Wages', 'Staff Payments', 'Staff Phone Recharge', 'Electricity', 'Water',
  'Provisions & Groceries', 'Maintenance & Repairs', 'Housekeeping Supplies', 'Marketing',
  'Rent', 'Taxes & Licenses', 'Bank Charges', 'Miscellaneous',
];

export const ACCOUNTS = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other'];
export const GST_RATES = [0, 5, 12, 18, 28];

export const cardSx = {
  p: { xs: 2, md: 2.5 },
  borderRadius: 3,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)',
  WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

export const INCOME_COLOR = '#10B981';
export const EXPENSE_COLOR = '#EF4444';
