import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Hotel Standard ───────────────────────────────────────────────────────────
// The house invoice: a formal, minimalist hotel tax document. Charcoal
// hairlines on white, generous whitespace, a complete 5% GST breakdown
// (CGST 2.5% + SGST 2.5%), amount in words, payment summary, terms and
// signature blocks. Works for both room stays and banquet events.

export const meta = {
  id: 'hotel-standard',
  name: 'Hotel Standard',
  description:
    'Formal, minimalist hotel tax invoice — detailed particulars, 5% GST (CGST + SGST) breakdown, amount in words, terms and signatures.',
};

const renderItems = (items) => items.map((item, i) => `
  <tr>
    <td class="c">${i + 1}</td>
    <td>
      <div class="item-name">${e(item.description)}</div>
      ${item.detail ? `<div class="item-detail">${e(item.detail)}</div>` : ''}
    </td>
    <td class="c">${e(hsnFor(item.category))}</td>
    <td class="r">${e(item.quantity)}</td>
    <td class="r">${formatCurrency(item.rate)}</td>
    <td class="r">${formatCurrency(item.amount)}</td>
  </tr>`).join('');

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<tr><th>Room</th><td>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` — ${e(ctx.stay.roomType)}` : ''}</td></tr>` : ''}
      <tr><th>Check-in</th><td>${formatDate(ctx.stay.checkIn)}</td></tr>
      <tr><th>Check-out</th><td>${formatDate(ctx.stay.checkOut)}</td></tr>
      <tr><th>Nights</th><td>${e(ctx.stay.nights)}</td></tr>
      <tr><th>Occupancy</th><td>${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? `, ${e(ctx.stay.children)} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</td></tr>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      ${ctx.event.hallName ? `<tr><th>Venue</th><td>${e(ctx.event.hallName)}</td></tr>` : ''}
      ${ctx.event.type ? `<tr><th>Function</th><td>${e(ctx.event.type)}</td></tr>` : ''}
      <tr><th>Event date</th><td>${formatDate(ctx.event.date)}</td></tr>
      ${ctx.event.startTime ? `<tr><th>Timing</th><td>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</td></tr>` : ''}
      ${ctx.event.guests ? `<tr><th>Guests</th><td>${e(ctx.event.guests)} persons</td></tr>` : ''}`;
  }
  return '';
};

const statusLabel = { paid: 'PAID', partial: 'PARTIALLY PAID', unpaid: 'BALANCE DUE' };

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Tax Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; margin: 0; background: #fff; -webkit-font-smoothing: antialiased; font-size: 12px; line-height: 1.5; }
  .page { max-width: 800px; margin: 0 auto; padding: 36px 40px; }

  /* Masthead */
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #222; }
  .hotel-name { font-family: Georgia, 'Times New Roman', serif; font-size: 23px; font-weight: 700; letter-spacing: 0.01em; }
  .hotel-meta { font-size: 11px; color: #555; line-height: 1.7; margin-top: 5px; }
  .hotel-reg { text-align: right; font-size: 11px; color: #555; line-height: 1.9; white-space: nowrap; }
  .hotel-reg b { color: #222; font-weight: 600; }
  .hotel-logo { max-height: 52px; margin-bottom: 8px; }

  /* Title */
  .doc-title { text-align: center; margin: 20px 0 22px; }
  .doc-title .t { display: inline-block; font-size: 12px; letter-spacing: 0.45em; text-transform: uppercase; color: #222; border-bottom: 1px solid #222; padding: 0 10px 4px; }

  /* Meta strip */
  .meta-strip { display: flex; justify-content: space-between; gap: 16px; border: 1px solid #ddd; padding: 12px 16px; margin-bottom: 22px; }
  .meta-strip .cell .k { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: #888; margin-bottom: 3px; }
  .meta-strip .cell .v { font-size: 12.5px; font-weight: 600; color: #222; }
  .badge { display: inline-block; border: 1px solid #222; padding: 3px 10px; font-size: 9px; letter-spacing: 0.16em; }

  /* Parties */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 24px; }
  .label { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #888; margin-bottom: 7px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .party-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .party-meta { font-size: 11.5px; color: #555; line-height: 1.7; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.kv th { text-align: left; font-weight: 400; color: #888; width: 92px; padding: 2.5px 0; vertical-align: top; }
  table.kv td { padding: 2.5px 0; color: #222; }

  /* Items */
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.items thead th { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #222; text-align: left; border-top: 1.5px solid #222; border-bottom: 1px solid #222; padding: 9px 8px; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
  .item-name { font-weight: 600; }
  .item-detail { font-size: 10.5px; color: #777; margin-top: 2px; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: space-between; gap: 28px; margin-bottom: 22px; }
  .words { flex: 1; font-size: 11px; color: #555; padding-top: 8px; }
  .words b { display: block; color: #222; font-size: 11.5px; margin-top: 3px; font-style: italic; }
  table.totals { width: 300px; border-collapse: collapse; font-size: 12px; }
  table.totals td { padding: 5px 0; }
  table.totals td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.totals .muted td { color: #666; font-size: 11.5px; }
  table.totals .grand td { border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; padding: 9px 0; font-size: 14px; font-weight: 700; }
  table.totals .due td { font-weight: 600; }

  /* Payment + notes */
  .pay-note { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 24px; }

  /* Terms */
  .terms { border-top: 1px solid #eee; padding-top: 14px; margin-bottom: 30px; }
  .terms ol { margin: 6px 0 0; padding-left: 16px; font-size: 10px; color: #777; line-height: 1.8; }

  /* Signatures */
  .sig-row { display: flex; justify-content: space-between; gap: 40px; margin-top: 46px; }
  .sig { width: 220px; text-align: center; font-size: 10.5px; color: #555; }
  .sig .line { border-top: 1px solid #222; padding-top: 7px; }
  .sig .for { font-size: 10px; color: #888; margin-bottom: 26px; }

  .footnote { text-align: center; font-size: 9.5px; color: #999; margin-top: 26px; border-top: 1px solid #eee; padding-top: 10px; }

  @media print {
    .page { padding: 18px 22px; }
    body { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <header class="masthead">
    <div>
      ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
      <div class="hotel-name">${e(ctx.hotel.name)}</div>
      <div class="hotel-meta">
        ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
        ${[ctx.hotel.phone && `Tel: ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
      </div>
    </div>
    <div class="hotel-reg">
      ${ctx.hotel.gstin ? `GSTIN: <b>${e(ctx.hotel.gstin)}</b><br/>` : ''}
      ${ctx.hotel.panNumber ? `PAN: <b>${e(ctx.hotel.panNumber)}</b><br/>` : ''}
      SAC: <b>${ctx.type === 'banquet' ? '997212' : '996311'}</b>
    </div>
  </header>

  <div class="doc-title"><span class="t">Tax Invoice</span></div>

  <div class="meta-strip">
    <div class="cell"><div class="k">Invoice No.</div><div class="v">${e(ctx.invoice.number)}</div></div>
    <div class="cell"><div class="k">Invoice Date</div><div class="v">${formatLongDate(ctx.invoice.issuedOn)}</div></div>
    <div class="cell"><div class="k">${ctx.type === 'banquet' ? 'Booking Type' : 'Stay Type'}</div><div class="v">${ctx.type === 'banquet' ? 'Banquet / Event' : 'Room Accommodation'}</div></div>
    <div class="cell"><div class="k">Payment Status</div><div class="v"><span class="badge">${statusLabel[ctx.totals.status] || 'BALANCE DUE'}</span></div></div>
  </div>

  <section class="parties">
    <div>
      <div class="label">Billed To</div>
      <div class="party-name">${e(ctx.customer.name)}</div>
      <div class="party-meta">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${ctx.customer.phone ? `Tel: ${e(ctx.customer.phone)}<br/>` : ''}
        ${ctx.customer.email ? `${e(ctx.customer.email)}<br/>` : ''}
        ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div>
      <div class="label">${ctx.type === 'banquet' ? 'Event Details' : 'Stay Details'}</div>
      <table class="kv">${stayRows(ctx)}</table>
    </div>
  </section>

  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:36px">Sl.</th>
        <th>Particulars</th>
        <th class="c" style="width:80px">HSN/SAC</th>
        <th class="r" style="width:50px">Qty</th>
        <th class="r" style="width:100px">Rate</th>
        <th class="r" style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>${renderItems(ctx.items)}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="words">
      Amount chargeable (in words)
      <b>${e(amountInWords(ctx.totals.total))}</b>
    </div>
    <table class="totals">
      <tr class="muted"><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
      <tr class="muted"><td>CGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
      <tr class="muted"><td>SGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
      ${ctx.totals.discount ? `<tr class="muted"><td>Discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
      <tr class="grand"><td>Grand Total (incl. 5% GST)</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
      <tr class="muted"><td>Amount received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
      <tr class="due"><td>Balance due</td><td class="r">${formatCurrency(ctx.totals.balance)}</td></tr>
    </table>
  </div>

  <section class="pay-note">
    <div>
      ${ctx.payment ? `
      <div class="label">Payment Details</div>
      <table class="kv">
        <tr><th>Mode</th><td>${e((ctx.payment.method || '').toUpperCase() || '—')}</td></tr>
        ${ctx.payment.reference ? `<tr><th>Reference</th><td>${e(ctx.payment.reference)}</td></tr>` : ''}
        ${ctx.payment.paidOn ? `<tr><th>Received on</th><td>${formatDate(ctx.payment.paidOn)}</td></tr>` : ''}
      </table>` : ''}
    </div>
    <div>
      ${ctx.notes ? `
      <div class="label">Remarks</div>
      <div class="party-meta">${e(ctx.notes)}</div>` : ''}
    </div>
  </section>

  <section class="terms">
    <div class="label">Terms &amp; Conditions</div>
    <ol>
      <li>This is a GST tax invoice. GST charged at 5% (CGST 2.5% + SGST 2.5%) as applicable to hotel accommodation and allied services.</li>
      <li>${ctx.type === 'banquet'
        ? 'Banquet bookings are confirmed against advance payment; the balance is payable on or before the event date.'
        : 'Check-out time is 12:00 noon. Late check-out is subject to availability and additional charges.'}</li>
      <li>Any discrepancy in this invoice must be reported to the front desk within 7 days of the invoice date.</li>
      <li>All disputes are subject to the jurisdiction of Munger, Bihar.</li>
    </ol>
  </section>

  <div class="sig-row">
    <div class="sig">
      <div class="for">&nbsp;</div>
      <div class="line">Guest Signature</div>
    </div>
    <div class="sig">
      <div class="for">For ${e(ctx.hotel.name)}</div>
      <div class="line">Authorised Signatory</div>
    </div>
  </div>

  <div class="footnote">
    This is a computer-generated invoice issued by ${e(ctx.hotel.name)}. Thank you for your patronage — we look forward to welcoming you again.
  </div>

</div>
</body>
</html>`;
