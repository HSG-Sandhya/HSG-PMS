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

// ── Silk Ribbon ──────────────────────────────────────────────────────────────
// Boutique and airy: two silk waves drift across the head and foot of the sheet
// at different speeds, under a centred serif masthead. Parties sit in soft
// cards, the charges read as a light ledger. Emerald by default, restyleable.
//
// The waves are one SVG path tiled twice and translated by exactly -50%, so the
// loop is seamless — no visible jump when it restarts.

export const meta = {
  id: 'silk-ribbon',
  name: 'Silk Ribbon',
  description:
    'Boutique layout with silk waves drifting across the head and foot, centred serif masthead and a light ledger of charges.',
  customizable: true,
  theme: {
    accent: '#0f7b6c',
    accentAlt: '#7cc4b4',
    ink: '#16302c',
    muted: '#6d8a84',
    sheet: '#ffffff',
    backdrop: '#eef6f4',
    headerInk: '#16302c',
    tagline: 'Rest well · Dine well · Return often',
    cornerRadius: 18,
    animationSpeed: 24,
    backgroundIntensity: 75,
  },
};

const WAVE = 'M0,60 C120,110 240,10 360,60 C480,110 600,10 720,60 L720,140 L0,140 Z';

// One seamless band: the same path tiled, slid left by exactly one tile width.
//
// The gradient id is per-ribbon — two <linearGradient id="silk"> in one document
// is a duplicate id, and url(#silk) would silently bind both ribbons to the
// first. The stops are coloured from CSS, not from a stop-color attribute: a
// presentation attribute cannot resolve var(), so the theme colour would be
// dropped and the wave would render black.
const ribbon = (theme, { cls, id, dur, opacity }) => `
  <div class="ribbon ${cls}">
    <svg viewBox="0 0 1440 140" preserveAspectRatio="none" style="opacity:${opacity}">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
          <stop class="s0" offset="0%"></stop>
          <stop class="s1" offset="100%"></stop>
        </linearGradient>
      </defs>
      <g style="animation: ${motion(theme, `slide ${dur} linear infinite`)};">
        <path d="${WAVE}" fill="url(#${id})"></path>
        <path d="${WAVE}" fill="url(#${id})" transform="translate(720,0)"></path>
        <path d="${WAVE}" fill="url(#${id})" transform="translate(1440,0)"></path>
      </g>
    </svg>
  </div>`;

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
  <section class="panel">
    <div class="panel-head">Tax Annexure</div>
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

  body { font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif; }

  /* ── Silk waves: same path, two speeds, opposite ends ── */
  .ribbon { position: absolute; left: 0; right: 0; height: 130px; overflow: hidden; }
  .ribbon svg { width: 200%; height: 100%; display: block; }
  .ribbon.top { top: 0; }
  .ribbon.bottom { bottom: 0; transform: scaleY(-1); }
  .ribbon stop.s0 { stop-color: var(--accent); }
  .ribbon stop.s1 { stop-color: var(--accent-alt); }
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-720px); } }

  .sheet { border: 1px solid rgba(var(--accent-rgb), 0.18); }

  /* ── Masthead ── */
  .masthead { position: relative; text-align: center; padding: 20px 30px 12px; overflow: hidden; }
  .masthead::before {
    content: ''; position: absolute; inset: 0; z-index: 0;
    background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.09), transparent 78%);
  }
  .mast-inner { position: relative; z-index: 1; }
  .brand-mark { max-height: var(--logo-h); max-width: 220px; object-fit: contain; margin: 0 auto 10px; display: block; }
  .brand-mono {
    width: var(--logo-h); height: var(--logo-h); margin: 0 auto 10px;
    border: 1px solid var(--accent); color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--logo-h) * 0.34); font-weight: 700; letter-spacing: 0.08em;
    transform: rotate(45deg);
  }
  .brand-mono { border-radius: 6px; }
  .hotel-name { font-size: 24px; font-weight: 700; letter-spacing: 0.02em; color: var(--header-ink); }
  .tagline { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--accent); margin-top: 7px; }
  .hotel-meta { font-size: 10.5px; color: var(--muted); line-height: 1.6; margin-top: 7px; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 10px 0 2px; }
  .divider span { height: 1px; width: 70px; background: linear-gradient(90deg, transparent, var(--accent)); }
  .divider span:last-child { background: linear-gradient(90deg, var(--accent), transparent); }
  .divider .doc-title { font-size: 12px; letter-spacing: 0.4em; text-transform: uppercase; color: var(--accent); font-family: 'Segoe UI', Arial, sans-serif; }

  /* ── Meta ribbon ── */
  .meta {
    display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    margin: 0 30px 14px; padding: 9px 14px; border-radius: 10px;
    background: rgba(var(--accent-rgb), 0.07);
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .meta .cell .k { font-size: 8.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
  .meta .cell .v { font-size: 12px; font-weight: 600; }
  .chip {
    display: inline-block; padding: 2px 11px; border-radius: 999px;
    background: var(--accent); color: #fff; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
  }

  .body { position: relative; padding: 0 30px 16px; font-family: 'Segoe UI', Arial, sans-serif; }

  /* ── Parties as soft cards ── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 14px; position: relative; z-index: 1; }
  .card { border: 1px solid rgba(var(--accent-rgb), 0.16); border-radius: 10px; padding: 11px 14px; }
  .label { font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .pname { font-size: 13.5px; font-weight: 700; margin-bottom: 3px; }
  .pmeta { font-size: 10.5px; color: var(--muted); line-height: 1.75; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.kv th { text-align: left; font-weight: 400; color: var(--muted); width: 82px; padding: 1.5px 0; vertical-align: top; }
  table.kv td { padding: 1.5px 0; }

  /* ── Ledger ── */
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; position: relative; z-index: 1; }
  table.items thead th {
    font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; text-align: left; color: var(--accent);
    padding: 0 10px 8px; border-bottom: 1.5px solid var(--accent);
  }
  table.items tbody td { padding: 8px 10px; vertical-align: top; border-bottom: 1px solid rgba(var(--muted-rgb), 0.16); }
  table.items tbody tr:nth-child(even) { background: rgba(var(--accent-rgb), 0.035); }
  .nm { font-weight: 600; }
  .dt { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .idx { color: var(--accent); font-size: 10px; font-weight: 600; }
  .sac { font-size: 10px; color: var(--muted); }
  .amt { font-weight: 600; }

  /* ── Summary ── */
  .summary { display: flex; justify-content: space-between; gap: 22px; align-items: flex-start; position: relative; z-index: 1; }
  .words { flex: 1; font-size: 10.5px; color: var(--muted); padding-top: 4px; }
  .words b { display: block; color: var(--ink); font-size: 11.5px; margin-top: 4px; font-family: Georgia, serif; }
  .tot-card {
    width: 292px; flex-shrink: 0; border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(var(--accent-rgb), 0.2);
  }
  table.tot { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.tot td { padding: 4px 14px; }
  table.tot td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.tot .mut td { color: var(--muted); font-size: 11px; }
  table.tot .grand td {
    background: linear-gradient(100deg, var(--accent), var(--accent-alt));
    background-size: 220% 100%;
    animation: ${motion(theme, 'shimmer calc(var(--cycle) * 0.9) ease-in-out infinite alternate')};
    color: #fff; font-size: 14px; font-weight: 700; padding: 11px 14px;
  }
  @keyframes shimmer { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
  table.tot .due td { font-weight: 700; color: var(--accent); }

  /* ── Panels ── */
  .panel { margin-top: 14px; position: relative; z-index: 1; }
  .panel-head { font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.grid th { text-align: left; font-weight: 600; color: var(--muted); padding: 4px 7px; font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid rgba(var(--muted-rgb), 0.28); }
  table.grid td { padding: 4px 7px; border-bottom: 1px solid rgba(var(--muted-rgb), 0.13); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 14px; position: relative; z-index: 1; }
  ol.terms { margin: 0; padding-left: 14px; font-size: 9px; color: var(--muted); line-height: 1.6; }

  .closing {
    margin-top: 14px; text-align: center; font-family: Georgia, serif; font-style: italic;
    font-size: 11.5px; color: var(--ink); position: relative; z-index: 1;
  }
  .sigs { display: flex; justify-content: space-between; gap: 40px; margin-top: 20px; position: relative; z-index: 1; }
  .sig { width: 205px; text-align: center; font-size: 10px; color: var(--muted); }
  .sig .for { font-size: 9.5px; margin-bottom: 16px; }
  .sig .line { border-top: 1px solid var(--accent); padding-top: 6px; color: var(--ink); }

  .foot { position: relative; z-index: 1; text-align: center; font-size: 9px; color: var(--muted); padding: 8px 30px 12px; }
</style>
</head>
<body>
<div class="page">
  <div class="art" aria-hidden="true"></div>

  <div class="sheet">
    ${ribbon(theme, { cls: 'top', id: 'silkTop', dur: 'var(--cycle)', opacity: 0.16 })}
    ${ribbon(theme, { cls: 'bottom', id: 'silkBottom', dur: 'calc(var(--cycle) * 1.6)', opacity: 0.1 })}

    <header class="masthead">
      <div class="mast-inner">
        ${brandMark(ctx, theme)}
        <div class="hotel-name">${e(ctx.hotel.name)}</div>
        ${theme.tagline ? `<div class="tagline">${e(theme.tagline)}</div>` : ''}
        <div class="hotel-meta">
          ${ctx.hotel.address ? `${e(ctx.hotel.address)}<br/>` : ''}
          ${[ctx.hotel.phone && `Tel ${e(ctx.hotel.phone)}`, ctx.hotel.email && e(ctx.hotel.email), ctx.hotel.website && e(ctx.hotel.website)].filter(Boolean).join(' · ')}
          ${ctx.hotel.gstin ? `<br/>GSTIN ${e(ctx.hotel.gstin)}` : ''}${ctx.hotel.panNumber ? ` · PAN ${e(ctx.hotel.panNumber)}` : ''}
        </div>
        <div class="divider"><span></span><div class="doc-title">${e(theme.docTitle)}</div><span></span></div>
      </div>
    </header>

    <div class="meta">
      <div class="cell"><div class="k">Invoice No.</div><div class="v">${e(ctx.invoice.number)}</div></div>
      <div class="cell"><div class="k">Date</div><div class="v">${formatLongDate(ctx.invoice.issuedOn)}</div></div>
      <div class="cell"><div class="k">${ctx.type === 'banquet' ? 'Booking' : 'Stay'}</div><div class="v">${ctx.type === 'banquet' ? 'Banquet / Event' : 'Room Accommodation'}</div></div>
      <div class="cell"><div class="k">Status</div><div class="v"><span class="chip">${e(status)}</span></div></div>
    </div>

    <div class="body">
      ${watermark(ctx, theme)}

      <section class="parties">
        <div class="card">
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
        <div class="card">
          <div class="label">${ctx.type === 'banquet' ? 'Event Details' : e(theme.stayLabel)}</div>
          <table class="kv">${stayRows(ctx)}</table>
        </div>
      </section>

      <table class="items">
        <thead><tr>
          <th class="c" style="width:36px">#</th>
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
        <div class="tot-card">
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
