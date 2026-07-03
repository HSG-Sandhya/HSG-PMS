import { escapeHtml as e, formatCurrency, formatDate, formatLongDate, amountInWords } from './formatters.js';

const renderItems = (items) => items.map((item) => `
  <tr>
    <td>
      <div class="item-name">${e(item.description)}</div>
      ${item.detail ? `<div class="item-detail">${e(item.detail)}</div>` : ''}
    </td>
    <td class="num">${e(item.quantity)}</td>
    <td class="num">${formatCurrency(item.rate)}</td>
    <td class="num">${formatCurrency(item.amount)}</td>
  </tr>
`).join('');

const stayBlock = (ctx) => {
  if (ctx.type !== 'hotel' || !ctx.stay) return '';
  return `
    <div class="meta-card">
      <div class="meta-title">Stay</div>
      <dl>
        ${ctx.stay.roomNumber ? `<dt>Room</dt><dd>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</dd>` : ''}
        <dt>Check-in</dt><dd>${formatDate(ctx.stay.checkIn)}</dd>
        <dt>Check-out</dt><dd>${formatDate(ctx.stay.checkOut)}</dd>
        <dt>Nights</dt><dd>${e(ctx.stay.nights)}</dd>
        <dt>Guests</dt><dd>${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? ` · ${ctx.stay.children} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</dd>
      </dl>
    </div>`;
};

const eventBlock = (ctx) => {
  if (ctx.type !== 'banquet' || !ctx.event) return '';
  return `
    <div class="meta-card">
      <div class="meta-title">Event</div>
      <dl>
        ${ctx.event.hallName ? `<dt>Hall</dt><dd>${e(ctx.event.hallName)}</dd>` : ''}
        ${ctx.event.type ? `<dt>Function</dt><dd>${e(ctx.event.type)}</dd>` : ''}
        <dt>Date</dt><dd>${formatDate(ctx.event.date)}</dd>
        ${ctx.event.startTime ? `<dt>Time</dt><dd>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</dd>` : ''}
        ${ctx.event.guests ? `<dt>Guests</dt><dd>${e(ctx.event.guests)}</dd>` : ''}
      </dl>
    </div>`;
};

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 48px 56px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 24px; margin-bottom: 32px; }
  .hotel-name { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 6px; }
  .hotel-meta { font-size: 12px; color: #4b5563; line-height: 1.6; }
  .hotel-logo { max-width: 72px; max-height: 72px; margin-bottom: 8px; }
  .invoice-block { text-align: right; }
  .invoice-block .tag { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; }
  .invoice-block .num { font-size: 18px; font-weight: 700; margin: 4px 0 12px; }
  .invoice-block dl { display: grid; grid-template-columns: auto auto; gap: 4px 12px; font-size: 12px; color: #374151; }
  .invoice-block dt { font-weight: 500; color: #6b7280; }
  .invoice-block dd { margin: 0; text-align: right; }
  .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .meta-card { background: #f9fafb; padding: 18px 20px; border-radius: 4px; }
  .meta-title { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; font-weight: 600; }
  .meta-card dl { display: grid; grid-template-columns: 90px 1fr; gap: 6px 12px; font-size: 13px; }
  .meta-card dt { color: #6b7280; }
  .meta-card dd { margin: 0; color: #111827; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { text-align: left; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 10px 8px; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 14px 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; vertical-align: top; }
  .item-name { font-weight: 600; color: #111827; }
  .item-detail { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals table { width: 320px; border: none; }
  .totals td { border: none; padding: 6px 0; font-size: 13px; }
  .totals .label { color: #6b7280; }
  .totals .value { text-align: right; font-weight: 500; color: #111827; }
  .totals .grand { border-top: 2px solid #111; padding-top: 12px; font-size: 16px; font-weight: 700; }
  .totals .grand .label, .totals .grand .value { color: #111827; }
  .totals .balance .value { color: #b45309; font-weight: 700; }
  .totals .balance.paid .value { color: #047857; }
  .words { background: #f9fafb; padding: 14px 18px; font-size: 12px; color: #374151; margin-bottom: 24px; border-radius: 4px; }
  .words strong { color: #111827; }
  footer { border-top: 1px solid #e5e7eb; padding-top: 18px; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
  .stamp { display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
  .stamp.paid { background: #d1fae5; color: #065f46; }
  .stamp.partial { background: #fef3c7; color: #92400e; }
  .stamp.unpaid { background: #fee2e2; color: #991b1b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 24px; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="logo" />` : ''}
        <div class="hotel-name">${e(ctx.hotel.name)}</div>
        <div class="hotel-meta">
          ${e(ctx.hotel.address)}<br />
          ${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}<br />
          ${ctx.hotel.gstin ? `GSTIN: ${e(ctx.hotel.gstin)}` : ''}
        </div>
      </div>
      <div class="invoice-block">
        <div class="tag">Tax Invoice</div>
        <div class="num">${e(ctx.invoice.number)}</div>
        <dl>
          <dt>Issued</dt><dd>${formatLongDate(ctx.invoice.issuedOn)}</dd>
          <dt>Due</dt><dd>${formatLongDate(ctx.invoice.dueOn)}</dd>
          <dt>Status</dt><dd><span class="stamp ${e(ctx.totals.status)}">${e(ctx.totals.status)}</span></dd>
        </dl>
      </div>
    </header>

    <div class="grid">
      <div class="meta-card">
        <div class="meta-title">Billed to</div>
        <div style="font-weight:600;color:#111827;font-size:14px;margin-bottom:6px;">${e(ctx.customer.name)}</div>
        <div style="font-size:12px;color:#4b5563;line-height:1.6;">
          ${ctx.customer.phone ? `${e(ctx.customer.phone)}<br />` : ''}
          ${ctx.customer.email ? `${e(ctx.customer.email)}<br />` : ''}
          ${ctx.customer.address ? `${e(ctx.customer.address)}<br />` : ''}
          ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      ${stayBlock(ctx)}
      ${eventBlock(ctx)}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${renderItems(ctx.items)}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td class="label">Subtotal (excl. GST)</td><td class="value">${formatCurrency(ctx.totals.subtotal)}</td></tr>
        <tr><td class="label">CGST 2.5%</td><td class="value">${formatCurrency(ctx.totals.cgst)}</td></tr>
        <tr><td class="label">SGST 2.5%</td><td class="value">${formatCurrency(ctx.totals.sgst)}</td></tr>
        ${ctx.totals.discount ? `<tr><td class="label">Discount</td><td class="value">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
        <tr class="grand"><td class="label">Total</td><td class="value">${formatCurrency(ctx.totals.total)}</td></tr>
        <tr><td class="label">Paid</td><td class="value">${formatCurrency(ctx.totals.paid)}</td></tr>
        <tr class="balance ${ctx.totals.balance <= 0 ? 'paid' : ''}"><td class="label">Balance due</td><td class="value">${formatCurrency(ctx.totals.balance)}</td></tr>
      </table>
    </div>

    <div class="words">In words: <strong>${e(amountInWords(ctx.totals.total))}</strong></div>

    ${ctx.notes ? `<div class="words" style="margin-bottom:18px;">${e(ctx.notes)}</div>` : ''}

    <footer>
      <span>Thank you for your business.</span>
      <span>${e(ctx.hotel.name)} · ${ctx.hotel.gstin ? `GSTIN ${e(ctx.hotel.gstin)}` : ''}</span>
    </footer>
  </div>
</body>
</html>`;

export const meta = {
  id: 'classic',
  name: 'Classic',
  description: 'Traditional clean layout with strong typographic hierarchy.',
};
