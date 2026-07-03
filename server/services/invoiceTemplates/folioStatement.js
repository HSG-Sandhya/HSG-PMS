import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Folio Statement ──────────────────────────────────────────────────────────
// Classic front-desk guest folio: a banner carrying the amount due, a
// statement-style charge ledger, GST recap box and folio footer. Familiar to
// anyone who has settled a hotel bill at a reception desk.

export const meta = {
  id: 'folio-statement',
  name: 'Folio Statement',
  description:
    'Classic guest-folio style — amount-due banner, statement charge ledger, GST recap box and reception-desk footer.',
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<tr><th>Room</th><td>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` — ${e(ctx.stay.roomType)}` : ''}</td></tr>` : ''}
      <tr><th>Arrival</th><td>${formatDate(ctx.stay.checkIn)}</td></tr>
      <tr><th>Departure</th><td>${formatDate(ctx.stay.checkOut)}</td></tr>
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

const ledgerRows = (list) => {
  let running = 0;
  return list.map((item, i) => {
    running += Number(item.amount || 0);
    return `
  <tr>
    <td class="c">${i + 1}</td>
    <td><div class="nm">${e(item.description)}</div>${item.detail ? `<div class="dt">${e(item.detail)}</div>` : ''}</td>
    <td class="c">${e(hsnFor(item.category))}</td>
    <td class="r">${e(item.quantity)} × ${formatCurrency(item.rate)}</td>
    <td class="r">${formatCurrency(item.amount)}</td>
    <td class="r run">${formatCurrency(running)}</td>
  </tr>`;
  }).join('');
};

export const render = (ctx) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Tax Invoice ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #25303a; margin: 0; background: #fff; font-size: 12px; line-height: 1.5; }
  .page { max-width: 820px; margin: 0 auto; padding: 30px 36px; }
  .mast { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 3px double #25303a; }
  .hgroup { display: flex; align-items: center; gap: 13px; }
  .hotel-logo { max-height: 50px; }
  .hname { font-family: Georgia, serif; font-size: 21px; font-weight: 700; }
  .hmeta { font-size: 10.5px; color: #74808c; line-height: 1.65; margin-top: 2px; }
  .folio { text-align: right; font-size: 10.5px; color: #74808c; line-height: 1.8; }
  .folio b { color: #25303a; }
  .banner { display: flex; justify-content: space-between; align-items: center; background: #25303a; color: #fff; border-radius: 6px; padding: 13px 20px; margin: 18px 0 20px; }
  .banner .k { font-size: 9.5px; letter-spacing: 0.22em; color: #9fb0bf; }
  .banner .v { font-size: 19px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .banner .mid { text-align: center; }
  .banner .right { text-align: right; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 20px; }
  .label { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #9aa7b3; border-bottom: 1px solid #e6ebf0; padding-bottom: 4px; margin-bottom: 8px; }
  .pname { font-size: 14px; font-weight: 700; }
  .pmeta { font-size: 11px; color: #74808c; line-height: 1.7; margin-top: 3px; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.kv th { text-align: left; font-weight: 400; color: #9aa7b3; width: 92px; padding: 2.5px 0; vertical-align: top; }
  table.kv td { padding: 2.5px 0; }
  table.ledger { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.ledger thead th { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #74808c; text-align: left; border-top: 1.5px solid #25303a; border-bottom: 1px solid #25303a; padding: 8px; background: #f7f9fa; }
  table.ledger th.r, table.ledger td.r { text-align: right; }
  table.ledger th.c, table.ledger td.c { text-align: center; }
  table.ledger tbody td { padding: 9px 8px; border-bottom: 1px solid #eef2f5; vertical-align: top; font-variant-numeric: tabular-nums; }
  .nm { font-weight: 600; }
  .dt { font-size: 10.5px; color: #9aa7b3; margin-top: 2px; }
  td.run { color: #74808c; }
  .recap-row { display: flex; gap: 26px; margin-bottom: 20px; }
  .words { flex: 1; font-size: 11px; color: #74808c; padding-top: 6px; }
  .words b { display: block; color: #25303a; margin-top: 4px; font-size: 11.5px; font-style: italic; }
  .recap { width: 310px; border: 1px solid #dfe6ec; border-radius: 6px; overflow: hidden; }
  .recap .hd { background: #f7f9fa; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #74808c; padding: 8px 14px; border-bottom: 1px solid #dfe6ec; }
  .recap .bd { padding: 10px 14px; }
  .rrow { display: flex; justify-content: space-between; font-size: 11.5px; color: #74808c; padding: 3px 0; }
  .rrow b { color: #25303a; }
  .rrow.grand { border-top: 1.5px solid #25303a; margin-top: 6px; padding-top: 8px; font-size: 13.5px; font-weight: 800; color: #25303a; }
  .rrow.bal { font-weight: 700; color: #25303a; }
  .meta2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; font-size: 10.5px; color: #74808c; line-height: 1.8; margin-bottom: 6px; }
  .sigs { display: flex; justify-content: space-between; gap: 30px; margin-top: 38px; }
  .sig { width: 210px; text-align: center; font-size: 10.5px; color: #74808c; }
  .sig .line { border-top: 1px solid #25303a; padding-top: 6px; }
  .sig .for { font-size: 9.5px; color: #9aa7b3; margin-bottom: 26px; }
  .foot { text-align: center; font-size: 9.5px; color: #aab6c0; margin-top: 22px; border-top: 1px solid #eef2f5; padding-top: 10px; }
  @media print { .page { padding: 14px 18px; } body, .banner { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">

  <div class="mast">
    <div class="hgroup">
      ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
      <div>
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">
          ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
          ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
    <div class="folio">
      Guest Folio / Tax Invoice<br/>
      No. <b>${e(ctx.invoice.number)}</b><br/>
      ${formatLongDate(ctx.invoice.issuedOn)}<br/>
      ${[ctx.hotel.gstin && `GSTIN <b>${e(ctx.hotel.gstin)}</b>`, ctx.hotel.panNumber && `PAN <b>${e(ctx.hotel.panNumber)}</b>`].filter(Boolean).join(' · ')}
    </div>
  </div>

  <div class="banner">
    <div>
      <div class="k">GRAND TOTAL (INCL. 5% GST)</div>
      <div class="v">${formatCurrency(ctx.totals.total)}</div>
    </div>
    <div class="mid">
      <div class="k">AMOUNT RECEIVED</div>
      <div class="v">${formatCurrency(ctx.totals.paid)}</div>
    </div>
    <div class="right">
      <div class="k">${ctx.totals.status === 'paid' ? 'SETTLED IN FULL' : 'BALANCE DUE'}</div>
      <div class="v">${formatCurrency(ctx.totals.balance)}</div>
    </div>
  </div>

  <div class="cols">
    <div>
      <div class="label">Guest</div>
      <div class="pname">${e(ctx.customer.name)}</div>
      <div class="pmeta">
        ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
        ${[ctx.customer.phone && `Tel ${e(ctx.customer.phone)}`, ctx.customer.email && e(ctx.customer.email)].filter(Boolean).join(' · ')}
        ${ctx.customer.gstin ? `<br/>GSTIN ${e(ctx.customer.gstin)}` : ''}
      </div>
    </div>
    <div>
      <div class="label">${ctx.type === 'banquet' ? 'Event' : 'Stay'}</div>
      <table class="kv">${stayRows(ctx)}</table>
    </div>
  </div>

  <table class="ledger">
    <thead><tr>
      <th class="c" style="width:34px">#</th><th>Charge Description</th>
      <th class="c" style="width:74px">HSN/SAC</th><th class="r" style="width:120px">Qty × Rate</th>
      <th class="r" style="width:100px">Charge</th><th class="r" style="width:104px">Running Total</th>
    </tr></thead>
    <tbody>${ledgerRows(ctx.items)}</tbody>
  </table>

  <div class="recap-row">
    <div class="words">Amount chargeable (in words)
      <b>${e(amountInWords(ctx.totals.total))}</b>
      ${ctx.payment ? `<div style="margin-top:10px">Settlement — ${e((ctx.payment.method || '').toUpperCase())}${ctx.payment.reference ? ` · Ref ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · ${formatDate(ctx.payment.paidOn)}` : ''}</div>` : ''}
      ${ctx.notes ? `<div style="margin-top:6px">Remarks — ${e(ctx.notes)}</div>` : ''}
    </div>
    <div class="recap">
      <div class="hd">GST Recap — 5% (SAC ${ctx.type === 'banquet' ? '997212' : '996311'})</div>
      <div class="bd">
        <div class="rrow"><span>Taxable value</span><b>${formatCurrency(ctx.totals.subtotal)}</b></div>
        <div class="rrow"><span>CGST @ 2.5%</span><b>${formatCurrency(ctx.totals.cgst)}</b></div>
        <div class="rrow"><span>SGST @ 2.5%</span><b>${formatCurrency(ctx.totals.sgst)}</b></div>
        ${ctx.totals.discount ? `<div class="rrow"><span>Discount</span><b>− ${formatCurrency(ctx.totals.discount)}</b></div>` : ''}
        <div class="rrow grand"><span>Grand total</span><span>${formatCurrency(ctx.totals.total)}</span></div>
        <div class="rrow"><span>Received</span><b>${formatCurrency(ctx.totals.paid)}</b></div>
        <div class="rrow bal"><span>Balance due</span><span>${formatCurrency(ctx.totals.balance)}</span></div>
      </div>
    </div>
  </div>

  <div class="meta2">
    <div>
      <div class="label">Front Desk Notes</div>
      ${ctx.type === 'banquet'
        ? 'Banquet bookings are held against advance payment; the balance falls due on or before the event date.'
        : 'Check-out time is 12:00 noon. Please deposit room keys at the reception on departure.'}
    </div>
    <div>
      <div class="label">Terms</div>
      GST charged at 5% (CGST 2.5% + SGST 2.5%). Discrepancies must be raised within 7 days of the invoice date. Disputes subject to Munger jurisdiction.
    </div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
    <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
  </div>

  <div class="foot">Computer-generated folio · ${e(ctx.hotel.name)} · We thank you for your patronage.</div>

</div>
</body>
</html>`;
