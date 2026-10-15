import {
  escapeHtml as e,
  formatCurrency,
  formatDate,
  formatLongDate,
  amountInWords,
  hsnFor,
  splitItemTax,
  formatStayMoment,
} from './formatters.js';
import {
  resolveTheme, baseCss, motion, brandMark, watermark,
  taxLabels, termsItems, STATUS_LABEL,
} from './theme.js';

// ── Aurora Luxe ──────────────────────────────────────────────────────────────
// A deep aurora gradient drifts behind a bright, airy sheet: gold rules over
// midnight violet, a full-bleed masthead band, and generous white space around
// the charges. Every colour, label and the motion itself is theme-driven.
// On paper the aurora freezes and lightens — see baseCss()'s print block.

export const meta = {
  id: 'aurora-luxe',
  name: 'Aurora Luxe',
  description:
    'Drifting aurora gradient behind a bright sheet, gold rules on midnight violet — a full-bleed masthead with the complete GST annexure.',
  customizable: true,
  theme: {
    accent: '#c8a253',
    accentAlt: '#5b3fa8',
    ink: '#191c2b',
    muted: '#717892',
    sheet: '#ffffff',
    backdrop: '#141534',
    headerInk: '#f7f3e8',
    tagline: 'A warm welcome, every time',
    cornerRadius: 16,
    animationSpeed: 20,
    backgroundIntensity: 70,
  },
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<tr><th>Room</th><td>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</td></tr>` : ''}
      <tr><th>Arrival</th><td>${formatStayMoment(ctx.stay.checkIn, ctx.stay.checkInTime)}</td></tr>
      <tr><th>Departure</th><td>${formatStayMoment(ctx.stay.checkOut, ctx.stay.checkOutTime)}</td></tr>
      <tr><th>Nights</th><td>${e(ctx.stay.nights)}</td></tr>
      <tr><th>Guests</th><td>${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? `, ${e(ctx.stay.children)} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</td></tr>`;
  }
  if (ctx.type === 'banquet' && ctx.event) {
    return `
      ${ctx.event.hallName ? `<tr><th>Venue</th><td>${e(ctx.event.hallName)}</td></tr>` : ''}
      ${ctx.event.type ? `<tr><th>Function</th><td>${e(ctx.event.type)}</td></tr>` : ''}
      <tr><th>Date</th><td>${formatDate(ctx.event.date)}</td></tr>
      ${ctx.event.startTime ? `<tr><th>Timing</th><td>${e(ctx.event.startTime)}${ctx.event.endTime ? ` – ${e(ctx.event.endTime)}` : ''}</td></tr>` : ''}
      ${ctx.event.guests ? `<tr><th>Guests</th><td>${e(ctx.event.guests)} persons</td></tr>` : ''}`;
  }
  return '';
};

const itemRows = (items) => items.map((item, i) => `
  <tr>
    <td class="c idx">${i + 1}</td>
    <td>
      <div class="nm">${e(item.description)}</div>
      ${item.detail ? `<div class="dt">${e(item.detail)}</div>` : ''}
    </td>
    <td class="c sac">${e(hsnFor(item.category))}</td>
    <td class="r num">${e(item.quantity)}</td>
    <td class="r num">${formatCurrency(item.rate)}</td>
    <td class="r num amt">${formatCurrency(item.amount)}</td>
  </tr>`).join('');

const annexure = (ctx, theme) => {
  if (!theme.showGstAnnexure || !ctx.items.length) return '';
  const rows = ctx.items.map((item) => {
    const s = splitItemTax(item);
    const pct = Math.round((Number(item.gstRate) || 0) * 1000) / 10;
    return `
      <tr>
        <td>${e(item.description)}</td>
        <td class="c sac">${e(hsnFor(item.category))}</td>
        <td class="r num">${formatCurrency(s.taxable)}</td>
        <td class="c num">${pct / 2}%</td>
        <td class="r num">${formatCurrency(s.cgst)}</td>
        <td class="c num">${pct / 2}%</td>
        <td class="r num">${formatCurrency(s.sgst)}</td>
        <td class="r num">${formatCurrency(s.gross)}</td>
      </tr>`;
  }).join('');
  return `
  <section class="block">
    <div class="block-head">Tax annexure</div>
    <table class="grid">
      <thead><tr>
        <th>Particulars</th><th class="c">HSN/SAC</th><th class="r">Taxable</th>
        <th class="c">CGST</th><th class="r">Amount</th>
        <th class="c">SGST</th><th class="r">Amount</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

export const render = (ctx) => {
  const theme = ctx.theme || resolveTheme(meta.theme, {});
  const tax = taxLabels(ctx);
  const terms = termsItems(theme);
  const status = STATUS_LABEL[ctx.totals.status] || 'Balance Due';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(theme.docTitle)} ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<style>
${baseCss(theme)}

  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }

  /* ── The aurora: three soft lights drifting behind the sheet ── */
  .aurora { position: absolute; border-radius: 50%; filter: blur(46px); }
  .aurora.a1 {
    width: 460px; height: 460px; top: -160px; left: -120px;
    background: radial-gradient(circle at 30% 30%, var(--accent-alt), transparent 68%);
    animation: ${motion(theme, 'drift1 var(--cycle) ease-in-out infinite alternate')};
  }
  .aurora.a2 {
    width: 520px; height: 520px; top: 18%; right: -200px;
    background: radial-gradient(circle at 60% 40%, var(--accent), transparent 66%);
    animation: ${motion(theme, 'drift2 calc(var(--cycle) * 1.35) ease-in-out infinite alternate')};
  }
  .aurora.a3 {
    width: 600px; height: 380px; bottom: -180px; left: 12%;
    background: radial-gradient(ellipse at 50% 50%, var(--accent-alt), transparent 70%);
    animation: ${motion(theme, 'drift3 calc(var(--cycle) * 1.7) ease-in-out infinite alternate')};
  }
  @keyframes drift1 { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(90px, 60px, 0) scale(1.18); } }
  @keyframes drift2 { from { transform: translate3d(0,0,0) scale(1.1); } to { transform: translate3d(-110px, 90px, 0) scale(0.92); } }
  @keyframes drift3 { from { transform: translate3d(0,0,0) scale(0.95); } to { transform: translate3d(120px, -60px, 0) scale(1.2); } }

  /* ── Masthead: a living gradient band, clipped to the sheet ── */
  .masthead {
    position: relative;
    padding: 18px 28px 14px;
    color: var(--header-ink);
    overflow: hidden;
    background: linear-gradient(115deg, var(--accent-alt) 0%, var(--ink) 45%, var(--accent-alt) 100%);
    background-size: 280% 280%;
    animation: ${motion(theme, 'sweep calc(var(--cycle) * 1.2) ease infinite')};
  }
  @keyframes sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .masthead::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
  }
  .mast-row { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start; gap: 22px; }
  .brand-mark { max-height: var(--logo-h); max-width: 210px; object-fit: contain; margin-bottom: 9px; display: block; }
  .brand-mono {
    width: var(--logo-h); height: var(--logo-h); border-radius: 50%;
    border: 1.5px solid var(--accent); color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--logo-h) * 0.36); font-weight: 700; letter-spacing: 0.06em;
    margin-bottom: 9px;
  }
  .hotel-name { font-size: 21px; font-weight: 700; letter-spacing: 0.015em; line-height: 1.25; }
  .tagline { font-size: 10.5px; color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
  .hotel-meta { font-size: 10.5px; opacity: 0.8; line-height: 1.7; margin-top: 8px; max-width: 330px; }
  .doc-side { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 15px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 300; }
  .doc-no { font-size: 17px; font-weight: 700; color: var(--accent); margin-top: 5px; letter-spacing: 0.02em; }
  .doc-date { font-size: 10.5px; opacity: 0.8; margin-top: 3px; }
  .pill {
    display: inline-block; margin-top: 9px; padding: 3px 12px; border-radius: 999px;
    border: 1px solid var(--accent); color: var(--accent);
    font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  }
  .reg { font-size: 10px; opacity: 0.78; margin-top: 8px; line-height: 1.6; }

  /* ── Body ── */
  .body { position: relative; padding: 16px 28px 16px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-bottom: 14px; position: relative; z-index: 1; }
  .label { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(var(--accent-rgb), 0.32); }
  .pname { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .pmeta { font-size: 11px; color: var(--muted); line-height: 1.75; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.kv th { text-align: left; font-weight: 400; color: var(--muted); width: 88px; padding: 1.5px 0; vertical-align: top; }
  table.kv td { padding: 1.5px 0; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; position: relative; z-index: 1; }
  table.items thead th {
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; text-align: left;
    color: var(--header-ink); background: var(--ink); padding: 9px 10px;
  }
  table.items thead th:first-child { border-radius: 5px 0 0 5px; }
  table.items thead th:last-child { border-radius: 0 5px 5px 0; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid rgba(var(--muted-rgb), 0.2); vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: none; }
  .nm { font-weight: 600; }
  .dt { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .idx { color: var(--muted); font-size: 10px; }
  .sac { font-size: 10px; color: var(--muted); }
  .amt { font-weight: 600; }

  .summary { display: flex; justify-content: space-between; gap: 26px; align-items: flex-start; position: relative; z-index: 1; }
  .words { flex: 1; font-size: 10.5px; color: var(--muted); padding-top: 6px; }
  .words b { display: block; color: var(--ink); font-size: 11.5px; margin-top: 4px; font-style: italic; }
  table.tot { width: 288px; border-collapse: collapse; font-size: 11.5px; flex-shrink: 0; }
  table.tot td { padding: 3.5px 0; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.tot .mut td { color: var(--muted); font-size: 11px; }
  table.tot .grand td {
    padding: 11px 12px; font-size: 14px; font-weight: 700;
    color: var(--header-ink); background: linear-gradient(100deg, var(--accent-alt), var(--ink));
  }
  table.tot .grand td:first-child { border-radius: 6px 0 0 6px; }
  table.tot .grand td:last-child { border-radius: 0 6px 6px 0; }
  table.tot .due td { font-weight: 700; color: var(--accent); padding-top: 7px; }

  .block { margin-top: 14px; position: relative; z-index: 1; }
  .block-head { font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.grid th { text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid rgba(var(--muted-rgb), 0.3); padding: 4px 7px; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
  table.grid td { padding: 4px 7px; border-bottom: 1px solid rgba(var(--muted-rgb), 0.14); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 14px; position: relative; z-index: 1; }
  ol.terms { margin: 0; padding-left: 14px; font-size: 9px; color: var(--muted); line-height: 1.6; }

  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 22px; position: relative; z-index: 1; }
  .sig { width: 210px; text-align: center; font-size: 10px; color: var(--muted); }
  .sig .for { font-size: 9.5px; margin-bottom: 16px; }
  .sig .line { border-top: 1px solid var(--ink); padding-top: 6px; color: var(--ink); }

  .closing {
    margin-top: 14px; padding: 10px 14px; border-radius: 8px; position: relative; z-index: 1;
    background: rgba(var(--accent-rgb), 0.09);
    border-left: 3px solid var(--accent);
    font-size: 11px; color: var(--ink);
  }
  .foot { text-align: center; font-size: 9px; color: var(--muted); padding: 8px 30px 10px; position: relative; z-index: 1; }

  @media print { .masthead { animation: none; } }
</style>
</head>
<body>
<div class="page">

  <div class="art" aria-hidden="true">
    <div class="aurora a1"></div>
    <div class="aurora a2"></div>
    <div class="aurora a3"></div>
  </div>

  <div class="sheet">

    <header class="masthead">
      <div class="mast-row">
        <div>
          ${brandMark(ctx, theme)}
          <div class="hotel-name">${e(ctx.hotel.name)}</div>
          ${theme.tagline ? `<div class="tagline">${e(theme.tagline)}</div>` : ''}
          <div class="hotel-meta">
            ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
            ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div class="doc-side">
          <div class="doc-title">${e(theme.docTitle)}</div>
          <div class="doc-no">${e(ctx.invoice.number)}</div>
          <div class="doc-date">${formatLongDate(ctx.invoice.issuedOn)}</div>
          <div class="pill">${e(status)}</div>
          <div class="reg">
            ${ctx.hotel.gstin ? `GSTIN ${e(ctx.hotel.gstin)}<br/>` : ''}
            ${ctx.hotel.panNumber ? `PAN ${e(ctx.hotel.panNumber)}` : ''}
          </div>
        </div>
      </div>
    </header>

    <div class="body">
      ${watermark(ctx, theme)}

      <section class="parties">
        <div>
          <div class="label">${e(theme.billedToLabel)}</div>
          <div class="pname">${e(ctx.customer.name)}</div>
          <div class="pmeta">
            ${ctx.customer.company ? `${e(ctx.customer.company)}<br/>` : ''}
            ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
            ${ctx.customer.phone ? `Tel ${e(ctx.customer.phone)}<br/>` : ''}
            ${ctx.customer.email ? `${e(ctx.customer.email)}<br/>` : ''}
            ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
          </div>
        </div>
        <div>
          <div class="label">${ctx.type === 'banquet' ? 'Event Details' : e(theme.stayLabel)}</div>
          <table class="kv">${stayRows(ctx)}</table>
        </div>
      </section>

      <table class="items">
        <thead><tr>
          <th class="c" style="width:34px">#</th>
          <th>Particulars</th>
          <th class="c" style="width:74px">HSN/SAC</th>
          <th class="r" style="width:46px">Qty</th>
          <th class="r" style="width:92px">Rate</th>
          <th class="r" style="width:104px">Amount</th>
        </tr></thead>
        <tbody>${itemRows(ctx.items)}</tbody>
      </table>

      <div class="summary">
        ${theme.showAmountInWords ? `<div class="words">Amount chargeable (in words)<b>${e(amountInWords(ctx.totals.total))}</b></div>` : '<div class="words"></div>'}
        <table class="tot">
          <tr class="mut"><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
          <tr class="mut"><td>CGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
          <tr class="mut"><td>SGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
          ${ctx.totals.discount ? `<tr class="mut"><td>Discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
          ${ctx.totals.roundOff ? `<tr class="mut"><td>Round off</td><td class="r">${formatCurrency(ctx.totals.roundOff)}</td></tr>` : ''}
          <tr class="grand"><td>Grand Total</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
          <tr class="mut"><td>Amount received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
          <tr class="due"><td>Balance due</td><td class="r">${formatCurrency(ctx.totals.balance)}</td></tr>
        </table>
      </div>

      ${annexure(ctx, theme)}

      ${(theme.showPayment && ctx.payment) || terms ? `
      <div class="two-col">
        <div>
          ${theme.showPayment && ctx.payment ? `
          <div class="label">Payment</div>
          <table class="kv">
            <tr><th>Mode</th><td>${e((ctx.payment.method || '').toUpperCase() || '—')}</td></tr>
            ${ctx.payment.reference ? `<tr><th>Reference</th><td>${e(ctx.payment.reference)}</td></tr>` : ''}
            ${ctx.payment.paidOn ? `<tr><th>Received</th><td>${formatDate(ctx.payment.paidOn)}</td></tr>` : ''}
          </table>` : ''}
          ${ctx.notes ? `<div class="label" style="margin-top:14px">Remarks</div><div class="pmeta">${e(ctx.notes)}</div>` : ''}
        </div>
        <div>
          ${terms ? `<div class="label">Terms &amp; Conditions</div><ol class="terms">${terms}</ol>` : ''}
        </div>
      </div>` : ''}

      ${theme.thankYou ? `<div class="closing">${e(theme.thankYou)}</div>` : ''}

      ${theme.showSignatures ? `
      <div class="sigs">
        <div class="sig"><div class="for">&nbsp;</div><div class="line">${e(theme.guestSignatureLabel)}</div></div>
        <div class="sig"><div class="for">For ${e(ctx.hotel.name)}</div><div class="line">${e(theme.signatoryLabel)}</div></div>
      </div>` : ''}
    </div>

    ${theme.footerNote ? `<div class="foot">${e(theme.footerNote)}</div>` : ''}
  </div>
</div>
</body>
</html>`;
};
