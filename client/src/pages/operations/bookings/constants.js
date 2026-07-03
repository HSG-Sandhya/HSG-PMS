// Shared constants for the Bookings page and its header controls.

// Easing curve used across the page's framer-motion transitions.
export const EASE_OUT = [0.22, 1, 0.36, 1];

// Guest list status filter. 'In Hotel' = checked-in guests still staying
// (bookingStatus 'Confirmed'); 'Completed' = checked-out / stay over.
export const STATUS_OPTIONS = [
  { value: 'all',        label: 'All statuses', hint: 'In-hotel & checked out',   dot: '#94A3B8' },
  { value: 'In Hotel',   label: 'In Hotel',     hint: 'Checked in, still staying', dot: '#10B981' },
  { value: 'Completed',  label: 'Completed',    hint: 'Stay over, checked out',    dot: 'var(--app-primary)' },
];

// Payment status filter for the guest list.
export const PAYMENT_OPTIONS = [
  { value: 'all',     label: 'All payments', hint: 'Any payment state', dot: '#94A3B8' },
  { value: 'Paid',    label: 'Paid',         hint: 'Folio settled',     dot: '#10B981' },
  { value: 'Partial', label: 'Partial',      hint: 'Balance still due',  dot: '#F59E0B' },
  { value: 'Pending', label: 'Pending',      hint: 'Nothing collected',  dot: '#EF4444' },
];
