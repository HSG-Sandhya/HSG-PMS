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
      <div class="info-block">
        <div class="info-label">Stay</div>
        <div class="info-primary">${e(ctx.stay.roomNumber || 'Accommodation')}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</div>
        <div class="info-secondary">
          ${formatDate(ctx.stay.checkIn)} → ${formatDate(ctx.stay.checkOut)}<br />
          ${e(ctx.stay.nights)} night${ctx.stay.nights > 1 ? 's' : ''} · ${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? ` · ${ctx.stay.children} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}
        </div>
      </div>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      <div class="info-block">
        <div class="info-label">Event</div>
        <div class="info-primary">${e(ctx.event.hallName || 'Banquet booking')}${ctx.event.type ? ` · ${e(ctx.event.type)}` : ''}</div>
        <div class="info-secondary">
          ${formatDate(ctx.event.date)}${ctx.event.startTime ? ` · ${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}` : ''}
          ${ctx.event.guests ? `<br />${e(ctx.event.guests)} guests` : ''}
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 0; background: #fff; }
  .page { max-width: 840px; margin: 0 auto; padding: 56px 64px; }
  .ribbon { height: 6px; background: linear-gradient(90deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%); border-radius: 6px; margin-bottom: 36px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 36px; }
  .hotel { display: flex; gap: 18px; align-items: center; }
  .hotel-logo { width: 64px; height: 64px; border-radius: 14px; background: #f1f5f9; padding: 6px; object-fit: contain; }
  .hotel-name { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
  .hotel-meta { font-size: 12px; color: #64748b; line-height: 1.6; }
  .invoice-id { text-align: right; }
  .invoice-id .small { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .invoice-id .num { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-top: 4px; }
  .invoice-id .dates { font-size: 12px; color: #475569; margin-top: 6px; }

  .summary { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 18px; margin-bottom: 32px; }
  .summary > div { padding: 18px 20px; background: #f8fafc; border-radius: 16px; }
  .info-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 8px; }
  .info-primary { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
  .info-secondary { font-size: 12px; color: #475569; line-height: 1.6; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; }
  thead th { background: #0f172a; color: #fff; text-align: left; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; padding: 12px 14px; }
  thead th:first-child { border-radius: 12px 0 0 12px; }
  thead th:last-child { border-radius: 0 12px 12px 0; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 16px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
  tbody tr:last-child td { border-bottom: none; }
  .item-name { font-weight: 600; }
  .item-detail { color: #64748b; font-size: 12px; margin-top: 2px; }

  .totals-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 24px; margin-bottom: 32px; }
  .notes { background: #fef3c7; border-radius: 14px; padding: 18px 20px; font-size: 12px; color: #78350f; line-height: 1.7; }
  .notes-title { font-weight: 700; color: #92400e; margin-bottom: 8px; }
  .totals { background: #0f172a; color: #f1f5f9; border-radius: 16px; padding: 20px 24px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
  .totals .row.divider { border-top: 1px solid #334155; margin-top: 8px; padding-top: 14px; font-size: 18px; font-weight: 700; }
  .totals .row .label { color: #94a3b8; }
  .totals .row.divider .label { color: #f1f5f9; }
  .totals .row.balance .value { color: #fbbf24; font-weight: 700; }
  .totals .row.balance.paid .value { color: #34d399; }

  .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #64748b; }
  .stamp { display: inline-block; padding: 5px 12px; border-radius: 99px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
  .stamp.paid { background: #d1fae5; color: #065f46; }
  .stamp.partial { background: #fef3c7; color: #92400e; }
  .stamp.unpaid { background: #fee2e2; color: #991b1b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 28px; } }
</style>
</head>
<body>
  <div class="page">
    <div class="ribbon"></div>

    <header>
      <div class="hotel">
        ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="logo" />` : ''}
        <div>
          <div class="hotel-name">${e(ctx.hotel.name)}</div>
          <div class="hotel-meta">
            ${e(ctx.hotel.address)}<br />
            ${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}
            ${ctx.hotel.gstin ? `<br />GSTIN ${e(ctx.hotel.gstin)}` : ''}
          </div>
        </div>
      </div>
      <div class="invoice-id">
        <div class="small">Tax invoice</div>
        <div class="num">${e(ctx.invoice.number)}</div>
        <div class="dates">${formatDate(ctx.invoice.issuedOn)} · Due ${formatDate(ctx.invoice.dueOn)}</div>
        <div style="margin-top:8px"><span class="stamp ${e(ctx.totals.status)}">${e(ctx.totals.status)}</span></div>
      </div>
    </header>

    <div class="summary">
      <div>
        <div class="info-label">Billed to</div>
        <div class="info-primary">${e(ctx.customer.name)}</div>
        <div class="info-secondary">
          ${ctx.customer.phone ? `${e(ctx.customer.phone)}<br />` : ''}
          ${ctx.customer.email ? `${e(ctx.customer.email)}<br />` : ''}
          ${ctx.customer.address ? `${e(ctx.customer.address)}<br />` : ''}
          ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      ${stayOrEvent(ctx)}
      <div>
        <div class="info-label">Payment</div>
        <div class="info-primary">${ctx.payment ? e(ctx.payment.method) : 'Pending'}</div>
        <div class="info-secondary">
          ${ctx.payment?.reference ? `Ref ${e(ctx.payment.reference)}<br />` : ''}
          ${ctx.payment?.paidOn ? `Paid on ${formatDate(ctx.payment.paidOn)}` : ''}
        </div>
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

    <div class="totals-wrap">
      <div class="notes">
        <div class="notes-title">Amount in words</div>
        ${e(amountInWords(ctx.totals.total))}
        ${ctx.notes ? `<div style="margin-top:14px;color:#78350f;">${e(ctx.notes)}</div>` : ''}
      </div>
      <div class="totals">
        <div class="row"><span class="label">Subtotal</span><span class="value">${formatCurrency(ctx.totals.subtotal)}</span></div>
        <div class="row"><span class="label">CGST 2.5%</span><span class="value">${formatCurrency(ctx.totals.cgst)}</span></div>
        <div class="row"><span class="label">SGST 2.5%</span><span class="value">${formatCurrency(ctx.totals.sgst)}</span></div>
        ${ctx.totals.discount ? `<div class="row"><span class="label">Discount</span><span class="value">− ${formatCurrency(ctx.totals.discount)}</span></div>` : ''}
        <div class="row divider"><span class="label">Total</span><span class="value">${formatCurrency(ctx.totals.total)}</span></div>
        <div class="row"><span class="label">Paid</span><span class="value">${formatCurrency(ctx.totals.paid)}</span></div>
        <div class="row balance ${ctx.totals.balance <= 0 ? 'paid' : ''}"><span class="label">Balance</span><span class="value">${formatCurrency(ctx.totals.balance)}</span></div>
      </div>
    </div>

    <div class="footer">
      <span>Thank you for choosing ${e(ctx.hotel.name)}.</span>
      <span>${ctx.hotel.website ? e(ctx.hotel.website) : ''}</span>
    </div>
  </div>
</body>
</html>`;

export const meta = {
  id: 'modern',
  name: 'Modern',
  description: 'Contemporary layout with gradient ribbon and dark totals card.',
};
