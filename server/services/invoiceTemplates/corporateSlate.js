import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
} from './formatters.js';

// ── Corporate Slate ──────────────────────────────────────────────────────────
// Modern corporate layout: a slate side rail carries the hotel identity and
// registration numbers vertically; the body is clean sans-serif with sharp
// tables, a boxed GST summary and a compact signature strip.

export const meta = {
  id: 'corporate-slate',
  name: 'Corporate Slate',
  description:
    'Modern corporate layout — slate identity rail, sharp sans-serif tables, boxed 5% GST summary and signature strip.',
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<div class="kv"><span>Room</span><b>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` — ${e(ctx.stay.roomType)}` : ''}</b></div>` : ''}
      <div class="kv"><span>Check-in</span><b>${formatDate(ctx.stay.checkIn)}</b></div>
      <div class="kv"><span>Check-out</span><b>${formatDate(ctx.stay.checkOut)}</b></div>
      <div class="kv"><span>Nights</span><b>${e(ctx.stay.nights)}</b></div>
      <div class="kv"><span>Occupancy</span><b>${e(ctx.stay.adults)}A${ctx.stay.children ? ` + ${e(ctx.stay.children)}C` : ''}</b></div>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      ${ctx.event.hallName ? `<div class="kv"><span>Venue</span><b>${e(ctx.event.hallName)}</b></div>` : ''}
      ${ctx.event.type ? `<div class="kv"><span>Function</span><b>${e(ctx.event.type)}</b></div>` : ''}
      <div class="kv"><span>Event date</span><b>${formatDate(ctx.event.date)}</b></div>
      ${ctx.event.startTime ? `<div class="kv"><span>Timing</span><b>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</b></div>` : ''}
      ${ctx.event.guests ? `<div class="kv"><span>Guests</span><b>${e(ctx.event.guests)}</b></div>` : ''}`;
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; background: #fff; font-size: 12px; line-height: 1.5; }
  .sheet { max-width: 840px; margin: 0 auto; display: flex; min-height: 100vh; }
  .rail { width: 190px; background: #334155; color: #e2e8f0; padding: 32px 22px; }
  .rail .hotel-logo { max-height: 46px; margin-bottom: 14px; filter: brightness(1.05); }
  .rail .hname { font-size: 17px; font-weight: 700; line-height: 1.35; margin-bottom: 12px; }
  .rail .blk { font-size: 10.5px; color: #cbd5e1; line-height: 1.8; margin-bottom: 18px; }
  .rail .k { font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
  .rail .v { font-size: 11px; color: #f1f5f9; font-weight: 600; margin-bottom: 12px; word-break: break-all; }
  .body { flex: 1; padding: 32px 34px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .doc { font-size: 21px; font-weight: 800; letter-spacing: 0.04em; }
  .doc small { display: block; font-size: 10px; letter-spacing: 0.24em; color: #64748b; font-weight: 600; margin-top: 3px; }
  .inv { text-align: right; font-size: 11.5px; color: #475569; line-height: 1.8; }
  .inv b { color: #1f2937; }
  .pill { display: inline-block; background: #334155; color: #fff; padding: 3px 12px; border-radius: 3px; font-size: 9.5px; letter-spacing: 0.14em; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-bottom: 22px; }
  .panel { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; }
  .panel .label { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
  .pname { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .pmeta { font-size: 11px; color: #64748b; line-height: 1.7; }
  .kv { display: flex; justify-content: space-between; font-size: 11.5px; padding: 2.5px 0; }
  .kv span { color: #94a3b8; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.items thead th { background: #f1f5f9; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; text-align: left; padding: 9px 10px; border-bottom: 2px solid #334155; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  .nm { font-weight: 600; }
  .dt { font-size: 10.5px; color: #94a3b8; margin-top: 2px; }
  .tot-row { display: flex; gap: 22px; align-items: flex-start; margin-bottom: 20px; }
  .words { flex: 1; font-size: 11px; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px 14px; }
  .words b { display: block; color: #1f2937; margin-top: 4px; font-size: 11.5px; }
  .tot { width: 300px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; }
  .trow { display: flex; justify-content: space-between; font-size: 11.5px; color: #64748b; padding: 3.5px 0; }
  .trow b { color: #1f2937; }
  .trow.grand { border-top: 2px solid #334155; margin-top: 6px; padding-top: 9px; font-size: 14px; font-weight: 800; color: #1f2937; }
  .trow.due { font-weight: 700; color: #1f2937; }
  .terms { font-size: 10px; color: #94a3b8; line-height: 1.8; margin-bottom: 8px; }
  .terms b { display: block; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .sigs { display: flex; justify-content: space-between; gap: 30px; margin-top: 38px; }
  .sig { width: 200px; text-align: center; font-size: 10.5px; color: #64748b; }
  .sig .line { border-top: 1px solid #334155; padding-top: 6px; }
  .sig .for { font-size: 9.5px; color: #94a3b8; margin-bottom: 26px; }
  .foot { font-size: 9.5px; color: #b6c2d2; margin-top: 22px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; } .rail { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="sheet">

  <aside class="rail">
    ${ctx.hotel.logo ? `<img class="hotel-logo" src="${e(ctx.hotel.logo)}" alt="" />` : ''}
    <div class="hname">${e(ctx.hotel.name)}</div>
    <div class="blk">
      ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
      ${ctx.hotel.phone ? `Tel: ${e(ctx.hotel.phone)}<br/>` : ''}
      ${ctx.hotel.email ? `${e(ctx.hotel.email)}<br/>` : ''}
      ${ctx.hotel.website ? e(ctx.hotel.website) : ''}
    </div>
    ${ctx.hotel.gstin ? `<div class="k">GSTIN</div><div class="v">${e(ctx.hotel.gstin)}</div>` : ''}
    ${ctx.hotel.panNumber ? `<div class="k">PAN</div><div class="v">${e(ctx.hotel.panNumber)}</div>` : ''}
    <div class="k">SAC</div><div class="v">${ctx.type === 'banquet' ? '997212' : '996311'}</div>
    <div class="k">GST Rate</div><div class="v">5% (2.5 + 2.5)</div>
  </aside>

  <main class="body">
    <div class="top">
      <div class="doc">TAX INVOICE<small>${ctx.type === 'banquet' ? 'BANQUET / EVENT' : 'ROOM ACCOMMODATION'}</small></div>
      <div class="inv">
        Invoice No. <b>${e(ctx.invoice.number)}</b><br/>
        Date <b>${formatLongDate(ctx.invoice.issuedOn)}</b><br/>
        <span class="pill">${ctx.totals.status === 'paid' ? 'PAID' : ctx.totals.status === 'partial' ? 'PARTIALLY PAID' : 'BALANCE DUE'}</span>
      </div>
    </div>

    <div class="grid2">
      <div class="panel">
        <div class="label">Billed To</div>
        <div class="pname">${e(ctx.customer.name)}</div>
        <div class="pmeta">
          ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
          ${ctx.customer.phone ? `Tel: ${e(ctx.customer.phone)}<br/>` : ''}
          ${ctx.customer.email ? `${e(ctx.customer.email)}<br/>` : ''}
          ${ctx.customer.gstin ? `GSTIN: ${e(ctx.customer.gstin)}` : ''}
        </div>
      </div>
      <div class="panel">
        <div class="label">${ctx.type === 'banquet' ? 'Event Details' : 'Stay Details'}</div>
        ${stayRows(ctx)}
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

    <div class="tot-row">
      <div class="words">Amount chargeable (in words)
        <b>${e(amountInWords(ctx.totals.total))}</b>
        ${ctx.payment ? `<div style="margin-top:10px">Payment: <b style="display:inline">${e((ctx.payment.method || '').toUpperCase())}</b>${ctx.payment.reference ? ` · Ref ${e(ctx.payment.reference)}` : ''}${ctx.payment.paidOn ? ` · ${formatDate(ctx.payment.paidOn)}` : ''}</div>` : ''}
        ${ctx.notes ? `<div style="margin-top:8px">Remarks: ${e(ctx.notes)}</div>` : ''}
      </div>
      <div class="tot">
        <div class="trow"><span>Taxable value</span><b>${formatCurrency(ctx.totals.subtotal)}</b></div>
        <div class="trow"><span>CGST @ 2.5%</span><b>${formatCurrency(ctx.totals.cgst)}</b></div>
        <div class="trow"><span>SGST @ 2.5%</span><b>${formatCurrency(ctx.totals.sgst)}</b></div>
        ${ctx.totals.discount ? `<div class="trow"><span>Discount</span><b>− ${formatCurrency(ctx.totals.discount)}</b></div>` : ''}
        <div class="trow grand"><span>Grand Total</span><span>${formatCurrency(ctx.totals.total)}</span></div>
        <div class="trow"><span>Amount received</span><b>${formatCurrency(ctx.totals.paid)}</b></div>
        <div class="trow due"><span>Balance due</span><span>${formatCurrency(ctx.totals.balance)}</span></div>
      </div>
    </div>

    <div class="terms">
      <b>Terms &amp; Conditions</b>
      GST charged at 5% (CGST 2.5% + SGST 2.5%). ${ctx.type === 'banquet'
        ? 'Banquet balances are payable on or before the event date.'
        : 'Check-out time 12:00 noon; late check-out subject to availability and charges.'}
      Discrepancies must be reported within 7 days. Disputes subject to Munger jurisdiction.
    </div>

    <div class="sigs">
      <div class="sig"><div class="for">&nbsp;</div><div class="line">Guest Signature</div></div>
      <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">Authorised Signatory</div></div>
    </div>

    <div class="foot">Computer-generated invoice · ${e(ctx.hotel.name)} · Thank you for staying with us.</div>
  </main>

</div>
</body>
</html>`;
