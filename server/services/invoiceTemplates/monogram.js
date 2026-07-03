import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Monogram ─────────────────────────────────────────────────────────────────
// Ultra-minimal hairline design: a large monogram initial as a watermark,
// quiet grey micro-labels, single-pixel rules and lots of air. All the tax
// detail, none of the noise.

export const meta = {
  id: 'monogram',
  name: 'Monogram',
  description:
    'Ultra-minimal hairline layout with a monogram watermark — quiet micro-labels, full 5% GST detail, maximum whitespace.',
};

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
      <tr><th>Date</th><td>${formatDate(ctx.event.date)}</td></tr>
      ${ctx.event.startTime ? `<tr><th>Timing</th><td>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</td></tr>` : ''}
      ${ctx.event.guests ? `<tr><th>Guests</th><td>${e(ctx.event.guests)}</td></tr>` : ''}`;
  }
  return '';
};

const items = (list) => list.map((item, i) => `
  <tr>
    <td class="c">${String(i + 1).padStart(2, '0')}</td>
    <td><div class="nm">${e(item.description)}</div>${item.detail ? `<div class="dt">${e(item.detail)}</div>` : ''}</td>
    <td class="c">${e(hsnFor(item.category))}</td>
    <td class="r">${e(item.quantity)}</td>
    <td class="r">${formatCurrency(item.rate)}</td>
    <td class="r">${formatCurrency(item.amount)}</td>
  </tr>`).join('');

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Tax Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #262626; margin: 0; background: #fff; font-size: 12px; line-height: 1.6; }
  .page { max-width: 780px; margin: 0 auto; padding: 44px 40px; position: relative; }
  .wm { position: absolute; top: 8px; right: 16px; font-family: Georgia, serif; font-size: 200px; line-height: 1; color: #f4f4f4; font-weight: 700; user-select: none; z-index: 0; }
  .inner { position: relative; z-index: 1; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 34px; }
  .hname { font-size: 16px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .hmeta { font-size: 10.5px; color: #8c8c8c; margin-top: 6px; line-height: 1.8; }
  .doc { text-align: right; }
  .doc .t { font-size: 10px; letter-spacing: 0.4em; color: #8c8c8c; }
  .doc .no { font-size: 15px; font-weight: 700; margin-top: 4px; }
  .doc .d { font-size: 10.5px; color: #8c8c8c; margin-top: 2px; }
  .doc .st { display: inline-block; margin-top: 7px; font-size: 9px; letter-spacing: 0.2em; border-bottom: 1px solid #262626; padding-bottom: 2px; }
  .micro { font-size: 8.5px; letter-spacing: 0.24em; text-transform: uppercase; color: #b0b0b0; margin-bottom: 8px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-bottom: 30px; }
  .pname { font-size: 14px; font-weight: 700; }
  .pmeta { font-size: 11px; color: #707070; line-height: 1.8; margin-top: 3px; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.kv th { text-align: left; font-weight: 400; color: #b0b0b0; width: 84px; padding: 2px 0; vertical-align: top; }
  table.kv td { padding: 2px 0; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  table.items thead th { font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #b0b0b0; text-align: left; border-bottom: 1px solid #262626; padding: 0 8px 7px; font-weight: 400; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 12px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .nm { font-weight: 600; }
  .dt { font-size: 10.5px; color: #a0a0a0; margin-top: 2px; }
  .bottom { display: flex; gap: 36px; margin-bottom: 26px; }
  .words { flex: 1; font-size: 10.5px; color: #8c8c8c; padding-top: 6px; }
  .words b { display: block; color: #262626; margin-top: 5px; font-size: 11.5px; font-weight: 600; }
  table.tot { width: 290px; border-collapse: collapse; font-size: 11.5px; }
  table.tot td { padding: 4px 0; color: #707070; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; color: #262626; }
  table.tot .grand td { border-top: 1px solid #262626; padding-top: 9px; font-size: 13.5px; font-weight: 700; color: #262626; }
  table.tot .bal td { font-weight: 600; color: #262626; }
  .meta2 { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; font-size: 10px; color: #8c8c8c; line-height: 1.9; margin-bottom: 6px; }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
  .sig { width: 210px; font-size: 10px; color: #8c8c8c; }
  .sig .line { border-top: 1px solid #262626; padding-top: 6px; }
  .sig .for { font-size: 9.5px; margin-bottom: 30px; }
  .foot { font-size: 9px; color: #c4c4c4; margin-top: 28px; letter-spacing: 0.08em; }
  @media print { .page { padding: 18px 22px; } body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="wm">${e((ctx.hotel.name || 'H').trim().charAt(0))}</div>
  <div class="inner">

    <div class="top">
      <div>
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">
          ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
          ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email)].filter(Boolean).join(' · ')}<br/>
          ${[ctx.hotel.gstin && `GSTIN ${e(ctx.hotel.gstin)}`, ctx.hotel.panNumber && `PAN ${e(ctx.hotel.panNumber)}`, `SAC ${ctx.type === 'banquet' ? '997212' : '996311'}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div class="doc">
        <div class="t">TAX INVOICE</div>
        <div class="no">${e(ctx.invoice.number)}</div>
        <div class="d">${formatLongDate(ctx.invoice.issuedOn)}</div>
        <span class="st">${ctx.totals.status === 'paid' ? 'PAID' : ctx.totals.status === 'partial' ? 'PARTIALLY PAID' : 'BALANCE DUE'}</span>
      </div>
    </div>

    <div class="cols">
      <div>
        <div class="micro">Billed To</div>
        <div class="pname">${e(ctx.customer.name)}</div>
        <div class="pmeta">
          ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
          ${[ctx.customer.phone && `Tel ${e(ctx.customer.phone)}`, ctx.customer.email && e(ctx.customer.email)].filter(Boolean).join(' · ')}
          ${ctx.customer.gstin ? `<br/>GSTIN ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      <div>
        <div class="micro">${ctx.type === 'banquet' ? 'Event' : 'Stay'}</div>
        <table class="kv">${stayRows(ctx)}</table>
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th class="c" style="width:36px">No</th><th>Particulars</th>
        <th class="c" style="width:74px">HSN/SAC</th><th class="r" style="width:42px">Qty</th>
        <th class="r" style="width:90px">Rate</th><th class="r" style="width:104px">Amount</th>
      </tr></thead>
      <tbody>${items(ctx.items)}</tbody>
    </table>

    <div class="bottom">
      <div class="words">AMOUNT IN WORDS
        <b>${e(amountInWords(ctx.totals.total))}</b>
      </div>
      <table class="tot">
        <tr><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
        <tr><td>CGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
        <tr><td>SGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
        ${ctx.totals.discount ? `<tr><td>Discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
        <tr class="grand"><td>Total</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
        <tr><td>Received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
        <tr class="bal"><td>Balance due</td><td class="r">${formatCurrency(ctx.totals.balance)}</td></tr>
      </table>
    </div>

    <div class="meta2">
      <div>
        ${ctx.payment ? `<div class="micro">Payment</div>${e((ctx.payment.method || '').toUpperCase())}${ctx.payment.reference ? ` · Ref ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · ${formatDate(ctx.payment.paidOn)}` : ''}` : ''}
        ${ctx.notes ? `<div class="micro" style="margin-top:10px">Remarks</div>${e(ctx.notes)}` : ''}
      </div>
      <div>
        <div class="micro">Terms</div>
        GST 5% (CGST 2.5% + SGST 2.5%). ${ctx.type === 'banquet'
          ? 'Banquet balance payable on or before the event date.'
          : 'Check-out 12:00 noon.'} Discrepancies within 7 days. Munger jurisdiction.
      </div>
    </div>

    <div class="sigs">
      <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
      <div class="sig" style="text-align:right"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
    </div>

    <div class="foot">COMPUTER-GENERATED INVOICE · ${e(ctx.hotel.name.toUpperCase())}</div>

  </div>
</div>
</body>
</html>`;
