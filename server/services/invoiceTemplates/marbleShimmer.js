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

// ── Marble Shimmer ───────────────────────────────────────────────────────────
// Formal and stately: stone veining drifts slowly behind the sheet while a
// specular sheen sweeps across the masthead and the grand-total bar. Small-caps
// headings, double rules, symmetric columns — the letterpress register, with
// motion that stays on screen and freezes on paper.
//
// The veins are layered gradients rather than an SVG turbulence filter: a
// filter that heavy re-rasterises at print resolution and can stall the print
// dialog on a long invoice.

export const meta = {
  id: 'marble-shimmer',
  name: 'Marble Shimmer',
  description:
    'Stately marble veining with a sheen that sweeps the masthead — small-caps headings, double rules and a formal symmetric layout.',
  customizable: true,
  theme: {
    accent: '#9a7b4f',
    accentAlt: '#c9b391',
    ink: '#2b2721',
    muted: '#857b6d',
    sheet: '#fffdf9',
    backdrop: '#e8e2d7',
    headerInk: '#2b2721',
    tagline: 'Est. hospitality in the heart of Munger',
    cornerRadius: 4,
    animationSpeed: 28,
    backgroundIntensity: 65,
  },
};

const stayRows = (ctx) => {
  if (ctx.type === 'hotel' && ctx.stay) {
    return `
      ${ctx.stay.roomNumber ? `<tr><th>Room</th><td>${e(ctx.stay.roomNumber)}${ctx.stay.roomType ? ` — ${e(ctx.stay.roomType)}` : ''}</td></tr>` : ''}
      <tr><th>Arrival</th><td>${formatStayMoment(ctx.stay.checkIn, ctx.stay.checkInTime)}</td></tr>
      <tr><th>Departure</th><td>${formatStayMoment(ctx.stay.checkOut, ctx.stay.checkOutTime)}</td></tr>
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
    <div class="cap">Tax Annexure</div>
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

  body { font-family: 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif; }

  /* ── Stone: three vein layers drifting at their own pace ── */
  .vein { position: absolute; inset: -30%; }
  .vein.v1 {
    background:
      repeating-linear-gradient(64deg, rgba(var(--accent-rgb), 0.16) 0 1px, transparent 1px 46px),
      repeating-linear-gradient(58deg, rgba(var(--ink-rgb), 0.07) 0 1px, transparent 1px 118px);
    animation: ${motion(theme, 'creep1 var(--cycle) linear infinite alternate')};
  }
  .vein.v2 {
    background:
      repeating-linear-gradient(-72deg, rgba(var(--accent-alt-rgb), 0.22) 0 2px, transparent 2px 88px),
      repeating-linear-gradient(-66deg, rgba(var(--accent-rgb), 0.09) 0 1px, transparent 1px 30px);
    animation: ${motion(theme, 'creep2 calc(var(--cycle) * 1.5) linear infinite alternate')};
  }
  .vein.v3 {
    background: radial-gradient(ellipse 60% 40% at 30% 25%, rgba(var(--accent-alt-rgb), 0.4), transparent 70%),
                radial-gradient(ellipse 50% 50% at 75% 80%, rgba(var(--accent-rgb), 0.28), transparent 72%);
    filter: blur(28px);
    animation: ${motion(theme, 'creep3 calc(var(--cycle) * 2) ease-in-out infinite alternate')};
  }
  @keyframes creep1 { from { transform: translate3d(-24px, -10px, 0) rotate(0deg); } to { transform: translate3d(24px, 14px, 0) rotate(1.2deg); } }
  @keyframes creep2 { from { transform: translate3d(18px, 12px, 0) scale(1); } to { transform: translate3d(-22px, -12px, 0) scale(1.06); } }
  @keyframes creep3 { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-40px, 30px, 0) scale(1.15); } }

  .sheet { border: 1px solid rgba(var(--accent-rgb), 0.28); }

  /* ── Masthead in stone, with a sheen crossing it ── */
  .masthead {
    position: relative; overflow: hidden; text-align: center;
    padding: 18px 32px 12px; color: var(--header-ink);
    background:
      repeating-linear-gradient(72deg, rgba(var(--accent-rgb), 0.1) 0 1px, transparent 1px 38px),
      linear-gradient(160deg, rgba(var(--accent-alt-rgb), 0.3), rgba(var(--accent-alt-rgb), 0.08) 60%, transparent);
  }
  .sheen {
    position: absolute; top: -60%; bottom: -60%; width: 34%;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.75), transparent);
    transform: rotate(14deg);
    animation: ${motion(theme, 'sweep calc(var(--cycle) * 0.55) ease-in-out infinite')};
    pointer-events: none;
  }
  @keyframes sweep {
    0% { left: -45%; opacity: 0; }
    12% { opacity: 1; }
    62% { opacity: 1; }
    80%, 100% { left: 118%; opacity: 0; }
  }
  .mast-inner { position: relative; z-index: 1; }
  .brand-mark { max-height: var(--logo-h); max-width: 220px; object-fit: contain; margin: 0 auto 10px; display: block; }
  .brand-mono {
    width: var(--logo-h); height: var(--logo-h); margin: 0 auto 10px; border-radius: 50%;
    border: 2px double var(--accent); color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--logo-h) * 0.34); font-weight: 700; letter-spacing: 0.06em;
  }
  .hotel-name { font-size: 25px; font-weight: 700; letter-spacing: 0.06em; font-variant: small-caps; }
  .tagline { font-size: 10px; color: var(--accent); font-style: italic; margin-top: 5px; }
  .hotel-meta { font-size: 10.5px; color: var(--muted); line-height: 1.6; margin-top: 6px; }
  .dbl-rule { height: 0; border-top: 2px solid var(--accent); border-bottom: 1px solid var(--accent); padding-top: 2px; margin: 10px 44px 0; }

  .plate { text-align: center; margin: 10px 0 2px; }
  .plate .t {
    display: inline-block; font-variant: small-caps; letter-spacing: 0.42em;
    font-size: 15px; color: var(--ink); padding: 0 6px;
  }

  .meta-strip {
    display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;
    font-size: 11px; color: var(--muted); margin: 6px 32px 14px;
    padding: 7px 0; border-top: 1px solid rgba(var(--accent-rgb), 0.25); border-bottom: 1px solid rgba(var(--accent-rgb), 0.25);
  }
  .meta-strip b { color: var(--ink); font-weight: 700; }
  .stamp {
    display: inline-block; padding: 1px 11px; border: 1px solid var(--accent); color: var(--accent);
    font-variant: small-caps; letter-spacing: 0.18em; font-size: 10px;
  }

  .body { position: relative; padding: 0 32px 16px; }

  .parties { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 26px; margin-bottom: 14px; position: relative; z-index: 1; }
  .vrule { background: rgba(var(--accent-rgb), 0.22); }
  .cap { font-variant: small-caps; letter-spacing: 0.22em; font-size: 11px; color: var(--accent); margin-bottom: 8px; border-bottom: 1px solid rgba(var(--accent-rgb), 0.22); padding-bottom: 4px; }
  .pname { font-size: 14.5px; font-weight: 700; margin-bottom: 3px; }
  .pmeta { font-size: 11px; color: var(--muted); line-height: 1.75; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.kv th { text-align: left; font-weight: 400; font-style: italic; color: var(--muted); width: 88px; padding: 1.5px 0; vertical-align: top; }
  table.kv td { padding: 1.5px 0; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 11px; position: relative; z-index: 1; }
  table.items thead th {
    font-variant: small-caps; letter-spacing: 0.14em; font-size: 11px; text-align: left; font-weight: 600;
    padding: 9px 9px; border-top: 2px solid var(--accent); border-bottom: 1px solid var(--accent);
    background: rgba(var(--accent-alt-rgb), 0.14);
  }
  table.items tbody td { padding: 8px 9px; border-bottom: 1px dotted rgba(var(--accent-rgb), 0.4); vertical-align: top; }
  .nm { font-weight: 700; }
  .dt { font-size: 10px; color: var(--muted); font-style: italic; margin-top: 2px; }
  .idx { color: var(--muted); font-size: 10.5px; }
  .sac { font-size: 10px; color: var(--muted); }
  .amt { font-weight: 700; }

  .summary { display: flex; justify-content: space-between; gap: 26px; align-items: flex-start; position: relative; z-index: 1; }
  .words { flex: 1; font-size: 11px; color: var(--muted); padding-top: 6px; }
  .words b { display: block; color: var(--ink); font-style: italic; font-size: 12px; margin-top: 4px; }
  table.tot { width: 296px; border-collapse: collapse; font-size: 12px; flex-shrink: 0; }
  table.tot td { padding: 3.5px 0; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.tot .mut td { color: var(--muted); font-size: 11.5px; }
  table.tot .grand td {
    position: relative; overflow: hidden;
    border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
    padding: 10px 0; font-size: 14.5px; font-weight: 700;
    background: linear-gradient(100deg, rgba(var(--accent-alt-rgb), 0.5), rgba(var(--accent-alt-rgb), 0.12) 55%, rgba(var(--accent-alt-rgb), 0.5));
    background-size: 240% 100%;
    animation: ${motion(theme, 'gleam calc(var(--cycle) * 0.8) ease-in-out infinite alternate')};
  }
  @keyframes gleam { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
  table.tot .grand td:first-child { padding-left: 12px; }
  table.tot .grand td:last-child { padding-right: 12px; }
  table.tot .due td { font-weight: 700; }

  .block { margin-top: 14px; position: relative; z-index: 1; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.grid th { text-align: left; font-variant: small-caps; letter-spacing: 0.1em; font-size: 10.5px; color: var(--muted); padding: 4px 7px; border-bottom: 1px solid rgba(var(--accent-rgb), 0.35); }
  table.grid td { padding: 4px 7px; border-bottom: 1px dotted rgba(var(--accent-rgb), 0.28); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 14px; position: relative; z-index: 1; }
  ol.terms { margin: 0; padding-left: 14px; font-size: 9px; color: var(--muted); line-height: 1.6; }

  .closing { margin-top: 14px; text-align: center; font-style: italic; font-size: 11.5px; color: var(--ink); position: relative; z-index: 1; }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 22px; position: relative; z-index: 1; }
  .sig { width: 210px; text-align: center; font-size: 10.5px; color: var(--muted); }
  .sig .for { font-size: 10px; margin-bottom: 16px; }
  .sig .line { border-top: 1px solid var(--ink); padding-top: 6px; color: var(--ink); }
  .foot { position: relative; z-index: 1; text-align: center; font-size: 9.5px; color: var(--muted); font-style: italic; padding: 8px 32px 12px; }
</style>
</head>
<body>
<div class="page">

  <div class="art" aria-hidden="true">
    <div class="vein v1"></div>
    <div class="vein v2"></div>
    <div class="vein v3"></div>
  </div>

  <div class="sheet">

    <header class="masthead">
      <div class="sheen"></div>
      <div class="mast-inner">
        ${brandMark(ctx, theme)}
        <div class="hotel-name">${e(ctx.hotel.name)}</div>
        ${theme.tagline ? `<div class="tagline">${e(theme.tagline)}</div>` : ''}
        <div class="hotel-meta">
          ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
          ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
          ${ctx.hotel.gstin ? `<br/>GSTIN ${e(ctx.hotel.gstin)}` : ''}${ctx.hotel.panNumber ? ` &nbsp;·&nbsp; PAN ${e(ctx.hotel.panNumber)}` : ''}
        </div>
        <div class="dbl-rule"></div>
      </div>
    </header>

    <div class="plate"><span class="t">${e(theme.docTitle)}</span></div>

    <div class="meta-strip">
      <span>No. <b>${e(ctx.invoice.number)}</b></span>
      <span>Dated <b>${formatLongDate(ctx.invoice.issuedOn)}</b></span>
      <span>${ctx.type === 'banquet' ? 'Banquet / Event' : 'Room Accommodation'}</span>
      <span class="stamp">${e(status)}</span>
    </div>

    <div class="body">
      ${watermark(ctx, theme)}

      <section class="parties">
        <div>
          <div class="cap">${e(theme.billedToLabel)}</div>
          <div class="pname">${e(ctx.customer.name)}</div>
          <div class="pmeta">
            ${ctx.customer.company ? `${e(ctx.customer.company)}<br/>` : ''}
            ${ctx.customer.address ? `${e(ctx.customer.address)}<br/>` : ''}
            ${ctx.customer.phone ? `Tel ${e(ctx.customer.phone)}<br/>` : ''}
            ${ctx.customer.email ? `${e(ctx.customer.email)}<br/>` : ''}
            ${ctx.customer.gstin ? `GSTIN ${e(ctx.customer.gstin)}` : ''}
          </div>
        </div>
        <div class="vrule"></div>
        <div>
          <div class="cap">${ctx.type === 'banquet' ? 'Event Particulars' : e(theme.stayLabel)}</div>
          <table class="kv">${stayRows(ctx)}</table>
        </div>
      </section>

      <table class="items">
        <thead><tr>
          <th class="c" style="width:34px">No.</th>
          <th>Description of Services</th>
          <th class="c" style="width:76px">HSN/SAC</th>
          <th class="r" style="width:46px">Qty</th>
          <th class="r" style="width:94px">Rate</th>
          <th class="r" style="width:106px">Amount</th>
        </tr></thead>
        <tbody>${itemRows(ctx.items)}</tbody>
      </table>

      <div class="summary">
        ${theme.showAmountInWords ? `<div class="words">Amount chargeable, in words —<b>${e(amountInWords(ctx.totals.total))}</b></div>` : '<div class="words"></div>'}
        <table class="tot">
          <tr class="mut"><td>Taxable value</td><td class="r">${formatCurrency(ctx.totals.subtotal)}</td></tr>
          <tr class="mut"><td>CGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.cgst)}</td></tr>
          <tr class="mut"><td>SGST ${e(tax.halfLabel)}</td><td class="r">${formatCurrency(ctx.totals.sgst)}</td></tr>
          ${ctx.totals.discount ? `<tr class="mut"><td>Less: discount</td><td class="r">− ${formatCurrency(ctx.totals.discount)}</td></tr>` : ''}
          ${ctx.totals.roundOff ? `<tr class="mut"><td>Round off</td><td class="r">${formatCurrency(ctx.totals.roundOff)}</td></tr>` : ''}
          <tr class="grand"><td>Grand Total</td><td class="r">${formatCurrency(ctx.totals.total)}</td></tr>
          <tr class="mut"><td>Received</td><td class="r">${formatCurrency(ctx.totals.paid)}</td></tr>
          <tr class="due"><td>Balance due</td><td class="r">${formatCurrency(ctx.totals.balance)}</td></tr>
        </table>
      </div>

      ${annexure(ctx, theme)}

      ${(theme.showPayment && ctx.payment) || terms ? `
      <div class="two-col">
        <div>
          ${theme.showPayment && ctx.payment ? `
          <div class="cap">Payment</div>
          <table class="kv">
            <tr><th>Mode</th><td>${e((ctx.payment.method || '').toUpperCase() || '—')}</td></tr>
            ${ctx.payment.reference ? `<tr><th>Reference</th><td>${e(ctx.payment.reference)}</td></tr>` : ''}
            ${ctx.payment.paidOn ? `<tr><th>Received</th><td>${formatDate(ctx.payment.paidOn)}</td></tr>` : ''}
          </table>` : ''}
          ${ctx.notes ? `<div class="cap" style="margin-top:14px">Remarks</div><div class="pmeta">${e(ctx.notes)}</div>` : ''}
        </div>
        <div>
          ${terms ? `<div class="cap">Terms &amp; Conditions</div><ol class="terms">${terms}</ol>` : ''}
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
