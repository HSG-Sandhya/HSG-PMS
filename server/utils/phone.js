// Canonical phone key used to de-duplicate guests. The same person often gets
// entered with and without a country code (e.g. "9872383268" vs "+91 9872383268"),
// which would otherwise create two directory records. We collapse a number to its
// 10-digit national form so every variant maps to the same key.
export function normalizePhone(raw) {
  if (raw == null) return '';
  let digits = String(raw).replace(/\D/g, ''); // drop +, spaces, dashes, parens
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2); // +91XXXXXXXXXX
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // trunk 0
  if (digits.length > 10) digits = digits.slice(-10); // any other country code → last 10
  return digits;
}
