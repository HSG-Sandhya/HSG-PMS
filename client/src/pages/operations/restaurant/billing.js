// Pure dining-charge math for an occupied table.
//
// Pricing rules (rates come from Billing & Operations config):
//   • ₹150 per guest for the first hour  → 2 guests = ₹300 / hr (the base).
//   • After the first hour, every *started* half-hour adds ₹75 per guest, so the
//     moment the clock crosses 1h 00m 01s the next ₹75/guest block is charged.
//   • The time charge is a MINIMUM SPEND: a table's orders are adjusted against
//     it, and the guest pays whichever is greater (orders or table charge).
//   • Packing leftover food adds a flat ₹15.
//
// A minimum guest count (default 2) is always billed.

export function computeTableBill({ elapsedSeconds, guests, orderTotal, packing, rates = {} }) {
  const {
    perPersonHour = 150,
    perPersonHalfHour = 75,
    minGuests = 2,
    packingCharge = 15,
  } = rates;

  const people = Math.max(minGuests, Number(guests) || 0);
  const sec = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));

  // First hour is one full hour; thereafter count each started half-hour block.
  const halfBlocks = sec > 3600 ? Math.ceil((sec - 3600) / 1800) : 0;

  const baseCharge = perPersonHour * people;            // first hour
  const extraCharge = halfBlocks * perPersonHalfHour * people;
  const timeCharge = baseCharge + extraCharge;

  const orders = Math.max(0, Number(orderTotal) || 0);
  // Table charge is the minimum spend; orders adjust against it.
  const subtotal = Math.max(timeCharge, orders);
  const packCharge = packing ? packingCharge : 0;
  const total = subtotal + packCharge;

  return {
    people,
    halfBlocks,
    baseCharge,
    extraCharge,
    timeCharge,
    orderTotal: orders,
    subtotal,
    packCharge,
    total,
    // true when the food order alone meets/exceeds the minimum table spend.
    orderCovers: orders >= timeCharge,
  };
}
