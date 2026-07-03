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

const stayOrEvent = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      <div class="event-card">
        <div class="event-mark">Stay</div>
        <div class="event-title">${e(ctx.stay.roomNumber || 'Accommodation')}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</div>
        <div class="event-body">
          ${formatLongDate(ctx.stay.checkIn)} – ${formatLongDate(ctx.stay.checkOut)}<br />
          <em>${e(ctx.stay.nights)} night${ctx.stay.nights > 1 ? 's' : ''} · ${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? ` · ${ctx.stay.children} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</em>
        </div>
      </div>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      <div class="event-card">
        <div class="event-mark">Event</div>
        <div class="event-title">${e(ctx.event.hallName || 'Banquet booking')}${ctx.event.type ? ` · ${e(ctx.event.type)}` : ''}</div>
        <div class="event-body">
          ${formatLongDate(ctx.event.date)}${ctx.event.startTime ? ` · <em>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</em>` : ''}
          ${ctx.event.guests ? `<br /><em>${e(ctx.event.guests)} guests</em>` : ''}
        </div>
      </div>`;
  }
  return '';
};

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #2d2419; margin: 0; background: #fbf8f3; }
  .page { max-width: 840px; margin: 32px auto; background: #fffdf8; padding: 56px 64px; border: 1px solid #e8dcc4; box-shadow: 0 4px 24px rgba(116, 89, 47, 0.08); }

  .crest { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #d4af37; }
  .crest .ornament { font-size: 18px; color: #d4af37; letter-spacing: 0.5em; margin-bottom: 6px; }
  .hotel-logo { max-width: 72px; max-height: 72px; margin: 0 auto 10px; display: block; }
  .hotel-name { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 600; letter-spacing: 0.03em; color: #2d2419; }
  .hotel-tag { font-size: 10px; letter-spacing: 0.45em; text-transform: uppercase; color: #b8941e; margin-top: 8px; font-weight: 500; }
  .hotel-meta { font-size: 12px; color: #5c4d35; line-height: 1.7; margin-top: 14px; }

  .invoice-header { text-align: center; margin-bottom: 36px; }
  .invoice-header .label { font-family: 'Cormorant Garamond', serif; font-size: 28px; color: #2d2419; letter-spacing: 0.04em; }
  .invoice-header .label::before, .invoice-header .label::after { content: '◆'; color: #d4af37; margin: 0 18px; font-size: 14px; vertical-align: middle; }
  .invoice-header .number { font-size: 13px; color: #b8941e; letter-spacing: 0.18em; margin-top: 6px; font-weight: 600; }
  .invoice-header .dates { font-size: 12px; color: #5c4d35; margin-top: 6px; }

  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 32px; }
  .meta-section { padding: 22px 24px; background: #fbf8f3; border: 1px solid #e8dcc4; }
  .meta-section h3 { font-family: 'Cormorant Garamond', serif; font-size: 16px; font-weight: 600; color: #2d2419; margin: 0 0 8px; letter-spacing: 0.04em; }
  .meta-section h3::after { content: ''; display: block; width: 24px; height: 1px; background: #d4af37; margin-top: 4px; }
  .meta-section .primary { font-size: 16px; font-weight: 600; color: #2d2419; margin-top: 12px; }
  .meta-section .secondary { font-size: 12px; color: #5c4d35; line-height: 1.7; margin-top: 6px; }
  .event-card .event-mark { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #b8941e; font-weight: 700; }
  .event-card .event-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; margin: 6px 0; }
  .event-card .event-body { font-size: 12px; color: #5c4d35; line-height: 1.7; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { font-family: 'Cormorant Garamond', serif; text-align: left; font-size: 14px; color: #2d2419; padding: 14px 10px; border-top: 1px solid #d4af37; border-bottom: 1px solid #d4af37; font-weight: 600; letter-spacing: 0.04em; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 16px 10px; border-bottom: 1px solid #ece3d0; font-size: 13px; vertical-align: top; color: #2d2419; }
  .item-name { font-weight: 600; }
  .item-detail { color: #8a7349; font-size: 11px; margin-top: 3px; font-style: italic; }

  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals table { width: 360px; }
  .totals td { padding: 8px 0; font-size: 13px; border-bottom: none; color: #5c4d35; }
  .totals td.value { text-align: right; color: #2d2419; font-weight: 500; }
  .totals tr.grand td { border-top: 2px solid #d4af37; padding-top: 14px; font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; color: #2d2419; }
  .totals tr.balance td.value { color: #a16207; font-weight: 700; }
  .totals tr.balance.paid td.value { color: #166534; }

  .words { background: #fbf8f3; padding: 16px 20px; font-size: 12px; color: #5c4d35; margin-bottom: 20px; border-left: 3px solid #d4af37; font-style: italic; }
  .words strong { color: #2d2419; font-style: normal; font-family: 'Cormorant Garamond', serif; font-size: 14px; }

  footer { border-top: 1px solid #d4af37; padding-top: 22px; text-align: center; font-size: 11px; color: #8a7349; letter-spacing: 0.1em; }
  footer .signature { font-family: 'Cormorant Garamond', serif; font-size: 20px; color: #2d2419; letter-spacing: 0.04em; margin-bottom: 6px; }
  .stamp { display: inline-block; padding: 4px 14px; border-radius: 0; border: 1px solid currentColor; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 600; margin-top: 6px; }
  .stamp.paid { color: #166534; }
  .stamp.partial { color: #a16207; }
  .stamp.unpaid { color: #991b1b; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Fill the full A4 sheet (width + height); pin the footer to the bottom.
       The −4px guard avoids a spurious blank second page from rounding. */
    .page { max-width: none; width: 100%; margin: 0; box-shadow: none; border: none; padding: 0; min-height: calc(100vh - 4px); display: flex; flex-direction: column; }
    .page > footer { margin-top: auto; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="crest">
      <div class="ornament">◇ ◆ ◇</div>
      ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="logo" />` : ''}
      <div class="hotel-name">${e(ctx.hotel.name)}</div>
      <div class="hotel-tag">Hospitality of distinction</div>
      <div class="hotel-meta">
        ${e(ctx.hotel.address)}<br />
        ${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}
        ${ctx.hotel.gstin ? `<br />GSTIN ${e(ctx.hotel.gstin)}` : ''}
      </div>
    </div>

    <div class="invoice-header">
      <div class="label">Tax Invoice</div>
      <div class="number">${e(ctx.invoice.number)}</div>
      <div class="dates">Issued ${formatLongDate(ctx.invoice.issuedOn)} · Due ${formatLongDate(ctx.invoice.dueOn)}</div>
      <span class="stamp ${e(ctx.totals.status)}">${e(ctx.totals.status)}</span>
    </div>

    <div class="meta-grid">
      <div class="meta-section">
        <h3>Billed to</h3>
        <div class="primary">${e(ctx.customer.name)}</div>
        <div class="secondary">
          ${ctx.customer.phone ? `${e(ctx.customer.phone)}<br />` : ''}
          ${ctx.customer.email ? `${e(ctx.customer.email)}<br />` : ''}
          ${ctx.customer.address ? `${e(ctx.customer.address)}<br />` : ''}
          ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      <div class="meta-section">
        ${stayOrEvent(ctx)}
      </div>
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
        <tr><td>Subtotal</td><td class="value">${formatCurrency(ctx.totals.subtotal)}</td></tr>
        <tr><td>CGST 2.5%</td><td class="value">${formatCurrency(ctx.totals.cgst)}</td></tr>
        <tr><td>SGST 2.5%</td><td class="value">${formatCurrency(ctx.totals.sgst)}</td></tr>
        ${ctx.totals.discount ? `<tr><td>Discount</td><td class="value">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
        <tr class="grand"><td>Total</td><td class="value">${formatCurrency(ctx.totals.total)}</td></tr>
        <tr><td>Paid</td><td class="value">${formatCurrency(ctx.totals.paid)}</td></tr>
        <tr class="balance ${ctx.totals.balance <= 0 ? 'paid' : ''}"><td>Balance</td><td class="value">${formatCurrency(ctx.totals.balance)}</td></tr>
      </table>
    </div>

    <div class="words">In words: <strong>${e(amountInWords(ctx.totals.total))}</strong></div>

    ${ctx.notes ? `<div class="words" style="font-style:normal;">${e(ctx.notes)}</div>` : ''}

    <footer>
      <div class="signature">— Thank you —</div>
      <div>${e(ctx.hotel.name)} · ${ctx.hotel.gstin ? `GSTIN ${e(ctx.hotel.gstin)}` : ''}</div>
    </footer>
  </div>
</body>
</html>`;

export const meta = {
  id: 'elegant',
  name: 'Elegant',
  description: 'Refined serif design with gold accents — ideal for premium events.',
};
