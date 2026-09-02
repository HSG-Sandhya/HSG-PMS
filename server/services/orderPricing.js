import mongoose from 'mongoose';

import MenuItem from '../models/MenuItem.js';
import { getBilling, posGst } from '../config/operationalConfig.js';
import { roundMoney } from '../utils/money.js';

/**
 * The single source of truth for what a restaurant / room-service order COSTS.
 *
 * The public ordering endpoints are unauthenticated — anyone who can reach the
 * storefront can POST to them. They used to build the Order straight from the
 * request body:
 *
 *     items: orderData.items,            // ← name, price and quantity, all from the browser
 *     totalAmount: orderData.totalAmount // ← and the total too
 *
 * The Order pre-save hook recomputes `totalAmount` from the line items, which
 * LOOKS like it closes the hole, but it recomputes from `item.price` — which is
 * itself whatever the browser sent. `price` is only `min: 0`, so a crafted
 * request could book a ₹450 biryani at ₹1, or at ₹0.
 *
 * The GST was a second, independent hole: it was derived from the submitted
 * `totalAmount` rather than from the items, so `totalAmount: 0` with honest
 * prices produced a tax-free order.
 *
 * So the browser now sends only WHAT it wants and HOW MANY. Identity, price,
 * availability, tax and total are all read or derived server-side. The staff POS
 * (authenticated, `manage_restaurant`) deliberately keeps its ability to set a
 * price, because overriding one is a legitimate front-of-house action —
 * discounts, staff meals, comps. Anonymous callers get no such privilege.
 */

const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 100;

/** A price error the caller should surface to the guest as a 400. */
export class OrderPricingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderPricingError';
    this.status = 400;
  }
}

/**
 * Collapse the submitted cart to `{ itemId → quantity }`, keeping nothing else.
 * Repeating an id is legal (two cart lines of the same dish) and sums.
 *
 * Exported so the rules that reject hostile carts are unit-testable without a
 * database: everything the browser sent other than an id and a count is dropped
 * here, before any lookup happens.
 */
export const readRequestedQuantities = (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderPricingError('Order must contain at least one item');
  }
  if (rawItems.length > MAX_LINES) {
    throw new OrderPricingError(`An order cannot contain more than ${MAX_LINES} different items`);
  }

  const wanted = new Map();
  for (const raw of rawItems) {
    const id = String(raw?.itemId ?? raw?._id ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new OrderPricingError('Order contains an item that does not exist on the menu');
    }

    const qty = Number(raw?.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new OrderPricingError('Every item needs a whole quantity of at least 1');
    }

    const total = (wanted.get(id) || 0) + qty;
    if (total > MAX_QTY_PER_LINE) {
      throw new OrderPricingError(`A single item is limited to ${MAX_QTY_PER_LINE} per order`);
    }
    wanted.set(id, total);
  }
  return wanted;
};

/**
 * Price a submitted cart against the live menu.
 *
 * Returns the canonical `items` to persist (server name + server price), the
 * pre-tax `subtotal`, and the `gst` for the configured POS rate. The caller
 * spreads these into the Order instead of anything off the request body.
 *
 * Throws OrderPricingError (status 400) if an item is unknown or unavailable.
 */
export const priceOrder = async (rawItems) => {
  const wanted = readRequestedQuantities(rawItems);

  const menuItems = await MenuItem.find({ _id: { $in: [...wanted.keys()] } })
    .select('name price isAvailable');
  const byId = new Map(menuItems.map((m) => [String(m._id), m]));

  const items = [];
  for (const [id, quantity] of wanted) {
    const menuItem = byId.get(id);
    // Unknown and unavailable are reported the same way on purpose: this
    // endpoint is public, and a distinct "no such item" reply would let anyone
    // enumerate the menu collection by walking ObjectIds.
    if (!menuItem || menuItem.isAvailable === false) {
      const label = menuItem?.name ? `"${menuItem.name}"` : 'An item in your order';
      throw new OrderPricingError(`${label} is not available right now. Please remove it and try again.`);
    }
    items.push({
      itemId: menuItem._id,
      name: menuItem.name,
      price: roundMoney(menuItem.price),
      quantity,
    });
  }

  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const gst = roundMoney(posGst(subtotal, await getBilling()));

  // What the Order pre-save hook will arrive at, returned so the caller can
  // show the guest the same figure without recomputing it a third way.
  return { items, subtotal, gst, total: roundMoney(subtotal + gst) };
};

export default priceOrder;
