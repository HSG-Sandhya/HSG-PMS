import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  hsnFor,
} from './formatters.js';
import { BASE_THEME, hexChannels } from './theme.js';

// ── The Food Bill ────────────────────────────────────────────────────────────
// Restaurant and room-service charges are a document of their own, not lines on
// the stay invoice. Two reasons, both of them real:
//
//   • Food is taxed at the POS rate, accommodation at the room rate, and F&B
//     often trades under its own GST registration and FSSAI licence. One
//     document cannot honestly carry two registrations.
//   • It is how this hotel already bills — the Heritage template split them
//     from the start, and accountingSync.js attributes payment the same way
//     (food settles first, the room takes the remainder).
//
// This renders as a SECTION appended to whichever design was chosen, rather
// than being written into each of them, so every template gains the separate
// bill and they cannot drift apart. It carries its own scoped styles: every
// class is `fb-` prefixed and the colours are resolved to literals here, so
// nothing leaks into or out of the host template's stylesheet.

const money = (n) => formatCurrency(Number(n) || 0);

const itemRows = (items) => items.map((item, i) => `
  <tr>
    <td class="fb-c fb-mut">${i + 1}</td>
    <td>
      <div class="fb-nm">${e(item.description)}</div>
      ${item.detail ? `<div class="fb-dt">${e(item.detail)}</div>` : ''}
    </td>
    <td class="fb-c fb-mut">${e(hsnFor(item.category))}</td>
    <td class="fb-r">${e(item.quantity)}</td>
    <td class="fb-r">${money(item.rate)}</td>
    <td class="fb-r fb-amt">${money(item.amount)}</td>
  </tr>`).join('');

/**
 * The settlement: the one place accommodation and food are added together.
 * Without it a guest holding two documents has to do the sum themselves, and
 * neither document alone states what is actually owed.
 */
const settlementBlock = (ctx) => {
  const s = ctx.settlement;
  if (!s) return '';
  const balance = Number(s.balance) || 0;
  const closing = balance > 0.5
    ? `<tr class="fb-due"><td>Balance due</td><td class="fb-r">${money(balance)}</td></tr>`
    : balance < -0.5
      ? `<tr class="fb-due"><td>To refund</td><td class="fb-r">${money(Math.abs(balance))}</td></tr>`
      : '<tr class="fb-due"><td>Balance</td><td class="fb-r">Settled in full</td></tr>';
  return `
  <section class="fb-block">
    <div class="fb-cap">Total payable for this stay</div>
    <table class="fb-settle">
      <tbody>
        <tr>
          <td>Accommodation<span class="fb-sub">Tax Invoice No. ${e(s.roomInvoiceNumber || '—')}</span></td>
          <td class="fb-r">${money(s.accommodationTotal)}</td>
        </tr>
        <tr>
          <td>Food &amp; beverage<span class="fb-sub">Food Bill No. ${e(s.foodBillNumber || '—')}</span></td>
          <td class="fb-r">${money(s.foodTotal)}</td>
        </tr>
        <tr class="fb-comb"><td>Combined total</td><td class="fb-r">${money(s.combinedTotal)}</td></tr>
        ${Number(s.paid) > 0 ? `<tr><td>Paid</td><td class="fb-r">${money(s.paid)}</td></tr>` : ''}
        ${closing}
      </tbody>
    </table>
    <p class="fb-note">
      Accommodation and food are invoiced separately. This is the single amount payable for both.
    </p>
  </section>`;
};

/**
 * @param {Object} ctx   normalized invoice context (needs ctx.food)
 * @param {Object} theme resolved theme, or null to use the neutral defaults
 * @returns {string} an HTML fragment to append before </body>, or '' when
 *                   nothing was eaten
 */
