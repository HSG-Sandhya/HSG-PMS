// Pure pricing maths for event quotations. Kept free of Mongoose so both the
// model and the print template can use it without pulling in the data layer.
//
// NOTE: client/src/components/banquet/quotationPresets.js carries a mirror of
// these two functions so the builder can show live totals without a round trip
// (CRA cannot import from outside client/src). The server is the authority —
// every stored amount is computed here. Change both together.

// Amount a quoted package works out to for the quantity quoted.
//   'lump sum'  → price × days, head count ignored
//   everything else → price × quantity × days, falling back to the quotation's
//   expected guest count when the package carries no explicit quantity.
export const packageTotal = (pkg, fallbackGuests = 0) => {
  const price = Number(pkg?.price) || 0;
  const days = Number(pkg?.days) || 1;
  if (pkg?.priceBasis === 'lump sum') return price * days;
  const qty = Number(pkg?.quantity) || Number(fallbackGuests) || 0;
  return price * qty * days;
};

// Gross (GST-inclusive) amount of one optional facility line. Add-ons are quoted
// ex-GST on the sheet but stored gross on the booking.
export const addOnTotal = (addOn) => {
  const base = (Number(addOn?.price) || 0) * (Number(addOn?.quantity) || 1);
  return Math.round(base * (1 + (Number(addOn?.gstPercent) || 0) / 100));
};

// Head count a per-head package will actually bill on, given an optional
// override from the caller. Returns 0 when nothing is known — callers must
// treat that as "cannot price this yet" rather than a free event.
export const resolveQuantity = ({ override, pkg, expectedGuests }) =>
  Number(override) || Number(pkg?.quantity) || Number(expectedGuests) || 0;

export const PER_HEAD_BASES = ['per person', 'per plate'];

export const isPerHead = (pkg) => PER_HEAD_BASES.includes(pkg?.priceBasis);
