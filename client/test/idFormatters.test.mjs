import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIdentityType, formatIdentityByType,
  identityError, identityLiveError, identityHint, identityPlaceholder,
} from '../src/components/forms/bookingForm/idFormatters.js';

// Every spelling the app uses for the same document type.
const ALIASES = {
  Aadhaar:        ['Aadhar', 'Aadhaar', 'Aadhaar Card', 'aadhaar card'],
  Passport:       ['Passport', 'passport'],
  DrivingLicense: ['DrivingLicense', 'Driving License', 'driving license'],
  VoterID:        ['VoterID', 'Voter ID', 'voter id'],
  PAN:            ['PAN', 'PAN Card', 'pan card'],
};

test('every alias normalises to one canonical type', () => {
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      assert.equal(normalizeIdentityType(a), canonical, `${a} -> ${canonical}`);
    }
  }
  assert.equal(normalizeIdentityType('Something Else'), '');
  assert.equal(normalizeIdentityType(undefined), '');
});

// The bug this file exists to prevent: a type that formats but never validates.
test('every supported type has hint, placeholder AND validation', () => {
  for (const aliases of Object.values(ALIASES)) {
    for (const type of aliases) {
      assert.notEqual(identityHint(type), '', `no hint for ${type}`);
      assert.notEqual(identityPlaceholder(type), '', `no placeholder for ${type}`);
      // A clearly invalid value must produce an error for every alias.
      assert.notEqual(identityError(type, 'XX'), '', `no validation for ${type}`);
    }
  }
});

test('formatting is identical across a type\'s aliases', () => {
  const samples = {
    Aadhaar: '234567890123', Passport: 'AB1234567',
    DrivingLicense: 'BR1420230001234', VoterID: 'ABC1234567', PAN: 'ABCDE1234F',
  };
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const expected = formatIdentityByType(canonical, samples[canonical]);
    for (const a of aliases) {
      assert.equal(formatIdentityByType(a, samples[canonical]), expected, `${a} formats differently`);
    }
  }
});

test('PAN validates (the case that had a formatter but no validator)', () => {
  assert.equal(formatIdentityByType('PAN Card', 'abcde1234f'), 'ABCDE1234F');
  assert.equal(identityError('PAN Card', 'ABCDE1234F'), '');
  assert.notEqual(identityError('PAN Card', 'ABCDE1234'), '', 'too short must fail');
  assert.notEqual(identityError('PAN Card', 'ABCD12345F'), '', 'wrong shape must fail');
  // Live validation must stay silent while typing, then fire once complete.
  assert.equal(identityLiveError('PAN Card', 'ABCDE'), '', 'must not nag mid-typing');
  assert.notEqual(identityLiveError('PAN Card', 'ABCDE1234X1'), '');
});

test('Aadhaar uses spaces and rejects a bad checksum', () => {
  assert.equal(formatIdentityByType('Aadhaar Card', '234567890123'), '2345 6789 0123');
  assert.match(identityPlaceholder('Aadhaar'), /^\d{4} \d{4} \d{4}$/, 'placeholder must use spaces, not hyphens');
  assert.notEqual(identityError('Aadhaar', '1234 5678 9012'), '', 'invalid checksum must fail');
});

test('Passport accepts the documented optional trailing letters', () => {
  for (const v of ['AB1234567', 'AB1234567C', 'AB1234567CD']) {
    assert.equal(identityError('Passport', v), '', `${v} should be accepted`);
  }
  assert.notEqual(identityError('Passport', 'A1234567'), '');
});

test('live validation stays silent until a value could be complete', () => {
  assert.equal(identityLiveError('Aadhaar Card', '2345'), '');
  assert.equal(identityLiveError('Voter ID', 'ABC12'), '');
  assert.equal(identityLiveError('Driving License', 'BR14'), '');
});
