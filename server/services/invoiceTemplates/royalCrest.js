import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Royal Crest ──────────────────────────────────────────────────────────────
// Stately serif document: centred masthead between double gold rules, framed
// page, classical small-caps headings. Full GST annexure, words, terms and
// signatory block. For hotels that want the invoice to feel like letterpress.

export const meta = {
  id: 'royal-crest',
  name: 'Royal Crest',
  description:
    'Stately centred serif masthead with gold double rules — framed, letterpress-style tax invoice with the full 5% GST annexure.',
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
      <tr><th>Event date</th><td>${formatDate(ctx.event.date)}</td></tr>
      ${ctx.event.startTime ? `<tr><th>Timing</th><td>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</td></tr>` : ''}
      ${ctx.event.guests ? `<tr><th>Guests</th><td>${e(ctx.event.guests)} persons</td></tr>` : ''}`;
  }
  return '';
};

const items = (list) => list.map((item, i) => `
  <tr>
    <td class="c">${i + 1}</td>
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
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a2418; margin: 0; background: #fff; font-size: 12.5px; line-height: 1.55; }
  .page { max-width: 800px; margin: 0 auto; padding: 32px 36px; }
  .frame { border: 1px solid #b08d3e; outline: 4px solid #fff; box-shadow: 0 0 0 5px #b08d3e22; padding: 34px 38px; }
  .rule { height: 0; border-top: 2px solid #b08d3e; border-bottom: 1px solid #b08d3e; padding-top: 2px; margin: 14px 0; }
  .masthead { text-align: center; }
  .hotel-logo { max-height: 54px; margin-bottom: 8px; }
  .hotel-name { font-size: 26px; font-weight: 700; letter-spacing: 0.05em; }
  .hotel-meta { font-size: 11px; color: #6d6352; margin-top: 5px; line-height: 1.8; }
  .reg { font-size: 10.5px; color: #6d6352; letter-spacing: 0.06em; margin-top: 3px; }
  .doc { text-align: center; font-variant: small-caps; letter-spacing: 0.4em; font-size: 15px; margin: 16px 0 4px; }
  .meta-row { display: flex; justify-content: center; gap: 34px; font-size: 11.5px; color: #4d4536; margin-bottom: 22px; }
  .meta-row b { color: #2a2418; }
  .badge { border: 1px solid #b08d3e; color: #7d6325; padding: 1px 10px; font-size: 10px; letter-spacing: 0.18em; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 22px; }
  .label { font-variant: small-caps; letter-spacing: 0.22em; font-size: 11px; color: #8a7a55; border-bottom: 1px solid #e4dcc8; padding-bottom: 4px; margin-bottom: 8px; }
  .pname { font-size: 15px; font-weight: 700; }
  .pmeta { font-size: 11.5px; color: #5d5343; line-height: 1.75; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.kv th { text-align: left; font-weight: 400; color: #8a7a55; width: 92px; padding: 2.5px 0; vertical-align: top; font-style: italic; }
  table.kv td { padding: 2.5px 0; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.items thead th { font-variant: small-caps; letter-spacing: 0.12em; font-size: 11px; color: #2a2418; border-top: 2px solid #b08d3e; border-bottom: 1px solid #b08d3e; padding: 9px 8px; text-align: left; font-weight: 600; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 10px 8px; border-bottom: 1px dotted #d8cfb8; vertical-align: top; }
  .nm { font-weight: 700; }
  .dt { font-size: 10.5px; color: #8a7a55; font-style: italic; margin-top: 2px; }
  .tot-wrap { display: flex; justify-content: space-between; gap: 28px; margin-bottom: 20px; }
  .words { flex: 1; font-size: 11px; color: #6d6352; padding-top: 8px; }
  .words b { display: block; color: #2a2418; font-style: italic; margin-top: 4px; font-size: 12px; }
  table.tot { width: 300px; border-collapse: collapse; font-size: 12px; }
  table.tot td { padding: 4.5px 0; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.tot .mut td { color: #6d6352; font-size: 11.5px; }
  table.tot .grand td { border-top: 2px solid #b08d3e; border-bottom: 2px solid #b08d3e; padding: 9px 0; font-size: 14.5px; font-weight: 700; }
  .pay-terms { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 8px; }
  ol.terms { margin: 4px 0 0; padding-left: 16px; font-size: 10px; color: #7d7361; line-height: 1.8; }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 44px; }
  .sig { width: 220px; text-align: center; font-size: 10.5px; color: #5d5343; }
  .sig .for { font-size: 10px; color: #8a7a55; margin-bottom: 28px; }
  .sig .line { border-top: 1px solid #2a2418; padding-top: 6px; }
  .foot { text-align: center; font-size: 9.5px; color: #9a8d72; margin-top: 24px; font-style: italic; }
  @media print { .page { padding: 14px 18px; } body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page"><div class="frame">

  <div class="masthead">
    ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
    <div class="hotel-name">${e(ctx.hotel.name)}</div>
    <div class="hotel-meta">
      ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
      ${[ctx.hotel.phone && `Tel: ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
    </div>
    <div class="reg">${[ctx.hotel.gstin && `GSTIN ${e(ctx.hotel.gstin)}`, ctx.hotel.panNumber && `PAN ${e(ctx.hotel.panNumber)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
  </div>

  <div class="rule"></div>
  <div class="doc">Tax Invoice</div>
  <div class="meta-row">
    <span>No. <b>${e(ctx.invoice.number)}</b></span>
    <span>Dated <b>${formatLongDate(ctx.invoice.issuedOn)}</b></span>
    <span class="badge">${ctx.totals.status === 'paid' ? 'PAID' : ctx.totals.status === 'partial' ? 'PART PAID' : 'DUE'}</span>
  </div>

  <div class="cols">
    <div>
      <div class="label">Billed To</div>
      <div class="pname">${e(ctx.customer.name)}</div>
      <div class="pmeta">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${ctx.customer.phone ? `Tel: ${e(ctx.customer.phone)}<br/>` : ''}
        ${ctx.customer.email ? `${e(ctx.customer.email)}<br/>` : ''}
        ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div>
      <div class="label">${ctx.type === 'banquet' ? 'Event Particulars' : 'Stay Particulars'}</div>
      <table class="kv">${stayRows(ctx)}</table>
    </div>
  </div>

  <table class="items">
    <thead><tr>
      <th class="c" style="width:34px">No.</th><th>Description of Services</th>
      <th class="c" style="width:78px">HSN/SAC</th><th class="r" style="width:46px">Qty</th>
      <th class="r" style="width:96px">Rate</th><th class="r" style="width:108px">Amount</th>
    </tr></thead>
    <tbody>${items(ctx.items)}</tbody>
  </table>

  <div class="tot-wrap">
    <div class="words">Amount chargeable, in words —
      <b>${e(amountInWords(ctx.totals.total))}</b>
    </div>
    <table class="tot">
      <tr class="mut"><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
      <tr class="mut"><td>CGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
      <tr class="mut"><td>SGST @ 2.5%</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
      ${ctx.totals.discount ? `<tr class="mut"><td>Less: discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
      <tr class="grand"><td>Grand Total</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
      <tr class="mut"><td>Received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
      <tr><td><b>Balance due</b></td><td class="r"><b>${formatCurrency(ctx.totals.balance)}</b></td></tr>
    </table>
  </div>

  <div class="pay-terms">
    <div>
      ${ctx.payment ? `
      <div class="label">Payment</div>
      <table class="kv">
        <tr><th>Mode</th><td>${e((ctx.payment.method || '').toUpperCase() || '—')}</td></tr>
        ${ctx.payment.reference ? `<tr><th>Reference</th><td>${e(ctx.payment.reference)}</td></tr>` : ''}
        ${ctx.payment.paidOn ? `<tr><th>Received</th><td>${formatDate(ctx.payment.paidOn)}</td></tr>` : ''}
      </table>` : ''}
      ${ctx.notes ? `<div class="label" style="margin-top:12px">Remarks</div><div class="pmeta">${e(ctx.notes)}</div>` : ''}
    </div>
    <div>
      <div class="label">Terms &amp; Conditions</div>
      <ol class="terms">
        <li>GST levied at 5% (CGST 2.5% + SGST 2.5%) on hotel accommodation and allied services.</li>
        <li>${ctx.type === 'banquet' ? 'Balance for banquet bookings is payable on or before the event date.' : 'Check-out time is 12:00 noon; late departure attracts charges.'}</li>
        <li>Discrepancies must be reported within 7 days of the invoice date.</li>
        <li>Subject to Munger jurisdiction.</li>
      </ol>
    </div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
    <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
  </div>

  <div class="foot">A computer-generated tax invoice — it has been a privilege to host you.</div>

</div></div>
</body>
</html>`;
