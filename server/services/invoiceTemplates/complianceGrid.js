import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  amountInWords,
  hsnFor,
  splitItemTax,
} from './formatters.js';

// ── Compliance Grid ──────────────────────────────────────────────────────────
// Dense, fully ruled GST-compliance format in the Tally/accounting tradition:
// every field boxed, per-line taxable value with CGST/SGST split, a tax
// summary band and declaration. For accountants and audits.

export const meta = {
  id: 'compliance-grid',
  name: 'Compliance Grid',
  description:
    'Dense, fully boxed GST-compliance format — per-line taxable value with CGST/SGST split, tax summary band and declaration.',
};

const stayCell = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return [
      ctx.stay.roomNumber && `Room: ${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` (${e(ctx.stay.roomType)})` : ''}`,
      `Check-in: ${formatDate(ctx.stay.checkIn)}`,
      `Check-out: ${formatDate(ctx.stay.checkOut)}`,
      `Nights: ${e(ctx.stay.nights)}`,
      `Pax: ${e(ctx.stay.adults)}A${ctx.stay.children ? `+${e(ctx.stay.children)}C` : ''}`,
    ].filter(Boolean).join('<br/>');
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return [
      ctx.event.hallName && `Venue: ${e(ctx.event.hallName)}`,
      ctx.event.type && `Function: ${e(ctx.event.type)}`,
      `Event date: ${formatDate(ctx.event.date)}`,
      ctx.event.startTime && `Timing: ${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}`,
      ctx.event.guests && `Guests: ${e(ctx.event.guests)}`,
    ].filter(Boolean).join('<br/>');
  }
  return '';
};

