import { escapeHtml as e, formatCurrency, formatDate, formatLongDate, amountInWords } from './formatters.js';

const renderItems = (items) => items.map((item, idx) => `
  <tr>
    <td class="num idx">${String(idx + 1).padStart(2, '0')}</td>
    <td>
      <div class="item-name">${e(item.description)}</div>
      ${item.detail ? `<div class="item-detail">${e(item.detail)}</div>` : ''}
    </td>
    <td class="num">${e(item.quantity)}</td>
    <td class="num">${formatCurrency(item.rate)}</td>
    <td class="num strong">${formatCurrency(item.amount)}</td>
  </tr>
`).join('');

const stayOrEvent = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      <dt>Room</dt><dd>${e(ctx.stay.roomNumber || '—')}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</dd>
      <dt>Check-in</dt><dd>${formatDate(ctx.stay.checkIn)}</dd>
      <dt>Check-out</dt><dd>${formatDate(ctx.stay.checkOut)}</dd>
      <dt>Stay</dt><dd>${e(ctx.stay.nights)} night${ctx.stay.nights > 1 ? 's' : ''} · ${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? ` · ${ctx.stay.children} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</dd>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      <dt>Hall</dt><dd>${e(ctx.event.hallName || '—')}</dd>
      ${ctx.event.type ? `<dt>Function</dt><dd>${e(ctx.event.type)}</dd>` : ''}
      <dt>Date</dt><dd>${formatDate(ctx.event.date)}</dd>
      ${ctx.event.startTime ? `<dt>Time</dt><dd>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</dd>` : ''}
      ${ctx.event.guests ? `<dt>Guests</dt><dd>${e(ctx.event.guests)}</dd>` : ''}`;
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
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Manrope', system-ui, sans-serif; color: #e2e8f0; margin: 0; background: #f8fafc; }
  .page { max-width: 860px; margin: 32px auto; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25); border-radius: 12px; overflow: hidden; background: #fff; }

  .banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: #f8fafc; padding: 40px 56px; position: relative; }
  .banner::after { content: ''; position: absolute; top: 0; right: 0; width: 220px; height: 100%; background: linear-gradient(135deg, transparent 30%, rgba(245, 158, 11, 0.18) 100%); pointer-events: none; }
  .banner-row { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
  .brand-mark { font-size: 10px; letter-spacing: 0.4em; text-transform: uppercase; color: #f59e0b; font-weight: 700; margin-bottom: 8px; }
  .hotel-name { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .hotel-meta { font-size: 12px; color: #cbd5e1; line-height: 1.7; margin-top: 8px; }
  .hotel-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; padding: 6px; border-radius: 12px; margin-bottom: 10px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .tag { font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase; color: #cbd5e1; font-weight: 600; }
  .invoice-meta .number { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .invoice-meta .date { font-size: 12px; color: #cbd5e1; margin-top: 6px; }

  .body { padding: 40px 56px; color: #1e293b; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
  .meta-grid h3 { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin: 0 0 12px; }
  .meta-grid .customer-name { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .meta-grid .customer-meta { font-size: 12px; color: #475569; line-height: 1.7; }
  .meta-grid dl { display: grid; grid-template-columns: 100px 1fr; gap: 6px 14px; font-size: 12px; }
  .meta-grid dt { color: #94a3b8; font-weight: 500; }
  .meta-grid dd { margin: 0; color: #1e293b; font-weight: 500; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { text-align: left; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; border-bottom: 2px solid #0f172a; font-weight: 700; }
  thead th.num, tbody td.num { text-align: right; }
  tbody td { padding: 16px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; color: #1e293b; }
  tbody td.idx { color: #94a3b8; font-weight: 600; width: 36px; }
  .item-name { font-weight: 600; color: #0f172a; }
  .item-detail { color: #64748b; font-size: 11px; margin-top: 3px; }
  .strong { font-weight: 700; }

  .totals-row { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; }
  .signature { padding: 20px 0; }
  .signature .sig-label { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 50px; }
  .signature .sig-line { border-top: 1px solid #0f172a; padding-top: 8px; font-size: 12px; color: #1e293b; font-weight: 600; }

  .totals { background: #f8fafc; border-radius: 12px; padding: 24px 28px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #475569; }
  .totals .row.divider { border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 16px; font-size: 20px; font-weight: 800; color: #0f172a; }
  .totals .row.balance { padding: 14px 16px; background: #fef3c7; border-radius: 8px; margin-top: 10px; color: #92400e; font-weight: 700; }
  .totals .row.balance.paid { background: #d1fae5; color: #065f46; }

  .words { background: #f8fafc; padding: 14px 18px; font-size: 12px; color: #475569; margin-bottom: 18px; border-radius: 8px; border-left: 4px solid #f59e0b; }
  .words strong { color: #0f172a; }

  footer { background: #0f172a; color: #94a3b8; padding: 18px 56px; display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 0.05em; }
  .stamp { display: inline-block; padding: 5px 14px; border-radius: 99px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
  .stamp.paid { background: #d1fae5; color: #065f46; }
  .stamp.partial { background: #fef3c7; color: #92400e; }
  .stamp.unpaid { background: #fee2e2; color: #991b1b; }
  @media print { body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
</style>
</head>
<body>
  <div class="page">
    <div class="banner">
      <div class="banner-row">
        <div>
          ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="logo" />` : ''}
          <div class="brand-mark">Premium Hospitality · Est. 2019</div>
          <div class="hotel-name">${e(ctx.hotel.name)}</div>
          <div class="hotel-meta">
            ${e(ctx.hotel.address)}<br />
            ${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}
            ${ctx.hotel.gstin ? `<br />GSTIN ${e(ctx.hotel.gstin)}` : ''}
          </div>
        </div>
        <div class="invoice-meta">
          <div class="tag">Tax Invoice</div>
          <div class="number">${e(ctx.invoice.number)}</div>
          <div class="date">Issued ${formatLongDate(ctx.invoice.issuedOn)}</div>
          <div class="date">Due ${formatLongDate(ctx.invoice.dueOn)}</div>
          <div style="margin-top:10px"><span class="stamp ${e(ctx.totals.status)}">${e(ctx.totals.status)}</span></div>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="meta-grid">
        <div>
          <h3>Billed to</h3>
          <div class="customer-name">${e(ctx.customer.name)}</div>
          <div class="customer-meta">
            ${ctx.customer.phone ? `${e(ctx.customer.phone)}<br />` : ''}
            ${ctx.customer.email ? `${e(ctx.customer.email)}<br />` : ''}
            ${ctx.customer.address ? `${e(ctx.customer.address)}<br />` : ''}
            ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
          </div>
        </div>
        <div>
          <h3>${ctx.type === 'banquet' ? 'Event details' : 'Stay details'}</h3>
          <dl>${stayOrEvent(ctx)}</dl>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="num idx">#</th>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Rate</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${renderItems(ctx.items)}</tbody>
      </table>

      <div class="words">In words: <strong>${e(amountInWords(ctx.totals.total))}</strong></div>

      <div class="totals-row">
        <div class="signature">
          <div class="sig-label">Authorised signatory</div>
          <div class="sig-line">${e(ctx.hotel.name)}</div>
        </div>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${formatCurrency(ctx.totals.subtotal)}</span></div>
          <div class="row"><span>CGST 2.5%</span><span>${formatCurrency(ctx.totals.cgst)}</span></div>
          <div class="row"><span>SGST 2.5%</span><span>${formatCurrency(ctx.totals.sgst)}</span></div>
          ${ctx.totals.discount ? `<div class="row"><span>Discount</span><span>− ${formatCurrency(ctx.totals.discount)}</span></div>` : ''}
          <div class="row divider"><span>Grand total</span><span>${formatCurrency(ctx.totals.total)}</span></div>
          <div class="row"><span>Paid</span><span>${formatCurrency(ctx.totals.paid)}</span></div>
          <div class="row balance ${ctx.totals.balance <= 0 ? 'paid' : ''}"><span>Balance due</span><span>${formatCurrency(ctx.totals.balance)}</span></div>
        </div>
      </div>
    </div>

    <footer>
      <span>${ctx.notes ? e(ctx.notes) : 'Thank you for choosing us.'}</span>
      <span>${ctx.hotel.website ? e(ctx.hotel.website) : ''}</span>
    </footer>
  </div>
</body>
</html>`;

export const meta = {
  id: 'executive',
  name: 'Executive',
  description: 'Premium dark banner, gold accents and signature line.',
};
