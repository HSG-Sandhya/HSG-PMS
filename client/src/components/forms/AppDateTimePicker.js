import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

// "yyyy-MM-ddTHH:mm" (the datetime-local format, or a Date / ISO) → a LOCAL
// Date. Parsing the parts manually avoids the UTC shift that
// `new Date('yyyy-MM-ddTHH:mm')` can introduce. Empty → null.
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(v));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Date → "yyyy-MM-ddTHH:mm" (local, minute precision). Invalid / null → ''.
const toLocal = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
};

/**
 * Themed date + time picker — a near drop-in for `<TextField type="datetime-local">`.
 *
 * Speaks "yyyy-MM-ddTHH:mm" strings on both ends so existing string-based form
 * state and the API contract keep working: `onChange(value: string)` fires with
 * '' when cleared. `min` / `max` accept the same string format. Everything else
 * (label, size, fullWidth, sx, slotProps…) forwards through. The popup styling
 * comes from the global MUI picker theme in AppThemeProvider, matching the
 * app's AppDatePicker / AppTimePicker.
 */
const AppDateTimePicker = ({
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
  <DateTimePicker
    label={label}
    value={toDate(value)}
    onChange={(d) => onChange?.(toLocal(d))}
    minDateTime={toDate(min) || undefined}
    maxDateTime={toDate(max) || undefined}
    disabled={disabled}
    format="dd MMM yyyy, hh:mm a"
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

export default AppDateTimePicker;