export const renderFoodBillSection = (ctx, theme = null) => {
  if (!ctx || !ctx.food || !ctx.food.items || !ctx.food.items.length) return '';
  const t = theme || BASE_THEME;
  const food = ctx.food;
  const rest = ctx.hotel.restaurant || {};
  const half = Math.round((Number(food.gstRate) || 0) * 10) / 20; // half the rate

  return `
<div data-fit-exempt="food-bill">
<style>
  .fb-doc {
    page-break-before: always;
    break-before: page;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: ${t.ink};
    background: ${t.sheet};
    font-size: 11px;
    line-height: 1.5;
    max-width: 820px;
    margin: 0 auto;
    padding: 26px 30px 30px;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .fb-doc * { box-sizing: border-box; }
  .fb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 22px;
    padding-bottom: 14px; border-bottom: 2px solid ${t.accent}; }
  .fb-eyebrow { font-size: 8.5px; letter-spacing: 0.22em; text-transform: uppercase;
    color: ${t.accent}; font-weight: 700; margin-bottom: 5px; }
  .fb-name { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
  .fb-meta { font-size: 10px; color: ${t.muted}; line-height: 1.7; margin-top: 6px; max-width: 340px; }
  .fb-side { text-align: right; flex-shrink: 0; }
  .fb-label { font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: ${t.muted}; }
  .fb-no { font-size: 17px; font-weight: 700; color: ${t.accent}; margin-top: 3px; }
  .fb-reg { font-size: 10px; color: ${t.muted}; line-height: 1.7; margin-top: 6px; }

  .fb-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 16px 0 14px; }
  .fb-cap { font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: ${t.accent};
    font-weight: 700; margin-bottom: 6px; }
  .fb-pname { font-size: 13px; font-weight: 700; }
  .fb-pmeta { font-size: 10px; color: ${t.muted}; line-height: 1.7; }

  .fb-items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .fb-items thead th { font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase;
    text-align: left; font-weight: 700; color: ${t.muted}; padding: 0 8px 7px;
    border-bottom: 1.5px solid ${t.ink}; }
  .fb-items tbody td { padding: 9px 8px; vertical-align: top;
    border-bottom: 1px solid rgba(${hexChannels(t.muted)}, 0.18); }
  .fb-items tbody tr:last-child td { border-bottom: none; }
  .fb-nm { font-weight: 600; }
  .fb-dt { font-size: 9.5px; color: ${t.muted}; margin-top: 2px; }
  .fb-mut { color: ${t.muted}; font-size: 9.5px; }
  .fb-amt { font-weight: 700; }
  .fb-r { text-align: right; font-variant-numeric: tabular-nums; }
  .fb-c { text-align: center; }

  .fb-sum { display: flex; justify-content: flex-end; }
  .fb-tot { width: 290px; border-collapse: collapse; font-size: 11px; }
  .fb-tot td { padding: 5px 0; }
  .fb-tot .fb-r { text-align: right; }
  .fb-tot .fb-grand td { border-top: 1.5px solid ${t.accent}; border-bottom: 1.5px solid ${t.accent};
    padding: 9px 0; font-size: 13.5px; font-weight: 700; }

  .fb-block { margin-top: 20px; }
  .fb-settle { width: 100%; max-width: 420px; border-collapse: collapse; font-size: 11px; }
  .fb-settle td { padding: 6px 0; border-bottom: 1px solid rgba(${hexChannels(t.muted)}, 0.16); }
  .fb-sub { display: block; font-size: 9.5px; color: ${t.muted}; margin-top: 2px; }
  .fb-comb td { font-weight: 700; font-size: 12.5px; border-top: 1px solid ${t.accent};
    border-bottom: 1px solid ${t.accent}; }
  .fb-due td { font-weight: 700; color: ${t.accent}; border-bottom: none; }
  .fb-note { font-size: 9.5px; color: ${t.muted}; margin: 10px 0 0; max-width: 520px; }
  .fb-foot { text-align: center; font-size: 9px; color: ${t.muted}; margin-top: 22px;
    border-top: 1px solid rgba(${hexChannels(t.muted)}, 0.18); padding-top: 10px; }

  @media print { .fb-doc { max-width: none; padding: 0; } }
</style>

<section class="fb-doc">
  <header class="fb-head">
    <div>
      <div class="fb-eyebrow">Restaurant &amp; room service</div>
      <div class="fb-name">${e(rest.name || ctx.hotel.name)}</div>
      <div class="fb-meta">
        ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
        ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email)]
          .filter(Boolean).join(' · ')}
        ${rest.fssai ? `<br/>FSSAI ${e(rest.fssai)}` : ''}
      </div>
    </div>
    <div class="fb-side">
      <div class="fb-label">Food Bill</div>
      <div class="fb-no">${e(food.number || '—')}</div>
      <div class="fb-reg">
        ${formatLongDate(ctx.invoice.issuedOn)}
        ${rest.gstin ? `<br/>GSTIN ${e(rest.gstin)}` : ''}
      </div>
    </div>
  </header>

  <section class="fb-parties">
    <div>
      <div class="fb-cap">Billed to</div>
      <div class="fb-pname">${e(ctx.customer.name)}</div>
      <div class="fb-pmeta">
        ${ctx.stay && ctx.stay.roomNumber ? `Room ${e(ctx.stay.roomNumber)}<br/>` : ''}
        ${ctx.customer.phone ? `Tel ${e(ctx.customer.phone)}<br/>` : ''}
        ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div>
      <div class="fb-cap">Period</div>
      <div class="fb-pmeta">
        ${ctx.stay ? `${formatDate(ctx.stay.checkIn)} to ${formatDate(ctx.stay.checkOut)}<br/>` : ''}
        Charges raised during the stay
      </div>
    </div>
  </section>

  <table class="fb-items">
    <thead><tr>
      <th class="fb-c" style="width:30px">#</th>
      <th>Item</th>
      <th class="fb-c" style="width:70px">HSN/SAC</th>
      <th class="fb-r" style="width:44px">Qty</th>
      <th class="fb-r" style="width:88px">Rate</th>
      <th class="fb-r" style="width:100px">Amount</th>
    </tr></thead>
    <tbody>${itemRows(food.items)}</tbody>
  </table>

  <div class="fb-sum">
    <table class="fb-tot">
      <tr><td>Taxable value</td><td class="fb-r">${money(food.subtotal)}</td></tr>
      <tr><td>CGST @ ${half}%</td><td class="fb-r">${money(food.cgst)}</td></tr>
      <tr><td>SGST @ ${half}%</td><td class="fb-r">${money(food.sgst)}</td></tr>
      <tr class="fb-grand"><td>Food bill total</td><td class="fb-r">${money(food.total)}</td></tr>
    </table>
  </div>

  ${settlementBlock(ctx)}

  <div class="fb-foot">
    Thank you for dining with us · ${e(rest.name || ctx.hotel.name)}
  </div>
</section>
</div>`;
};
