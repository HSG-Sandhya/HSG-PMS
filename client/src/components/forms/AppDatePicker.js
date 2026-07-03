import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// 'YYYY-MM-DD' (or Date / ISO) → a LOCAL Date at midnight. Empty → null.
// Parsing the parts manually avoids the UTC shift that `new Date('YYYY-MM-DD')`
// introduces (which can land the picker on the previous day in some zones).
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Date → 'YYYY-MM-DD' (local). Invalid / null → ''.
const toYmd = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

/**
 * Themed date picker — a near drop-in for `<TextField type="date">`.
 *
 * Speaks 'YYYY-MM-DD' strings on both ends, so existing string-based form state
 * keeps working: `onChange(value: string)` fires with '' when cleared. `min` /
 * `max` accept the same string format. Everything else (label, size, fullWidth,
 * sx, slotProps…) forwards through. The popup styling comes from the global
 * MUI picker theme in AppThemeProvider.
 */
const AppDatePicker = ({
  value,
  onChange,
  label,
  min,
  max,
  size = 'medium',
  fullWidth = true,
  disabled = false,
  sx,
  slotProps,
  ...rest
}) => (
  <DatePicker
    label={label}
    value={toDate(value)}
    onChange={(d) => onChange?.(toYmd(d))}
    minDate={toDate(min) || undefined}
    maxDate={toDate(max) || undefined}
    disabled={disabled}
    format="dd MMM yyyy"
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

export default AppDatePicker;
