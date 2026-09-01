import {
  normalizeIdentityType,
  formatIdentityByType,
  identityError,
  identityLiveError,
  identityHint,
  identityPlaceholder,
} from '../idFormatters';

// Every spelling the app uses for the same document type.
const ALIASES = {
  Aadhaar: ['Aadhar', 'Aadhaar', 'Aadhaar Card', 'aadhaar card'],
  Passport: ['Passport', 'passport'],
  DrivingLicense: ['DrivingLicense', 'Driving License', 'driving license'],
  VoterID: ['VoterID', 'Voter ID', 'voter id'],
  PAN: ['PAN', 'PAN Card', 'pan card'],
};

const SAMPLES = {
  Aadhaar: '234567890123',
  Passport: 'AB1234567',
  DrivingLicense: 'BR1420230001234',
  VoterID: 'ABC1234567',
  PAN: 'ABCDE1234F',
};

test('every alias normalises to one canonical type', () => {
  Object.entries(ALIASES).forEach(([canonical, aliases]) => {
    aliases.forEach((a) => expect(normalizeIdentityType(a)).toBe(canonical));
  });
  expect(normalizeIdentityType('Something Else')).toBe('');
  expect(normalizeIdentityType(undefined)).toBe('');
});

// The bug this file exists to prevent: a type that formats but never validates.
test('every supported type has a hint, a placeholder AND validation', () => {
  Object.values(ALIASES).flat().forEach((type) => {
    expect(identityHint(type)).not.toBe('');
    expect(identityPlaceholder(type)).not.toBe('');
    expect(identityError(type, 'XX')).not.toBe('');
  });
});

test("formatting is identical across a type's aliases", () => {
  Object.entries(ALIASES).forEach(([canonical, aliases]) => {
    const expected = formatIdentityByType(canonical, SAMPLES[canonical]);
    aliases.forEach((a) =>
      expect(formatIdentityByType(a, SAMPLES[canonical])).toBe(expected));
  });
});

test('PAN validates (the case that had a formatter but no validator)', () => {
  expect(formatIdentityByType('PAN Card', 'abcde1234f')).toBe('ABCDE1234F');
  expect(identityError('PAN Card', 'ABCDE1234F')).toBe('');
  expect(identityError('PAN Card', 'ABCDE1234')).not.toBe('');
  expect(identityError('PAN Card', 'ABCD12345F')).not.toBe('');
  expect(identityLiveError('PAN Card', 'ABCDE')).toBe('');
  expect(identityLiveError('PAN Card', 'ABCDE1234X1')).not.toBe('');
});

test('Aadhaar uses spaces and rejects a bad checksum', () => {
  expect(formatIdentityByType('Aadhaar Card', '234567890123')).toBe('2345 6789 0123');
  expect(identityPlaceholder('Aadhaar')).toMatch(/^\d{4} \d{4} \d{4}$/);
  expect(identityError('Aadhaar', '1234 5678 9012')).not.toBe('');
});

test('Passport accepts the documented optional trailing letters', () => {
  ['AB1234567', 'AB1234567C', 'AB1234567CD'].forEach((v) =>
    expect(identityError('Passport', v)).toBe(''));
  expect(identityError('Passport', 'A1234567')).not.toBe('');
});

test('live validation stays silent until a value could be complete', () => {
  expect(identityLiveError('Aadhaar Card', '2345')).toBe('');
  expect(identityLiveError('Voter ID', 'ABC12')).toBe('');
  expect(identityLiveError('Driving License', 'BR14')).toBe('');
});
