// Pure formatters that enforce the character layout of each ID-proof type as
// the user types. Each takes the raw input string and returns the formatted
// value to store in `idCardNumber`. Kept side-effect free so they're easy to
// reason about and test (the booking form's handlers are thin wrappers).

// Aadhaar: 12 digits, grouped 4-4-4 with a space after every 4 digits
// (official layout, e.g. "1234 5678 9012").
export const formatAadhaar = (raw) => {
  const value = String(raw).replace(/[^0-9]/g, '').slice(0, 12);
  if (value.length > 8) {
    return `${value.slice(0, 4)} ${value.slice(4, 8)} ${value.slice(8)}`;
  }
  if (value.length > 4) {
    return `${value.slice(0, 4)} ${value.slice(4)}`;
  }
  return value;
};

// Every layout below is expressed as an ordered list of slots: either a run of
// characters of one class (`re` + `len`), or a literal separator (`lit`) that
// the formatter inserts itself. `applyLayout` walks the raw input one character
// at a time and decides which slot a character belongs to from HOW MUCH HAS
// BEEN ACCEPTED so far — never from the character's index in the raw string.
// (Indexing the raw string desynchronises the moment a character is skipped or
// a separator is auto-inserted, which is what made the driving-licence field
// stop accepting input once its space had been added.)
const applyLayout = (raw, slots) => {
  const value = String(raw ?? '').toUpperCase();
  let out = '';
  let slot = 0;      // slot the next character goes into
  let filled = 0;    // characters already accepted into that slot

  for (const char of value) {
    // Skip past full slots, collecting the separators we would have to write
    // before this character. They are only committed if the character is kept,
    // so a rejected keystroke never leaves a stray separator behind.
    let next = slot;
    let taken = filled;
    let pending = '';
    while (next < slots.length && (slots[next].lit !== undefined || taken >= slots[next].len)) {
      if (slots[next].lit !== undefined) { pending += slots[next].lit; }
      next += 1;
      taken = 0;
    }
    if (next >= slots.length) { break; }   // layout is full — ignore the rest

    if (slots[next].re.test(char)) {
      out += pending + char;
      slot = next;
      filled = taken + 1;
    } else if (pending.includes(char)) {
      // The user typed the separator themselves — honour it, don't drop it.
      out += pending;
      slot = next;
      filled = taken;
    }
  }
  return out;
};

// Passport: 2 alphabets + 7 digits + optional 1-2 alphabets (max 11 chars).
export const formatPassport = (raw) => applyLayout(raw, [
  { re: /[A-Z]/, len: 2 },
  { re: /[0-9]/, len: 7 },
  { re: /[A-Z]/, len: 2 },
]);

// Driving licence: 2 alphabets (state) + 2 digits (RTO) + space + up to 11
// digits (4-digit year + 7-digit serial), e.g. "UK07 20230001234" — 16 chars.
export const formatDrivingLicense = (raw) => applyLayout(raw, [
  { re: /[A-Z]/, len: 2 },
  { re: /[0-9]/, len: 2 },
  { lit: ' ' },
  { re: /[0-9]/, len: 11 },
]);

// Voter ID: 3 alphabets + 7 digits.
export const formatVoterId = (raw) => applyLayout(raw, [
  { re: /[A-Z]/, len: 3 },
  { re: /[0-9]/, len: 7 },
]);

// PAN: 5 alphabets + 4 digits + 1 alphabet.
export const formatPanCard = (raw) => applyLayout(raw, [
  { re: /[A-Z]/, len: 5 },
  { re: /[0-9]/, len: 4 },
  { re: /[A-Z]/, len: 1 },
]);

// Dispatch to the right formatter for an identity-type value. Accepts both the
// Guest model's enum (Aadhar/Passport/DrivingLicense/VoterID) and the booking
// form's human labels (Aadhaar Card / Driving License / Voter ID).
export const formatIdentityByType = (type, raw) => {
  switch (type) {
    case 'Aadhar':
    case 'Aadhaar':
    case 'Aadhaar Card':
      return formatAadhaar(raw);
    case 'Passport':
      return formatPassport(raw);
    case 'DrivingLicense':
    case 'Driving License':
      return formatDrivingLicense(raw);
    case 'VoterID':
    case 'Voter ID':
      return formatVoterId(raw);
    case 'PAN':
    case 'PAN Card':
      return formatPanCard(raw);
    default:
      return String(raw ?? '');
  }
};

// A short "what this ID looks like" hint for the field's helper text.
export const identityHint = (type) => ({
  Aadhar: '12 digits · 1234 5678 9012',
  Passport: '2 letters + 7 digits · e.g. AB1234567',
  DrivingLicense: '2 letters + 2 digits + number · e.g. BR14 20230001234',
  VoterID: '3 letters + 7 digits · e.g. ABC1234567',
}[type] || '');

// An example of the number's layout, shown as grey placeholder text inside the
// input so the expected format is visible before the user types.
export const identityPlaceholder = (type) => ({
  Aadhar: '1234 5678 9012',
  Passport: 'AB1234567',
  DrivingLicense: 'BR14 20230001234',
  VoterID: 'ABC1234567',
}[type] || '');

// ── Validation ───────────────────────────────────────────────────────────────

// Verhoeff checksum tables (Aadhaar's official check-digit scheme).
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// True when `value` is a valid 12-digit Aadhaar (length + Verhoeff check digit).
export const isValidAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^[0-9]{12}$/.test(digits)) return false;
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][parseInt(reversed[i], 10)]];
  }
  return c === 0;
};

// Per-type validation. Returns '' when valid (or empty), else an error message.
// Empty is treated as "no error" here — enforce required-ness at the call site.
export const identityError = (type, value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  switch (type) {
    case 'Aadhar':
    case 'Aadhaar':
    case 'Aadhaar Card':
      return isValidAadhaar(v) ? '' : 'Enter a valid 12-digit Aadhaar number';
    case 'Passport':
      return /^[A-Z]{2}[0-9]{7}[A-Z]{0,2}$/.test(v) ? '' : 'Passport must be 2 letters + 7 digits';
    case 'DrivingLicense':
    case 'Driving License':
      return /^[A-Z]{2}[0-9]{2}\s?[0-9]{7,11}$/.test(v) ? '' : 'Enter a valid driving licence (e.g. BR14 20230001234)';
    case 'VoterID':
    case 'Voter ID':
      return /^[A-Z]{3}[0-9]{7}$/.test(v) ? '' : 'Voter ID must be 3 letters + 7 digits';
    default:
      return '';
  }
};

// Shortest value that could possibly be valid for each type, counting the
// separators the formatters insert. Used only to hold the error back while the
// number is still being typed.
const MIN_IDENTITY_LENGTH = {
  Aadhar: 14,           // 12 digits + 2 spaces
  Aadhaar: 14,
  'Aadhaar Card': 14,
  Passport: 9,          // 2 letters + 7 digits
  DrivingLicense: 12,   // 2 letters + 2 digits + space + 7 digits
  'Driving License': 12,
  VoterID: 10,          // 3 letters + 7 digits
  'Voter ID': 10,
};

// Same as `identityError`, but silent until the value is long enough to judge —
// so a half-typed number isn't flagged red on the very first keystroke. Use this
// for the field's live helper text and `identityError` when submitting.
export const identityLiveError = (type, value) => {
  const v = String(value || '').trim();
  if (v.length < (MIN_IDENTITY_LENGTH[type] ?? 0)) return '';
  return identityError(type, v);
};
