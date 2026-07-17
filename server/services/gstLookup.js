// GSTIN → company-details lookup via a licensed provider (Surepass — the same
// vendor we already use for Aadhaar e-KYC). Kept behind a small, provider-
// agnostic interface — lookupGstin() — so the controller/UI never learn which
// vendor we use, and swapping providers later means editing only this file.
//
// Flow (Surepass Corporate GSTIN):
//   POST /api/v1/corporate/gstin { id_number: <GSTIN> }
//     -> returns the registered legal/trade name and the principal place of
//        business (the GST-registered address) for that GSTIN.
//
// Configure via server/.env (shared with the Aadhaar KYC service):
//   SUREPASS_TOKEN=<bearer token from the Surepass dashboard>
//   SUREPASS_BASE_URL=https://kyc-api.surepass.io   (optional; this is default)

import axios from 'axios';

const BASE = process.env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.io';
const TOKEN = process.env.SUREPASS_TOKEN || '';

// The first two digits of a GSTIN are the state code. Used to name the state in
// the dev simulation, and as a fallback when the provider omits the state name.
const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// When no token is set the controller falls back to a clearly-labelled dev
// simulation, so local development doesn't require a live GST lookup account.
export const isConfigured = () => Boolean(TOKEN);

const client = () =>
  axios.create({
    baseURL: BASE,
    timeout: 20000,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

// Prefer the provider's own error message when surfacing failures.
const providerError = (data, fallback) => {
  const msg = data?.message || data?.message_code || fallback;
  const err = new Error(msg);
  err.providerMessage = msg;
  return err;
};

// Normalize the many shapes Surepass/GST portal use for the principal address
// into the structured parts our guest form expects.
const parseAddress = (d, gstin) => {
  // Richest shape: the GST-portal `pradr.addr` object (per-field breakdown).
  const a =
    d?.pradr?.addr ||
    d?.principal_place_of_business_fields?.principal_address?.address_details ||
    null;

  if (a && typeof a === 'object') {
    const street = [a.flno, a.bno, a.bnm, a.st].map((s) => String(s || '').trim()).filter(Boolean).join(', ');
    const area = [a.loc, a.landMark].map((s) => String(s || '').trim()).filter(Boolean).join(', ');
    const district = a.dst || a.city || '';
    const state = a.stcd || GST_STATE_CODES[gstin.slice(0, 2)] || '';
    const pincode = String(a.pncd || '');
    return {
      street, area, district, state, pincode,
      full: [street, area, district, state, pincode].filter(Boolean).join(', '),
    };
  }

  // Flat fallback: a single address string (+ maybe pincode/state fields).
  const full = String(d?.address || d?.pradr?.adr || '').trim();
  const pincode = String((full.match(/\b(\d{6})\b/) || [])[1] || d?.pincode || '');
  const state = d?.state || GST_STATE_CODES[gstin.slice(0, 2)] || '';
  // Drop a trailing ", <pincode>" so it isn't duplicated in the street line.
  const street = pincode ? full.replace(new RegExp(`,?\\s*${pincode}\\s*$`), '').trim() : full;
  return { street, area: '', district: '', state, pincode, full };
};

// Look up a GSTIN and return the registered company profile + structured
// address. Throws on an invalid/inactive GSTIN or a provider failure.
export const lookupGstin = async (gstin) => {
  const { data } = await client().post('/api/v1/corporate/gstin', { id_number: gstin });
  const d = data?.data || {};
  if (!data?.success || !d) {
    throw providerError(data, 'Could not fetch GST details');
  }
  return {
    gstNumber: d.gstin || gstin,
    legalName: d.legal_name || d.business_name || d.company_name || '',
    tradeName: d.trade_name || d.business_name || '',
    status: d.gstin_status || d.status || '',
    address: parseAddress(d, gstin),
    demo: false,
  };
};

// Clearly-labelled dev sample when no provider is configured — lets the feature
// be exercised locally. The state is derived from the real GSTIN prefix so it
// still lines up with the number that was typed.
export const simulateGstin = (gstin) => {
  const state = GST_STATE_CODES[gstin.slice(0, 2)] || 'Bihar';
  return {
    gstNumber: gstin,
    legalName: 'DEMO ENTERPRISES PRIVATE LIMITED',
    tradeName: 'Demo Enterprises',
    status: 'Active',
    address: {
      street: 'Plot 12, Industrial Area Phase 1',
      area: 'Near City Centre',
      district: 'Sample District',
      state,
      pincode: '800001',
      full: `Plot 12, Industrial Area Phase 1, Near City Centre, Sample District, ${state}, 800001`,
    },
    demo: true,
  };
};
