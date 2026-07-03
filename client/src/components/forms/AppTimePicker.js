import { TimePicker } from '@mui/x-date-pickers/TimePicker';

// 'HH:mm' (or Date) → a Date (today) at that time. Empty → null.
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
  if (m) {
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Date → 'HH:mm' (24-hour, for form/back-end compatibility). Invalid / null → ''.
const toHm = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Themed time picker — a near drop-in for `<TextField type="time">`.
 *
 * Speaks 'HH:mm' (24-hour) strings on both ends so existing form state and the
 * API contract are unchanged, while the UI shows a friendly localized clock.
 * `onChange(value: string)` fires with '' when cleared. Popup styling comes from
 * the global MUI picker theme in AppThemeProvider.
 */
const AppTimePicker = ({
  value,
  onChange,
  label,
  size = 'medium',
  fullWidth = true,
  disabled = false,
  sx,
  slotProps,
  ...rest
}) => (
  <TimePicker
    label={label}
    value={toDate(value)}
    onChange={(d) => onChange?.(toHm(d))}
    disabled={disabled}
    slotProps={{
      ...slotProps,
      textField: {
        size,
        fullWidth,
        sx,
        ...(slotProps?.textField || {}),
      },
    }}
    {...rest}
  />
);

export default AppTimePicker;
