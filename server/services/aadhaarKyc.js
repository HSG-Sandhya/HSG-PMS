// Aadhaar OTP e-KYC via a licensed provider (Surepass). Kept behind a small,
// provider-agnostic interface — generateOtp() / submitOtp() — so the controller
// and UI never learn which vendor we use, and swapping providers later means
// editing only this file.
//
// Flow (Surepass Aadhaar v2):
//   1. generate-otp { id_number }  -> returns a client_id; the OTP is delivered
//      by UIDAI to the mobile registered against that Aadhaar (we never see it).
//   2. submit-otp   { client_id, otp } -> returns the verified KYC profile.
//
// Configure via server/.env:
//   SUREPASS_TOKEN=<bearer token from the Surepass dashboard>
//   SUREPASS_BASE_URL=https://kyc-api.surepass.io   (optional; this is default)

import axios from 'axios';

const BASE = process.env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.io';
const TOKEN = process.env.SUREPASS_TOKEN || '';

// When no token is set the controller falls back to a clearly-labelled dev
// simulation, so local development doesn't require a live KYC account.
export const isConfigured = () => Boolean(TOKEN);

const client = () =>
  axios.create({
    baseURL: BASE,
    timeout: 20000,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

// Surefire error surfacing: prefer the provider's own message.
const providerError = (data, fallback) => {
  const msg = data?.message || data?.message_code || fallback;
  const err = new Error(msg);
  err.providerMessage = msg;
  return err;
};

// Ask the provider to send an OTP to the Aadhaar-registered mobile.
// Returns { clientId } — pass it back to submitOtp().
export const generateOtp = async (aadhaarNumber) => {
  const { data } = await client().post('/api/v1/aadhaar-v2/generate-otp', {
    id_number: aadhaarNumber,
  });
  const d = data?.data || {};
  if (!data?.success || !d.client_id) {
    throw providerError(data, 'Could not send Aadhaar OTP');
  }
  return { clientId: d.client_id, otpSent: d.otp_sent !== false };
};

// Submit the OTP; on success returns the verified KYC profile.
export const submitOtp = async (clientId, otp) => {
  const { data } = await client().post('/api/v1/aadhaar-v2/submit-otp', {
    client_id: clientId,
    otp,
  });
  const d = data?.data || {};
  if (!data?.success) {
    throw providerError(data, 'Invalid OTP');
  }
  const addr = d.address && typeof d.address === 'object'
    ? Object.values(d.address).filter(Boolean).join(', ')
    : '';
  return {
    verified: true,
    fullName: d.full_name || '',
    dob: d.dob || '',
    gender: d.gender || '',
    address: d.full_address || addr || '',
    aadhaarMasked: d.aadhaar_number || '',
  };
};
