import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Summit Pro ───────────────────────────────────────────────────────────────
// Business-report style: a band header, four summary tiles (taxable / CGST /
// SGST / grand total) above the detailed charge table, then words, payment,
// terms and signatures. Reads like a finance statement.

export const meta = {
  id: 'summit-pro',
  name: 'Summit Pro',
  description:
    'Finance-report style — summary tiles for taxable value, CGST, SGST and grand total above a detailed charge table.',
};

const stayLine = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return [
      ctx.stay.roomNumber && `Room ${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` (${e(ctx.stay.roomType)})` : ''}`,
      `${formatDate(ctx.stay.checkIn)} → ${formatDate(ctx.stay.checkOut)}`,
      `${e(ctx.stay.nights)} night${ctx.stay.nights > 1 ? 's' : ''}`,
      `${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? `, ${e(ctx.stay.children)} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}`,
    ].filter(Boolean).join(' · ');
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return [
      ctx.event.hallName && e(ctx.event.hallName),
      ctx.event.type && e(ctx.event.type),
      formatDate(ctx.event.date),
      ctx.event.startTime && `${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}`,
      ctx.event.guests && `${e(ctx.event.guests)} guests`,
    ].filter(Boolean).join(' · ');
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #18212f; margin: 0; background: #fff; font-size: 12px; line-height: 1.5; }
  .page { max-width: 820px; margin: 0 auto; padding: 30px 36px; }
  .band { background: #18212f; color: #fff; border-radius: 8px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .band .l { display: flex; align-items: center; gap: 14px; }
  .hotel-logo { max-height: 44px; border-radius: 6px; background: #fff; padding: 3px; }
  .hname { font-size: 17px; font-weight: 800; }
  .hmeta { font-size: 10px; color: #9fb0c8; margin-top: 3px; line-height: 1.6; }
  .band .r { text-align: right; }
  .band .doc { font-size: 11px; letter-spacing: 0.3em; color: #9fb0c8; }
  .band .no { font-size: 16px; font-weight: 800; margin-top: 3px; }
  .band .dt2 { font-size: 10.5px; color: #9fb0c8; margin-top: 2px; }
  .reg-strip { display: flex; gap: 22px; font-size: 10.5px; color: #5b6b78; margin: 0 4px 18px; }
  .reg-strip b { color: #18212f; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
  .tile { border: 1px solid #e3e8ef; border-radius: 8px; padding: 12px 14px; }
  .tile .k { font-size: 8.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a98a8; margin-bottom: 5px; }
  .tile .v { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .tile.dark { background: #18212f; border-color: #18212f; color: #fff; }
  .tile.dark .k { color: #9fb0c8; }
  .who { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .card { background: #f7f9fb; border-radius: 8px; padding: 14px 16px; }
  .label { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a98a8; margin-bottom: 7px; }
  .pname { font-size: 14px; font-weight: 700; }
  .pmeta { font-size: 11px; color: #5b6b78; line-height: 1.7; margin-top: 3px; }
  .stayline { font-size: 11.5px; color: #18212f; font-weight: 600; line-height: 1.7; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.items thead th { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a98a8; text-align: left; padding: 8px 10px; border-bottom: 2px solid #18212f; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #eef1f5; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #fafbfd; }
  .nm { font-weight: 600; }
  .dt { font-size: 10.5px; color: #8a98a8; margin-top: 2px; }
  .below { display: flex; gap: 22px; margin-bottom: 20px; }
  .words { flex: 1; font-size: 11px; color: #5b6b78; }
  .words b { display: block; color: #18212f; margin-top: 4px; font-size: 11.5px; }
  .settle { width: 290px; font-size: 11.5px; }
  .srow { display: flex; justify-content: space-between; padding: 3.5px 0; color: #5b6b78; }
  .srow b { color: #18212f; }
  .srow.due { border-top: 2px solid #18212f; margin-top: 6px; padding-top: 8px; font-weight: 800; color: #18212f; font-size: 13px; }
  .meta2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 8px; font-size: 10.5px; color: #5b6b78; line-height: 1.8; }
  .meta2 b { display: block; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a98a8; margin-bottom: 4px; }
  .sigs { display: flex; justify-content: space-between; gap: 30px; margin-top: 36px; }
  .sig { width: 210px; text-align: center; font-size: 10.5px; color: #5b6b78; }
  .sig .line { border-top: 1px solid #18212f; padding-top: 6px; }
  .sig .for { font-size: 9.5px; color: #8a98a8; margin-bottom: 26px; }
  .foot { text-align: center; font-size: 9.5px; color: #aebac6; margin-top: 22px; }
  @media print { .page { padding: 14px 18px; } body, .band, .tile.dark { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">

  <div class="band">
    <div class="l">
      ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
      <div>
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">${[ctx.hotel.address, ctx.hotel.phone && `Tel: ${ctx.hotel.phone}`].filter(Boolean).map(e).join(' · ')}</div>
      </div>
    </div>
    <div class="r">
      <div class="doc">TAX INVOICE</div>
      <div class="no">${e(ctx.invoice.number)}</div>
      <div class="dt2">${formatLongDate(ctx.invoice.issuedOn)} · ${ctx.totals.status === 'paid' ? 'PAID' : ctx.totals.status === 'partial' ? 'PARTIALLY PAID' : 'BALANCE DUE'}</div>
    </div>
  </div>

  <div class="reg-strip">
    ${ctx.hotel.gstin ? `<span>GSTIN <b>${e(ctx.hotel.gstin)}</b></span>` : ''}
    ${ctx.hotel.panNumber ? `<span>PAN <b>${e(ctx.hotel.panNumber)}</b></span>` : ''}
    <span>SAC <b>${ctx.type === 'banquet' ? '997212' : '996311'}</b></span>
    <span>GST <b>5% (CGST 2.5% + SGST 2.5%)</b></span>
  </div>

  <div class="tiles">
    <div class="tile"><div class="k">Taxable Value</div><div class="v">${formatCurrency(ctx.totals.subtotal)}</div></div>
    <div class="tile"><div class="k">CGST @ 2.5%</div><div class="v">${formatCurrency(ctx.totals.cgst)}</div></div>
    <div class="tile"><div class="k">SGST @ 2.5%</div><div class="v">${formatCurrency(ctx.totals.sgst)}</div></div>
    <div class="tile dark"><div class="k">Grand Total</div><div class="v">${formatCurrency(ctx.totals.total)}</div></div>
  </div>

  <div class="who">
    <div class="card">
      <div class="label">Billed To</div>
      <div class="pname">${e(ctx.customer.name)}</div>
      <div class="pmeta">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${[ctx.customer.phone && `Tel: ${e(ctx.customer.phone)}`, ctx.customer.email && e(ctx.customer.email)].filter(Boolean).join(' · ')}
        ${ctx.customer.gstin ? `<br/>GSTIN: ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div class="card">
      <div class="label">${ctx.type === 'banquet' ? 'Event Summary' : 'Stay Summary'}</div>
      <div class="stayline">${stayLine(ctx)}</div>
    </div>
  </div>

  <table class="items">
    <thead><tr>
      <th class="c" style="width:34px">#</th><th>Particulars</th>
      <th class="c" style="width:76px">HSN/SAC</th><th class="r" style="width:44px">Qty</th>
      <th class="r" style="width:92px">Rate</th><th class="r" style="width:104px">Amount</th>
    </tr></thead>
    <tbody>${items(ctx.items)}</tbody>
  </table>

  <div class="below">
    <div class="words">Amount chargeable (in words)
      <b>${e(amountInWords(ctx.totals.total))}</b>
    </div>
    <div class="settle">
      ${ctx.totals.discount ? `<div class="srow"><span>Discount</span><b>− ${formatCurrency(ctx.totals.discount)}</b></div>` : ''}
      <div class="srow"><span>Grand total</span><b>${formatCurrency(ctx.totals.total)}</b></div>
      <div class="srow"><span>Amount received</span><b>${formatCurrency(ctx.totals.paid)}</b></div>
      <div class="srow due"><span>Balance due</span><span>${formatCurrency(ctx.totals.balance)}</span></div>
    </div>
  </div>

  <div class="meta2">
    <div>
      ${ctx.payment ? `<b>Payment</b>${e((ctx.payment.method || '').toUpperCase())}${ctx.payment.reference ? ` · Ref ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · received ${formatDate(ctx.payment.paidOn)}` : ''}` : ''}
      ${ctx.notes ? `<div style="margin-top:8px"><b>Remarks</b>${e(ctx.notes)}</div>` : ''}
    </div>
    <div>
      <b>Terms &amp; Conditions</b>
      GST at 5% as applicable. ${ctx.type === 'banquet'
        ? 'Banquet balance payable on or before the event date.'
        : 'Check-out 12:00 noon; late check-out subject to charges.'}
      Report discrepancies within 7 days. Munger jurisdiction.
    </div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
    <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
  </div>

  <div class="foot">Computer-generated tax invoice · ${e(ctx.hotel.name)}</div>

</div>
</body>
</html>`;
