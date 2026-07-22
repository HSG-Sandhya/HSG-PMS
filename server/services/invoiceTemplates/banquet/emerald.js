import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum, categoryTag, billedToTitle, billedToLines, gstCell, taxSummaryRows, letterheadLines, paymentBlock} from './shared.js';

const PAL = { accent: '#1a7a4e', ink: '#233b32', muted: '#5c7268', line: '#dce7db', soft: '#f3f8f1' };

const rows = (items) => items.map((it) => `
  <tr>
    <td><div class="d">${e(it.description)}</div>${it.detail ? `<div class="s">${e(it.detail)}</div>` : ''}</td>
    <td><span class="pill">${e(categoryTag(it.category))}</span></td>
    <td class="n">${e(it.quantity)}</td>
    <td class="n">${formatCurrency(it.rate)}</td>
    <td class="n">${gstCell(it)}</td>
    <td class="n b">${formatCurrency(it.amount)}</td>
  </tr>`).join('');

export const render = (ctx, { docType = 'invoice' } = {}) => {
  const L = docLabels(docType);
  const quote = isQuote(docType);
  const t = ctx.totals;
  const facts = eventFacts(ctx);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${e(L.title)} ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Nunito Sans',system-ui,sans-serif;color:#233b32;background:#eef3ec}
  .page{max-width:840px;margin:26px auto;background:#fbfcf8;box-shadow:0 20px 50px -24px rgba(20,60,45,.35)}
  .hero{padding:34px 44px;background:linear-gradient(140deg,#0f5132 0%,#1a7a4e 100%);color:#eaf6ee;position:relative;overflow:hidden}
  .hero::after{content:'❧';position:absolute;right:26px;bottom:-18px;font-size:120px;color:rgba(255,255,255,.08);line-height:1}
  .hero>*{position:relative}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .brand{display:flex;gap:14px;align-items:center}
  .logo{width:54px;height:54px;border-radius:12px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:24px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain}
  .hname{font-family:'Fraunces',serif;font-size:26px;font-weight:600}
  .hsub{font-size:11px;opacity:.9;margin-top:4px;line-height:1.6;max-width:320px}
  .badge{text-align:right}
  .badge .k{font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.85}
  .badge .no{font-family:'Fraunces',serif;font-size:19px;margin-top:6px}
  .badge .dt{font-size:11px;opacity:.9;margin-top:3px}
  .body{padding:28px 44px 12px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}
  .card{border:1px solid #dce7db;border-radius:12px;padding:18px 20px;background:#f3f8f1}
  .card h4{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#1a7a4e;font-weight:700;margin-bottom:9px}
  .card .nm{font-family:'Fraunces',serif;font-size:17px;color:#233b32}
  .card .ln{font-size:12px;color:#5c7268;line-height:1.7;margin-top:5px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px}
  .facts dt{color:#7d9089}.facts dd{color:#233b32;text-align:right;font-weight:600}
  table{width:100%;border-collapse:collapse}
  thead th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7d9089;text-align:left;padding:0 10px 11px;border-bottom:2px solid #dce7db}
  thead th.n{text-align:right}
  tbody td{padding:14px 10px;border-bottom:1px solid #edf3eb;font-size:13px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-weight:700;color:#233b32}.s{font-size:11px;color:#7d9089;margin-top:3px}.b{font-weight:700}
  .pill{display:inline-block;font-size:10px;font-weight:700;color:#1a7a4e;background:#dcefe1;padding:3px 9px;border-radius:6px}
  .foot{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;margin-top:22px}
  .words{background:#f3f8f1;border:1px dashed #b6cfbc;border-radius:10px;padding:14px 18px;font-size:12px;color:#5c7268}
  .words strong{display:block;font-family:'Fraunces',serif;color:#233b32;font-size:14px;margin-top:4px}
  .sum{border:1px solid #dce7db;border-radius:12px;overflow:hidden}
  .sum .r{display:flex;justify-content:space-between;padding:11px 18px;font-size:13px;color:#5c7268}
  .sum .r span:last-child{color:#233b32;font-weight:600;font-variant-numeric:tabular-nums}
  .sum .r.grand{background:#0f5132;color:#eaf6ee;font-family:'Fraunces',serif;font-size:18px}
  .sum .r.grand span:last-child{color:#eaf6ee}
  .sum .r.bal span:last-child{color:#a6591f;font-weight:800}
  .status{display:inline-block;margin-top:14px;padding:6px 15px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
  .status.paid{background:#d6f0dd;color:#0f7a41}.status.partial{background:#fdefcf;color:#a6591f}.status.unpaid{background:#fbdada;color:#b02a2a}
  .end{padding:20px 44px 28px;margin-top:14px;border-top:1px solid #dce7db;display:flex;justify-content:space-between;align-items:flex-end;color:#7d9089;font-size:11px}
  .sign{text-align:right}.sign .l{height:30px}.sign .t{border-top:1.5px solid #b6cfbc;padding-top:6px;font-weight:700;color:#5c7268;font-size:12px}
  @page{size:A4;margin:9mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;box-shadow:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.body{flex:1}}
</style></head>
<body><div class="page">
  <div class="hero">
    <div class="top">
      <div class="brand">
        <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
        <div><div class="hname">${e(ctx.hotel.name)}</div><div class="hsub">${letterheadLines(ctx.hotel).join('<br>')}</div></div>
      </div>
      <div class="badge"><div class="k">${e(L.title)}</div><div class="no">${e(ctx.invoice.number)}</div><div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}</div>${quote ? `<div class="dt">Valid until ${validUntil(ctx)}</div>` : ''}</div>
    </div>
  </div>
  <div class="body">
    <div class="cards">
      <div class="card"><h4>${quote ? 'Prepared for' : 'Billed to'}</h4><div class="nm">${e(billedToTitle(ctx))}</div><div class="ln">${billedToLines(ctx)}</div></div>
      <div class="card"><h4>Event details</h4><dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Type</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">GST</th><th class="n">Amount</th></tr></thead>
      <tbody>${rows(ctx.items)}</tbody>
    </table>
    <div class="foot">
      <div>
        <div class="words">In words<strong>${e(amountInWords(t.total))}</strong></div>
        ${quote ? '' : `<div><span class="status ${e(t.status)}">${t.status === 'paid' ? 'Paid in full' : t.status === 'partial' ? 'Partially paid' : 'Payment due'}</span></div>`}
      </div>
      <div class="sum">
        ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
        ${taxSummaryRows(ctx, docType)}
        <div class="r grand"><span>${quote ? 'Estimated total' : 'Grand total'}</span><span>${formatCurrency(t.total)}</span></div>
        ${quote ? '' : `<div class="r"><span>Amount paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
      </div>
    </div>
    ${quote ? quotationExtras(ctx, PAL) : ''}
    ${paymentBlock(ctx, PAL)}
  </div>
  <div class="end">
    <div>${quote ? 'We would be honoured to host your celebration.' : 'Thank you for celebrating with us.'}<br>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div>
    <div class="sign"><div class="l"></div><div class="t">Authorised signatory</div></div>
  </div>
</div></body></html>`;
};

export const meta = {
  id: 'emerald',
  name: 'Emerald Garden',
  description: 'Botanical emerald-and-cream design with serif accents — elegant and organic.',
};