const itemRows = (list) => list.map((item, i) => {
  const t = splitItemTax(item);
  return `
  <tr>
    <td class="c">${i + 1}</td>
    <td>${e(item.description)}${item.detail ? `<div class="dt">${e(item.detail)}</div>` : ''}</td>
    <td class="c">${e(hsnFor(item.category))}</td>
    <td class="r">${e(item.quantity)}</td>
    <td class="r">${formatCurrency(item.rate)}</td>
    <td class="r">${formatCurrency(t.taxable)}</td>
    <td class="r">${formatCurrency(t.cgst)}</td>
    <td class="r">${formatCurrency(t.sgst)}</td>
    <td class="r">${formatCurrency(item.amount)}</td>
  </tr>`;
}).join('');

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Tax Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; background: #fff; font-size: 11px; line-height: 1.45; }
  .page { max-width: 840px; margin: 0 auto; padding: 24px; }
  .outer { border: 1.5px solid #111; }
  .row { display: flex; border-bottom: 1px solid #111; }
  .cell { padding: 8px 10px; }
  .b-r { border-right: 1px solid #111; }
  .hd { background: #f2f2f2; font-weight: 700; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; }
  .masthead { display: flex; align-items: center; gap: 14px; }
  .hotel-logo { max-height: 46px; }
  .hname { font-size: 17px; font-weight: 800; }
  .hmeta { font-size: 10px; color: #444; line-height: 1.6; margin-top: 2px; }
  .doc-cell { text-align: center; }
  .doc-cell .t { font-size: 13px; font-weight: 800; letter-spacing: 0.3em; }
  .doc-cell .s { font-size: 9px; color: #555; margin-top: 2px; letter-spacing: 0.08em; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th { background: #f2f2f2; border: 1px solid #111; border-top: none; font-size: 8.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 6px; }
  table.grid td { border: 1px solid #555; border-top: none; padding: 7px 6px; vertical-align: top; font-size: 11px; }
  table.grid td.c, table.grid th.c { text-align: center; }
  table.grid td.r, table.grid th.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.grid td:first-child, table.grid th:first-child { border-left: none; }
  table.grid td:last-child, table.grid th:last-child { border-right: none; }
  .dt { font-size: 9.5px; color: #666; margin-top: 1px; }
  .kv-lab { font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #666; margin-bottom: 3px; font-weight: 700; }
  .strong { font-weight: 700; }
  .sum-table td { font-size: 11px; padding: 5px 10px; }
  .decl { font-size: 9.5px; color: #444; line-height: 1.7; }
  .sig-cell { height: 76px; display: flex; flex-direction: column; justify-content: flex-end; font-size: 10px; color: #444; }
  .foot { text-align: center; font-size: 9px; color: #777; padding: 7px; }
  @media print { .page { padding: 8px; } body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page"><div class="outer">

  <div class="row">
    <div class="cell b-r" style="flex:1.6">
      <div class="masthead">
        ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
        <div>
          <div class="hname">${e(ctx.hotel.name)}</div>
          <div class="hmeta">
            ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
            ${[ctx.hotel.phone && `Tel: ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email)].filter(Boolean).join(' · ')}<br/>
            ${[ctx.hotel.gstin && `GSTIN: ${e(ctx.hotel.gstin)}`, ctx.hotel.panNumber && `PAN: ${e(ctx.hotel.panNumber)}`].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    </div>
    <div class="cell doc-cell" style="flex:1; display:flex; flex-direction:column; justify-content:center;">
      <div class="t">TAX INVOICE</div>
      <div class="s">ORIGINAL FOR RECIPIENT</div>
    </div>
  </div>

  <div class="row">
    <div class="cell b-r" style="flex:1"><div class="kv-lab">Invoice No.</div><div class="strong">${e(ctx.invoice.number)}</div></div>
    <div class="cell b-r" style="flex:1"><div class="kv-lab">Invoice Date</div><div class="strong">${formatDate(ctx.invoice.issuedOn)}</div></div>
    <div class="cell b-r" style="flex:1"><div class="kv-lab">Place of Supply</div><div class="strong">Bihar (10)</div></div>
    <div class="cell b-r" style="flex:1"><div class="kv-lab">Reverse Charge</div><div class="strong">No</div></div>
    <div class="cell" style="flex:1"><div class="kv-lab">Status</div><div class="strong">${ctx.totals.status === 'paid' ? 'PAID' : ctx.totals.status === 'partial' ? 'PART PAID' : 'DUE'}</div></div>
  </div>

  <div class="row">
    <div class="cell b-r" style="flex:1">
      <div class="kv-lab">Billed To</div>
      <div class="strong">${e(ctx.customer.name)}</div>
      <div style="color:#444; line-height:1.6; margin-top:2px">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${ctx.customer.phone ? `Tel: ${e(ctx.customer.phone)}<br/>` : ''}
        ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : 'GSTIN: Unregistered'}
      </div>
    </div>
    <div class="cell" style="flex:1">
      <div class="kv-lab">${ctx.type === 'banquet' ? 'Event Details' : 'Stay Details'}</div>
      <div style="color:#222; line-height:1.7">${stayCell(ctx)}</div>
    </div>
  </div>

  <table class="grid">
    <thead><tr>
      <th class="c" style="width:30px">Sl</th>
      <th>Description of Service</th>
      <th class="c" style="width:64px">HSN/SAC</th>
      <th class="r" style="width:38px">Qty</th>
      <th class="r" style="width:78px">Rate</th>
      <th class="r" style="width:84px">Taxable</th>
      <th class="r" style="width:70px">CGST 2.5%</th>
      <th class="r" style="width:70px">SGST 2.5%</th>
      <th class="r" style="width:90px">Total</th>
    </tr></thead>
    <tbody>${itemRows(ctx.items)}</tbody>
  </table>

  <div class="row">
    <div class="cell b-r" style="flex:1.4">
      <div class="kv-lab">Amount Chargeable (in words)</div>
      <div class="strong" style="font-style:italic">${e(amountInWords(ctx.totals.total))}</div>
      ${ctx.payment ? `<div class="kv-lab" style="margin-top:8px">Payment</div>
      <div>${e((ctx.payment.method || '').toUpperCase())}${ctx.payment.reference ? ` · Ref: ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · ${formatDate(ctx.payment.paidOn)}` : ''}</div>` : ''}
    </div>
    <div style="flex:1">
      <table class="sum-table" style="width:100%; border-collapse:collapse">
        <tr><td>Taxable value</td><td class="r" style="text-align:right">${formatCurrency(ctx.totals.subtotal)}</td></tr>
        <tr><td>CGST @ 2.5%</td><td style="text-align:right">${formatCurrency(ctx.totals.cgst)}</td></tr>
        <tr><td>SGST @ 2.5%</td><td style="text-align:right">${formatCurrency(ctx.totals.sgst)}</td></tr>
        ${ctx.totals.discount ? `<tr><td>Discount</td><td style="text-align:right">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
        <tr style="border-top:1.5px solid #111; border-bottom:1.5px solid #111">
          <td class="strong" style="padding:7px 10px">GRAND TOTAL</td>
          <td class="strong" style="text-align:right; padding:7px 10px">${formatCurrency(ctx.totals.total)}</td>
        </tr>
        <tr><td>Received</td><td style="text-align:right">${formatCurrency(ctx.totals.paid)}</td></tr>
        <tr><td class="strong">Balance due</td><td class="strong" style="text-align:right">${formatCurrency(ctx.totals.balance)}</td></tr>
      </table>
    </div>
  </div>

  <div class="row" style="border-bottom:none">
    <div class="cell b-r" style="flex:1.4">
      <div class="kv-lab">Declaration</div>
      <div class="decl">
        We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.
        GST charged at 5% (CGST 2.5% + SGST 2.5%). ${ctx.type === 'banquet'
          ? 'Banquet balances are payable on or before the event date.'
          : 'Check-out time is 12:00 noon.'}
        Discrepancies must be reported within 7 days. Subject to Munger jurisdiction.
        ${ctx.notes ? `<br/>Remarks: ${e(ctx.notes)}` : ''}
      </div>
    </div>
    <div class="cell" style="flex:1">
      <div class="sig-cell">
        <div style="text-align:right; font-weight:700; color:#111">For ${e(ctx.hotel.name)}</div>
        <div style="text-align:right; margin-top:34px; border-top:1px solid #111; padding-top:5px; display:inline-block; align-self:flex-end">Authorised Signatory</div>
      </div>
    </div>
  </div>

</div>
<div class="foot">This is a computer-generated tax invoice and does not require a physical signature.</div>
</div>
</body>
</html>`;
