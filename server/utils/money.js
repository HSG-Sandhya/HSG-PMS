/**
 * Money normalisation.
 *
 * Rupee amounts are stored as JS numbers, so arithmetic on decimal rates drifts:
 * a room at 1099.90 for 7 nights is 7699.300000000001 by multiplication and
 * 7699.299999999999 by repeated addition. Neither equals 7699.30.
 *
 * That drift is invisible until something COMPARES the result. The invoice
 * templates decide paid-status with `balance <= 0`, so a booking settled to the
 * last rupee could carry a balance of 1e-12 and print as "partial" — a guest
 * shown as owing money they have already paid.
 *
 * Rounding every computed balance to paise removes that class of bug. The
 * accounting layer already does this (Transaction, AccountingEntry, MenuItem,
 * accountController); these helpers give the booking side the same treatment.
 *
 * Not a substitute for integer-paise storage, which remains the stricter fix —
 * but it closes the comparison hazard without a schema migration.
 */

/** Round to 2 decimal places (paise), safely handling non-numeric input. */
export const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

/** A balance that is never negative and never a floating-point crumb. */
export const balanceOf = (total, paid) => Math.max(0, roundMoney(roundMoney(total) - roundMoney(paid)));

export default roundMoney;
