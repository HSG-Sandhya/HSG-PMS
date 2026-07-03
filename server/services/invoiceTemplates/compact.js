import { escapeHtml as e, formatCurrency, formatDate, amountInWords } from './formatters.js';

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
      <dt>Room</dt><dd>${e(ctx.stay.roomNumber || '—')}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</dd>
      <dt>Stay</dt><dd>${formatDate(ctx.stay.checkIn)} → ${formatDate(ctx.stay.checkOut)} (${e(ctx.stay.nights)}n)</dd>
      <dt>Guests</dt><dd>${e(ctx.stay.adults)}A${ctx.stay.children ? ` · ${ctx.stay.children}C` : ''}</dd>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      <dt>Hall</dt><dd>${e(ctx.event.hallName || '—')}</dd>
      <dt>Date</dt><dd>${formatDate(ctx.event.date)}${ctx.event.startTime ? ` · ${e(ctx.event.startTime)}${ctx.event.endTime ? `–${e(ctx.event.endTime)}` : ''}` : ''}</dd>
      ${ctx.event.guests ? `<dt>Guests</dt><dd>${e(ctx.event.guests)}</dd>` : ''}
      ${ctx.event.type ? `<dt>Type</dt><dd>${e(ctx.event.type)}</dd>` : ''}`;
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
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #111827; margin: 0; background: #fff; font-size: 12px; }
  .page { max-width: 760px; margin: 0 auto; padding: 32px 40px; }

  header { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 18px; padding-bottom: 16px; border-bottom: 2px solid #111827; margin-bottom: 18px; }
  .hotel-block { display: flex; gap: 12px; align-items: flex-start; }
  .hotel-logo { width: 44px; height: 44px; object-fit: contain; border-radius: 6px; flex-shrink: 0; }
  .hotel-name { font-size: 15px; font-weight: 700; line-height: 1.2; }
  .hotel-meta { font-size: 10px; color: #4b5563; line-height: 1.5; margin-top: 4px; }
  .info-col { font-size: 11px; line-height: 1.6; }
  .info-col .info-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
  .info-col .primary { font-weight: 600; color: #111827; font-size: 13px; margin-bottom: 4px; }
  .info-col .meta { color: #4b5563; }
  .info-col.right { text-align: right; }
  .invoice-num { font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 700; }

  .meta-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-bottom: 18px; padding: 12px 16px; background: #f3f4f6; border-radius: 4px; }
  .meta-strip > div h4 { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; font-weight: 600; }
  .meta-strip dl { margin: 0; display: grid; grid-template-columns: 60px 1fr; gap: 3px 8px; font-size: 11px; }
  .meta-strip dt { color: #6b7280; font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
  .meta-strip dd { margin: 0; color: #111827; font-weight: 500; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #111827; color: #f9fafb; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; padding: 8px 10px; text-align: left; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 12px; }
  .item-name { font-weight: 600; }
  .item-detail { color: #6b7280; font-size: 10px; margin-top: 2px; }

  .footer-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; align-items: start; }
  .footer-grid .words { font-size: 11px; color: #4b5563; padding: 10px 12px; background: #f3f4f6; border-left: 3px solid #111827; }
  .footer-grid .words .label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; font-weight: 600; }
  .footer-grid .words strong { color: #111827; font-weight: 600; }

  .totals table { width: 100%; }
  .totals td { padding: 5px 0; font-size: 12px; border: none; }
  .totals .label { color: #6b7280; font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; }
  .totals .value { text-align: right; color: #111827; font-weight: 500; font-family: 'IBM Plex Mono', monospace; }
  .totals .grand { border-top: 2px solid #111827; padding-top: 8px; font-size: 16px; font-weight: 700; }
  .totals .balance .value { color: #b45309; font-weight: 700; }
  .totals .balance.paid .value { color: #047857; }

  footer.bottom { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.1em; }
  .stamp { display: inline-block; padding: 3px 10px; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; border: 1px solid currentColor; }
  .stamp.paid { color: #047857; background: #d1fae5; border-color: #047857; }
  .stamp.partial { color: #92400e; background: #fef3c7; border-color: #92400e; }
  .stamp.unpaid { color: #991b1b; background: #fee2e2; border-color: #991b1b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 18px; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <div class="hotel-block">
        ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="logo" />` : ''}
        <div>
          <div class="hotel-name">${e(ctx.hotel.name)}</div>
          <div class="hotel-meta">
            ${e(ctx.hotel.address)}<br />
            ${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}
            ${ctx.hotel.gstin ? `<br />GSTIN ${e(ctx.hotel.gstin)}` : ''}
          </div>
        </div>
      </div>
      <div class="info-col">
        <div class="info-label">Billed to</div>
        <div class="primary">${e(ctx.customer.name)}</div>
        <div class="meta">
          ${ctx.customer.phone ? `${e(ctx.customer.phone)}<br />` : ''}
          ${ctx.customer.email ? `${e(ctx.customer.email)}<br />` : ''}
          ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      <div class="info-col right">
        <div class="info-label">Tax invoice</div>
        <div class="invoice-num">${e(ctx.invoice.number)}</div>
        <div class="meta" style="margin-top:6px">
          Issued ${formatDate(ctx.invoice.issuedOn)}<br />
          Due ${formatDate(ctx.invoice.dueOn)}
        </div>
        <div style="margin-top:6px"><span class="stamp ${e(ctx.totals.status)}">${e(ctx.totals.status)}</span></div>
      </div>
    </header>

    <div class="meta-strip">
      <div>
        <h4>${ctx.type === 'banquet' ? 'Event' : 'Stay'}</h4>
        <dl>${stayOrEvent(ctx)}</dl>
      </div>
      <div>
        <h4>Payment</h4>
        <dl>
          <dt>Method</dt><dd>${ctx.payment ? e(ctx.payment.method) : '—'}</dd>
          ${ctx.payment?.reference ? `<dt>Ref</dt><dd>${e(ctx.payment.reference)}</dd>` : ''}
          ${ctx.payment?.paidOn ? `<dt>Paid</dt><dd>${formatDate(ctx.payment.paidOn)}</dd>` : ''}
        </dl>
      </div>
      <div>
        <h4>Tax</h4>
        <dl>
          <dt>GSTIN</dt><dd>${e(ctx.hotel.gstin || '—')}</dd>
          <dt>CGST</dt><dd>2.5%</dd>
          <dt>SGST</dt><dd>2.5%</dd>
        </dl>
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

    <div class="footer-grid">
      <div class="words">
        <div class="label">Amount in words</div>
        <strong>${e(amountInWords(ctx.totals.total))}</strong>
        ${ctx.notes ? `<div style="margin-top:10px;color:#374151">${e(ctx.notes)}</div>` : ''}
      </div>
      <div class="totals">
        <table>
          <tr><td class="label">Subtotal</td><td class="value">${formatCurrency(ctx.totals.subtotal)}</td></tr>
          <tr><td class="label">CGST</td><td class="value">${formatCurrency(ctx.totals.cgst)}</td></tr>
          <tr><td class="label">SGST</td><td class="value">${formatCurrency(ctx.totals.sgst)}</td></tr>
          ${ctx.totals.discount ? `<tr><td class="label">Discount</td><td class="value">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
          <tr class="grand"><td class="label">Total</td><td class="value">${formatCurrency(ctx.totals.total)}</td></tr>
          <tr><td class="label">Paid</td><td class="value">${formatCurrency(ctx.totals.paid)}</td></tr>
          <tr class="balance ${ctx.totals.balance <= 0 ? 'paid' : ''}"><td class="label">Balance</td><td class="value">${formatCurrency(ctx.totals.balance)}</td></tr>
        </table>
      </div>
    </div>

    <footer class="bottom">
      <span>${e(ctx.hotel.name)}${ctx.hotel.gstin ? ` · GSTIN ${e(ctx.hotel.gstin)}` : ''}</span>
      <span>Thank you · ${formatDate(ctx.invoice.issuedOn)}</span>
    </footer>
  </div>
</body>
</html>`;

export const meta = {
  id: 'compact',
  name: 'Compact',
  description: 'Dense single-page layout with monospaced numbers — best for everyday printing.',
};
