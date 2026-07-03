import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Boutique Sand ────────────────────────────────────────────────────────────
// Warm boutique-hotel aesthetic: cream panels, soft rounded cards, a gracious
// tone of voice — while keeping every formal element: GST split, words,
// payment summary, terms and signatures.

export const meta = {
  id: 'boutique-sand',
  name: 'Boutique Sand',
  description:
    'Warm boutique aesthetic — cream panels and rounded cards with the complete formal tax detail and 5% GST split.',
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<div class="kv"><span>Room</span><b>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` — ${e(ctx.stay.roomType)}` : ''}</b></div>` : ''}
      <div class="kv"><span>Arrival</span><b>${formatDate(ctx.stay.checkIn)}</b></div>
      <div class="kv"><span>Departure</span><b>${formatDate(ctx.stay.checkOut)}</b></div>
      <div class="kv"><span>Nights</span><b>${e(ctx.stay.nights)}</b></div>
      <div class="kv"><span>Guests</span><b>${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? `, ${e(ctx.stay.children)} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</b></div>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      ${ctx.event.hallName ? `<div class="kv"><span>Venue</span><b>${e(ctx.event.hallName)}</b></div>` : ''}
      ${ctx.event.type ? `<div class="kv"><span>Occasion</span><b>${e(ctx.event.type)}</b></div>` : ''}
      <div class="kv"><span>Date</span><b>${formatDate(ctx.event.date)}</b></div>
      ${ctx.event.startTime ? `<div class="kv"><span>Timing</span><b>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</b></div>` : ''}
      ${ctx.event.guests ? `<div class="kv"><span>Guests</span><b>${e(ctx.event.guests)} persons</b></div>` : ''}`;
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #3d3428; margin: 0; background: #faf6ef; font-size: 12px; line-height: 1.55; }
  .page { max-width: 800px; margin: 0 auto; padding: 34px 36px; }
  .card { background: #fff; border: 1px solid #eadfcd; border-radius: 14px; padding: 16px 20px; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 18px; }
  .hgroup { display: flex; align-items: center; gap: 14px; }
  .hotel-logo { max-height: 52px; border-radius: 10px; }
  .hname { font-family: Georgia, 'Times New Roman', serif; font-size: 21px; font-weight: 700; color: #4a3c28; }
  .hmeta { font-size: 10.5px; color: #97876d; line-height: 1.7; margin-top: 3px; }
  .docbox { text-align: right; }
  .docbox .t { font-size: 10px; letter-spacing: 0.34em; color: #b09a72; }
  .docbox .no { font-size: 15px; font-weight: 700; color: #4a3c28; margin-top: 3px; }
  .docbox .d { font-size: 10.5px; color: #97876d; margin-top: 2px; }
  .badge { display: inline-block; margin-top: 6px; background: #f3ead9; color: #8a703f; border-radius: 999px; padding: 3px 12px; font-size: 9px; letter-spacing: 0.16em; }
  .reg { font-size: 10px; color: #97876d; margin: 0 2px 16px; }
  .reg b { color: #4a3c28; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .label { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #b09a72; margin-bottom: 8px; }
  .pname { font-size: 14px; font-weight: 700; color: #4a3c28; }
  .pmeta { font-size: 11px; color: #97876d; line-height: 1.7; margin-top: 3px; }
  .kv { display: flex; justify-content: space-between; font-size: 11.5px; padding: 2.5px 0; }
  .kv span { color: #b09a72; }
  .kv b { color: #4a3c28; font-weight: 600; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #b09a72; text-align: left; padding: 8px 10px; border-bottom: 1.5px solid #eadfcd; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #f3ead9; vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: none; }
  .nm { font-weight: 600; color: #4a3c28; }
  .dt { font-size: 10.5px; color: #b09a72; margin-top: 2px; }
  .bottom { display: flex; gap: 16px; margin: 16px 0; }
  .words { flex: 1; }
  .words .in { font-size: 10.5px; color: #97876d; }
  .words b { display: block; color: #4a3c28; margin-top: 5px; font-size: 11.5px; font-style: italic; }
  .tot { width: 300px; }
  .trow { display: flex; justify-content: space-between; font-size: 11.5px; color: #97876d; padding: 3.5px 0; }
  .trow b { color: #4a3c28; }
  .trow.grand { background: #f8f1e4; margin: 7px -10px 0; padding: 9px 10px; border-radius: 9px; font-size: 13.5px; font-weight: 700; color: #4a3c28; }
  .trow.bal { font-weight: 700; color: #4a3c28; margin-top: 4px; }
  .meta2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 10.5px; color: #97876d; line-height: 1.8; }
  .sigs { display: flex; justify-content: space-between; gap: 30px; margin: 30px 4px 0; }
  .sig { width: 210px; text-align: center; font-size: 10.5px; color: #97876d; }
  .sig .line { border-top: 1px solid #4a3c28; padding-top: 6px; }
  .sig .for { font-size: 9.5px; margin-bottom: 26px; }
  .foot { text-align: center; font-size: 10px; color: #b09a72; margin-top: 22px; font-style: italic; }
  @media print { body { background: #fff; -webkit-print-color-adjust: exact; } .page { padding: 14px 18px; } }
</style>
</head>
<body>
<div class="page">

  <div class="head">
    <div class="hgroup">
      ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
      <div>
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">
          ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
          ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
    <div class="docbox">
      <div class="t">TAX INVOICE</div>
      <div class="no">${e(ctx.invoice.number)}</div>
      <div class="d">${formatLongDate(ctx.invoice.issuedOn)}</div>
      <span class="badge">${ctx.totals.status === 'paid' ? 'PAID WITH THANKS' : ctx.totals.status === 'partial' ? 'PARTIALLY PAID' : 'BALANCE DUE'}</span>
    </div>
  </div>

  <div class="reg">${[ctx.hotel.gstin && `GSTIN <b>${e(ctx.hotel.gstin)}</b>`, ctx.hotel.panNumber && `PAN <b>${e(ctx.hotel.panNumber)}</b>`, `SAC <b>${ctx.type === 'banquet' ? '997212' : '996311'}</b>`, `GST <b>5% (CGST 2.5% + SGST 2.5%)</b>`].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>

  <div class="grid2">
    <div class="card">
      <div class="label">Our Guest</div>
      <div class="pname">${e(ctx.customer.name)}</div>
      <div class="pmeta">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${[ctx.customer.phone && `Tel ${e(ctx.customer.phone)}`, ctx.customer.email && e(ctx.customer.email)].filter(Boolean).join(' · ')}
        ${ctx.customer.gstin ? `<br/>GSTIN ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div class="card">
      <div class="label">${ctx.type === 'banquet' ? 'The Occasion' : 'The Stay'}</div>
      ${stayRows(ctx)}
    </div>
  </div>

  <div class="card" style="padding: 6px 10px 10px">
    <table class="items">
      <thead><tr>
        <th class="c" style="width:34px">#</th><th>Particulars</th>
        <th class="c" style="width:76px">HSN/SAC</th><th class="r" style="width:44px">Qty</th>
        <th class="r" style="width:92px">Rate</th><th class="r" style="width:104px">Amount</th>
      </tr></thead>
      <tbody>${items(ctx.items)}</tbody>
    </table>
  </div>

  <div class="bottom">
    <div class="card words">
      <div class="in">Amount chargeable, in words</div>
      <b>${e(amountInWords(ctx.totals.total))}</b>
      ${ctx.payment ? `<div class="in" style="margin-top:10px">Payment — ${e((ctx.payment.method || '').toUpperCase())}${ctx.payment.reference ? ` · Ref ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · ${formatDate(ctx.payment.paidOn)}` : ''}</div>` : ''}
      ${ctx.notes ? `<div class="in" style="margin-top:6px">Remarks — ${e(ctx.notes)}</div>` : ''}
    </div>
    <div class="card tot">
      <div class="trow"><span>Taxable value</span><b>${formatCurrency(ctx.totals.subtotal)}</b></div>
      <div class="trow"><span>CGST @ 2.5%</span><b>${formatCurrency(ctx.totals.cgst)}</b></div>
      <div class="trow"><span>SGST @ 2.5%</span><b>${formatCurrency(ctx.totals.sgst)}</b></div>
      ${ctx.totals.discount ? `<div class="trow"><span>Discount</span><b>− ${formatCurrency(ctx.totals.discount)}</b></div>` : ''}
      <div class="trow grand"><span>Grand Total</span><span>${formatCurrency(ctx.totals.total)}</span></div>
      <div class="trow"><span>Received</span><b>${formatCurrency(ctx.totals.paid)}</b></div>
      <div class="trow bal"><span>Balance due</span><span>${formatCurrency(ctx.totals.balance)}</span></div>
    </div>
  </div>

  <div class="card meta2" style="display:grid">
    <div>
      <div class="label">House Notes</div>
      ${ctx.type === 'banquet'
        ? 'Banquet bookings are confirmed against advance payment; the balance is payable on or before the event date.'
        : 'Check-out time is 12:00 noon. Late departures are subject to availability and applicable charges.'}
    </div>
    <div>
      <div class="label">Terms</div>
      GST charged at 5% as applicable. Kindly report any discrepancy within 7 days of the invoice date. All disputes subject to Munger jurisdiction.
    </div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
    <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
  </div>

  <div class="foot">A computer-generated invoice — it was a pleasure hosting you, and we hope to see you again soon.</div>

</div>
</body>
</html>`;
