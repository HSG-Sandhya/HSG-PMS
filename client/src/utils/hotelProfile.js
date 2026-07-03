// ───────────────────────────────────────────────────────────────────────────
// Live hotel identity for print/receipt/invoice builders. Many of these are
// plain HTML-string functions with no hook scope, so SettingsContext pushes the
// resolved Hotel Profile here (setLiveHotelProfile) and the builders read it via
// hotelIdentity(). Defaults preserve the strings the templates shipped with, so
// nothing changes until the admin fills in Hotel Profile settings.
// ───────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  hotelName: 'Hotel Sandhya Grand',
  hotelNameFull: 'Hotel Sandhya Grand & Marriage Hall',
  phone: '+91 9431419196',
  email: 'info@sandhyagrand.com',
  gstin: '10ASQPM7914B3ZW',
  // Restaurant operates under its own name + GST registration on the food bill.
  restaurantName: 'Sandhya Sweets',
  restaurantTagline: 'Marriage Hall & Restaurant',
  restaurantGstin: '10ASQPM7914B2ZX',
  addressLine: 'Bari Bazaar Road, Near Punjab National Bank, Munger, Bihar 811201',
};

let _identity = { ...DEFAULTS };

const firstNonEmpty = (...vals) => vals.find((v) => v != null && String(v).trim() !== '');

// Build a single-line address from the structured Hotel Profile address.
const joinAddress = (addr = {}) =>
  [addr.line1, addr.line2, addr.area, addr.city, addr.state, addr.postalCode]
    .filter((p) => p && String(p).trim())
    .join(', ');

export const setLiveHotelProfile = (hp) => {
  const profile = hp || {};
  const br = profile.businessRegistration || {};
  const rest = profile.restaurant || {};
  const contact = profile.contact || {};
  const name = firstNonEmpty(profile.hotelName);
  _identity = {
    hotelName: name || DEFAULTS.hotelName,
    hotelNameFull: firstNonEmpty(profile.legalName, name) || DEFAULTS.hotelNameFull,
    phone: firstNonEmpty(contact.phone) || DEFAULTS.phone,
    email: firstNonEmpty(contact.email) || DEFAULTS.email,
    gstin: firstNonEmpty(br.gstNumber) || DEFAULTS.gstin,
    restaurantName: firstNonEmpty(rest.name, name) || DEFAULTS.restaurantName,
    restaurantTagline: DEFAULTS.restaurantTagline,
    restaurantGstin: firstNonEmpty(rest.gstNumber, br.gstNumber) || DEFAULTS.restaurantGstin,
    addressLine: joinAddress(profile.address) || DEFAULTS.addressLine,
  };
};

// The resolved hotel/restaurant identity, for any print or display code.
export const hotelIdentity = () => _identity;
