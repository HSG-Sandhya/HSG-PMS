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

// ── Prism Motion ─────────────────────────────────────────────────────────────
// Corporate and data-dense: faceted prisms rotate slowly over a grid that
// creeps across the page, behind a sharp-cornered sheet with a coloured rail
// down the left edge. For business stays and company-billed folios.
//
// SVG fills come from CSS classes, not fill="var(--accent)" — a presentation
// attribute cannot resolve a custom property, and the shapes would render black.

export const meta = {
  id: 'prism-motion',
  name: 'Prism Motion',
  description:
    'Corporate layout with rotating prisms over a creeping grid — left colour rail, data-dense charge table and a dark totals card.',
  customizable: true,
  theme: {
    accent: '#3d5afe',
    accentAlt: '#00b8d4',
    ink: '#141a2e',
    muted: '#6b7490',
    sheet: '#ffffff',
    backdrop: '#eef1f8',
    headerInk: '#ffffff',
    tagline: 'Business stays, handled properly',
    cornerRadius: 6,
    animationSpeed: 26,
    backgroundIntensity: 55,
  },
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<tr><th>Room</th><td>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` · ${e(ctx.stay.roomType)}` : ''}</td></tr>` : ''}
      <tr><th>Check-in</th><td>${formatStayMoment(ctx.stay.checkIn, ctx.stay.checkInTime)}</td></tr>
      <tr><th>Check-out</th><td>${formatStayMoment(ctx.stay.checkOut, ctx.stay.checkOutTime)}</td></tr>
      <tr><th>Nights</th><td>${e(ctx.stay.nights)}</td></tr>
      <tr><th>Occupancy</th><td>${e(ctx.stay.adults)} adult${ctx.stay.adults > 1 ? 's' : ''}${ctx.stay.children ? `, ${e(ctx.stay.children)} child${ctx.stay.children > 1 ? 'ren' : ''}` : ''}</td></tr>`;
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
    <td class="c idx">${String(i + 1).padStart(2, '0')}</td>
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
    <div class="eyebrow">Tax annexure</div>
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

  body { font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }

  /* ── The grid creeps; the prisms turn ── */
  .mesh {
    position: absolute; inset: -20%;
    background-image:
      linear-gradient(rgba(var(--accent-rgb), 0.16) 1px, transparent 1px),
      linear-gradient(90deg, rgba(var(--accent-rgb), 0.16) 1px, transparent 1px);
    background-size: 34px 34px;
    animation: ${motion(theme, 'creep var(--cycle) linear infinite')};
  }
  @keyframes creep { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(34px, 34px, 0); } }

  .prisms { position: absolute; inset: 0; width: 100%; height: 100%; }
  .prisms polygon, .prisms circle { transform-box: fill-box; transform-origin: 50% 50%; }
  .p-a { fill: rgba(var(--accent-rgb), 0.5); animation: ${motion(theme, 'turn calc(var(--cycle) * 1.1) linear infinite')}; }
  .p-b { fill: rgba(var(--accent-alt-rgb), 0.45); animation: ${motion(theme, 'turn-r calc(var(--cycle) * 1.8) linear infinite')}; }
  .p-c { fill: none; stroke: rgba(var(--accent-rgb), 0.55); stroke-width: 1.5; animation: ${motion(theme, 'bob calc(var(--cycle) * 0.85) ease-in-out infinite alternate')}; }
  .p-d { fill: rgba(var(--accent-alt-rgb), 0.3); animation: ${motion(theme, 'bob calc(var(--cycle) * 1.3) ease-in-out infinite alternate-reverse')}; }
  @keyframes turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes turn-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
  @keyframes bob { from { transform: translateY(-14px) rotate(-8deg); } to { transform: translateY(16px) rotate(10deg); } }

  /* ── Sheet with a colour rail down the left edge ── */
  .sheet { display: grid; grid-template-columns: 34px 1fr; }
  .rail {
    background: linear-gradient(180deg, var(--accent), var(--accent-alt));
    background-size: 100% 260%;
    animation: ${motion(theme, 'slideRail calc(var(--cycle) * 1.1) ease-in-out infinite alternate')};
    position: relative;
  }
  @keyframes slideRail { from { background-position: 50% 0%; } to { background-position: 50% 100%; } }
  .rail span {
    position: absolute; bottom: 26px; left: 50%;
    transform: translateX(-50%) rotate(180deg); writing-mode: vertical-rl;
    color: var(--header-ink); font-size: 9px; letter-spacing: 0.34em; text-transform: uppercase; font-weight: 600;
  }
  .main { min-width: 0; }

  /* ── Masthead ── */
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 22px; padding: 18px 26px 14px; border-bottom: 2px solid var(--ink); }
  .brand-mark { max-height: var(--logo-h); max-width: 200px; object-fit: contain; margin-bottom: 9px; display: block; }
  .brand-mono {
    width: var(--logo-h); height: var(--logo-h); border-radius: 6px;
    background: linear-gradient(135deg, var(--accent), var(--accent-alt)); color: var(--header-ink);
    display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--logo-h) * 0.36); font-weight: 800; letter-spacing: 0.04em; margin-bottom: 9px;
  }
  .hotel-name { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
  .tagline { font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-top: 5px; font-weight: 600; }
  .hotel-meta { font-size: 10.5px; color: var(--muted); line-height: 1.7; margin-top: 8px; max-width: 320px; }
  .doc-side { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  .doc-no { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin-top: 3px; }
  .tag {
    display: inline-block; margin-top: 8px; padding: 3px 11px; border-radius: 4px;
    background: var(--accent); color: var(--header-ink);
    font-size: 8.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
  }

  /* ── Fact strip ── */
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid rgba(var(--muted-rgb), 0.25); }
  .facts .f { padding: 9px 12px; border-right: 1px solid rgba(var(--muted-rgb), 0.18); }
  .facts .f:last-child { border-right: none; }
  .facts .k { font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; font-weight: 600; }
  .facts .v { font-size: 11.5px; font-weight: 700; }

  .body { position: relative; padding: 14px 26px 14px; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 13px; position: relative; z-index: 1; }
  .eyebrow { font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 7px; }
  .pname { font-size: 13.5px; font-weight: 700; margin-bottom: 3px; }
  .pmeta { font-size: 10.5px; color: var(--muted); line-height: 1.7; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.kv th { text-align: left; font-weight: 500; color: var(--muted); width: 84px; padding: 1.5px 0; vertical-align: top; }
  table.kv td { padding: 1.5px 0; font-weight: 500; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 11px; position: relative; z-index: 1; }
  table.items thead th {
    font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; text-align: left; font-weight: 700;
    color: var(--muted); padding: 0 9px 7px; border-bottom: 2px solid var(--ink);
  }
  table.items tbody td { padding: 9px; border-bottom: 1px solid rgba(var(--muted-rgb), 0.16); vertical-align: top; font-size: 11px; }
  .nm { font-weight: 600; }
  .dt { font-size: 9.5px; color: var(--muted); margin-top: 2px; }
  .idx { color: var(--accent); font-size: 9.5px; font-weight: 700; }
  .sac { font-size: 9.5px; color: var(--muted); }
  .amt { font-weight: 700; }

  .summary { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; position: relative; z-index: 1; }
  .words { flex: 1; font-size: 10px; color: var(--muted); padding-top: 4px; }
  .words b { display: block; color: var(--ink); font-size: 11px; margin-top: 4px; font-weight: 600; }
  .tot-card {
    width: 286px; flex-shrink: 0; border-radius: 8px; overflow: hidden;
    background: var(--ink); color: rgba(var(--header-ink-rgb), 0.85); padding: 6px 0;
  }
  table.tot { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.tot td { padding: 5px 14px; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.tot .grand td {
    border-top: 1px solid rgba(var(--header-ink-rgb), 0.2);
    border-bottom: 1px solid rgba(var(--header-ink-rgb), 0.2);
    padding: 9px 14px; font-size: 14px; font-weight: 800; color: var(--header-ink);
  }
  table.tot .due td { font-weight: 700; color: var(--accent-alt); padding-top: 7px; }

  .block { margin-top: 13px; position: relative; z-index: 1; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.grid th { text-align: left; font-weight: 700; color: var(--muted); padding: 4px 7px; font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 1px solid rgba(var(--muted-rgb), 0.3); }
  table.grid td { padding: 4px 7px; border-bottom: 1px solid rgba(var(--muted-rgb), 0.14); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 13px; position: relative; z-index: 1; }
  ol.terms { margin: 0; padding-left: 14px; font-size: 8.5px; color: var(--muted); line-height: 1.6; }

  .closing {
    margin-top: 13px; padding: 9px 14px; border-radius: 6px; position: relative; z-index: 1;
    background: rgba(var(--accent-rgb), 0.07); border-left: 3px solid var(--accent);
    font-size: 10.5px; font-weight: 500;
  }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 20px; position: relative; z-index: 1; }
  .sig { width: 200px; text-align: center; font-size: 9.5px; color: var(--muted); }
  .sig .for { margin-bottom: 16px; }
  .sig .line { border-top: 1px solid var(--ink); padding-top: 6px; color: var(--ink); font-weight: 600; }
  .foot { position: relative; z-index: 1; text-align: center; font-size: 8.5px; color: var(--muted); padding: 8px 28px 10px; border-top: 1px solid rgba(var(--muted-rgb), 0.16); margin: 0 28px; }
</style>
</head>
<body>
<div class="page">

  <div class="art" aria-hidden="true">
    <div class="mesh"></div>
    <svg class="prisms" viewBox="0 0 800 1100" preserveAspectRatio="xMidYMid slice">
      <polygon class="p-a" points="90,70 160,40 210,110 140,150"></polygon>
      <polygon class="p-b" points="690,180 760,150 780,240 700,260"></polygon>
      <polygon class="p-c" points="120,880 200,850 230,940 140,960"></polygon>
      <polygon class="p-d" points="640,760 730,730 760,820 670,850"></polygon>
      <polygon class="p-b" points="380,1010 440,985 462,1050 392,1068"></polygon>
      <circle class="p-c" cx="720" cy="520" r="46"></circle>
      <circle class="p-a" cx="70" cy="470" r="26"></circle>
    </svg>
  </div>

  <div class="sheet">
    <div class="rail"><span>${e(theme.docTitle)}</span></div>

    <div class="main">
      <header class="masthead">
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
          <div class="tag">${e(status)}</div>
        </div>
      </header>

      <div class="facts">
        <div class="f"><div class="k">Invoice date</div><div class="v">${formatLongDate(ctx.invoice.issuedOn)}</div></div>
        <div class="f"><div class="k">${ctx.type === 'banquet' ? 'Booking type' : 'Stay type'}</div><div class="v">${ctx.type === 'banquet' ? 'Banquet / Event' : 'Room Accommodation'}</div></div>
        <div class="f"><div class="k">GSTIN</div><div class="v">${ctx.hotel.gstin ? e(ctx.hotel.gstin) : '—'}</div></div>
        <div class="f"><div class="k">PAN</div><div class="v">${ctx.hotel.panNumber ? e(ctx.hotel.panNumber) : '—'}</div></div>
      </div>

      <div class="body">
        ${watermark(ctx, theme)}

        <section class="parties">
          <div>
            <div class="eyebrow">${e(theme.billedToLabel)}</div>
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
            <div class="eyebrow">${ctx.type === 'banquet' ? 'Event details' : e(theme.stayLabel)}</div>
            <table class="kv">${stayRows(ctx)}</table>
          </div>
        </section>

        <table class="items">
          <thead><tr>
            <th class="c" style="width:32px">#</th>
            <th>Particulars</th>
            <th class="c" style="width:72px">HSN/SAC</th>
            <th class="r" style="width:44px">Qty</th>
            <th class="r" style="width:90px">Rate</th>
            <th class="r" style="width:100px">Amount</th>
          </tr></thead>
          <tbody>${itemRows(ctx.items)}</tbody>
        </table>

        <div class="summary">
          ${theme.showAmountInWords ? `<div class="words">Amount chargeable (in words)<b>${e(amountInWords(ctx.totals.total))}</b></div>` : '<div class="words"></div>'}
          <div class="tot-card">
            <table class="tot">
              <tr><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
              <tr><td>CGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
              <tr><td>SGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
              ${ctx.totals.discount ? `<tr><td>Discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
              ${ctx.totals.roundOff ? `<tr><td>Round off</td><td class="r">${formatCurrency(ctx.totals.roundOff)}</td></tr>` : ''}
              <tr class="grand"><td>Grand Total</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
              <tr><td>Amount received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
              <tr class="due"><td>Balance due</td><td class="r">${formatCurrency(ctx.totals.balance)}</td></tr>
            </table>
          </div>
        </div>

        ${annexure(ctx, theme)}

        ${(theme.showPayment && ctx.payment) || terms ? `
        <div class="two-col">
          <div>
            ${theme.showPayment && ctx.payment ? `
            <div class="eyebrow">Payment</div>
            <table class="kv">
              <tr><th>Mode</th><td>${e((ctx.payment.method || '').toUpperCase() || '—')}</td></tr>
              ${ctx.payment.reference ? `<tr><th>Reference</th><td>${e(ctx.payment.reference)}</td></tr>` : ''}
              ${ctx.payment.paidOn ? `<tr><th>Received</th><td>${formatDate(ctx.payment.paidOn)}</td></tr>` : ''}
            </table>` : ''}
            ${ctx.notes ? `<div class="eyebrow" style="margin-top:14px">Remarks</div><div class="pmeta">${e(ctx.notes)}</div>` : ''}
          </div>
          <div>
            ${terms ? `<div class="eyebrow">Terms &amp; conditions</div><ol class="terms">${terms}</ol>` : ''}
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
</div>
</body>
</html>`;
};
