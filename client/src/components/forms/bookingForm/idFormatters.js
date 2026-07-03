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

// Passport: 2 alphabets + 7 digits + optional 1-2 alphabets (max 11 chars).
export const formatPassport = (raw) => {
  const value = String(raw).toUpperCase();
  let formatted = '';
  for (let i = 0; i < value.length && formatted.length < 11; i++) {
    const char = value[i];
    if (i < 2) {
      if (/[A-Z]/.test(char)) { formatted += char; }
    } else if (i < 9) {
      if (/[0-9]/.test(char)) { formatted += char; }
    } else if (/[A-Z]/.test(char)) {
      formatted += char;
    }
  }
  return formatted;
};

// Driving licence: 2 alphabets + 2 digits + space + up to 11 digits.
export const formatDrivingLicense = (raw) => {
  const value = String(raw).toUpperCase();
  let formatted = '';
  let spaceAdded = false;
  for (let i = 0; i < value.length && formatted.length < 15; i++) {
    const char = value[i];
    if (i < 2) {
      if (/[A-Z]/.test(char)) { formatted += char; }
    } else if (i < 4) {
      if (/[0-9]/.test(char)) { formatted += char; }
    } else if (i === 4 && !spaceAdded) {
      formatted += ' ';
      spaceAdded = true;
      if (/[0-9]/.test(char)) { formatted += char; }
    } else if (i > 4 || (i === 4 && spaceAdded)) {
      if (/[0-9]/.test(char)) { formatted += char; }
    }
  }
  return formatted;
};

// Voter ID: 3 alphabets + 7 digits.
export const formatVoterId = (raw) => {
  const value = String(raw).toUpperCase();
  let formatted = '';
  for (let i = 0; i < value.length && formatted.length < 10; i++) {
    const char = value[i];
    if (i < 3) {
      if (/[A-Z]/.test(char)) { formatted += char; }
    } else if (/[0-9]/.test(char)) {
      formatted += char;
    }
  }
  return formatted;
};

// PAN: 5 alphabets + 4 digits + 1 alphabet.
export const formatPanCard = (raw) => {
  const value = String(raw).toUpperCase();
  let formatted = '';
  for (let i = 0; i < value.length && formatted.length < 10; i++) {
    const char = value[i];
    if (i < 5) {
      if (/[A-Z]/.test(char)) { formatted += char; }
    } else if (i < 9) {
      if (/[0-9]/.test(char)) { formatted += char; }
    } else if (/[A-Z]/.test(char)) {
      formatted += char;
    }
  }
  return formatted;
};

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
