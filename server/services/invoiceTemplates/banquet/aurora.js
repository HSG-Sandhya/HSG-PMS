import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum, categoryTag, billedToTitle, billedToLines, gstCell, taxSummaryRows, letterheadLines, paymentBlock} from './shared.js';

const PAL = { accent: '#6366f1', ink: '#1e293b', muted: '#64748b', line: '#e6ebf2', soft: '#f8fafc' };

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
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1e293b;background:#eef2f7}
  .page{max-width:840px;margin:28px auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px -20px rgba(30,41,59,.28)}
  .hero{position:relative;padding:34px 40px 30px;color:#fff;background:linear-gradient(120deg,#6366f1 0%,#0ea5e9 52%,#14b8a6 100%)}
  .hero::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 82% -20%,rgba(255,255,255,.35),transparent 46%)}
  .hero>*{position:relative}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .brand{display:flex;gap:14px;align-items:center}
  .logo{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain}
  .hname{font-size:23px;font-weight:800;letter-spacing:-.02em}
  .hsub{font-size:12px;opacity:.9;margin-top:3px;line-height:1.5;max-width:320px}
  .badge{text-align:right}
  .badge .k{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
  .badge .no{font-size:15px;font-weight:700;margin-top:10px}
  .badge .dt{font-size:11px;opacity:.9;margin-top:3px}
  .body{padding:30px 40px 12px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:26px}
  .card{border:1px solid #e6ebf2;border-radius:16px;padding:18px 20px;background:#fbfcfe}
  .card h4{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#6366f1;font-weight:700;margin-bottom:10px}
  .card .nm{font-size:16px;font-weight:700}
  .card .ln{font-size:12px;color:#64748b;line-height:1.7;margin-top:4px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12px}
  .facts dt{color:#94a3b8;font-weight:600}
  .facts dd{color:#1e293b;font-weight:600;text-align:right}
  table{width:100%;border-collapse:collapse}
  thead th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;text-align:left;padding:0 12px 12px;border-bottom:2px solid #eef2f7}
  thead th.n{text-align:right}
  tbody td{padding:15px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-weight:700}.s{font-size:11px;color:#94a3b8;margin-top:3px}.b{font-weight:700}
  .pill{display:inline-block;font-size:10px;font-weight:700;color:#0ea5e9;background:#e0f2fe;padding:3px 9px;border-radius:999px}
  .foot{display:grid;grid-template-columns:1.1fr .9fr;gap:26px;margin-top:24px}
  .words{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;padding:16px 18px;font-size:12px;color:#475569}
  .words strong{display:block;color:#1e293b;font-size:13px;margin-top:4px}
  .sum{border:1px solid #e6ebf2;border-radius:16px;overflow:hidden}
  .sum .r{display:flex;justify-content:space-between;padding:11px 20px;font-size:13px;color:#475569}
  .sum .r span:last-child{font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums}
  .sum .r.grand{background:linear-gradient(120deg,#6366f1,#0ea5e9);color:#fff;font-size:17px;font-weight:800}
  .sum .r.grand span:last-child{color:#fff}
  .sum .r.bal span:last-child{color:#b45309;font-weight:800}
  .status{display:inline-block;margin-top:14px;padding:7px 16px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
  .status.paid{background:#dcfce7;color:#15803d}.status.partial{background:#fef3c7;color:#b45309}.status.unpaid{background:#fee2e2;color:#b91c1c}
  .extras{padding:0 40px}
  .stripline{padding:22px 40px 30px;margin-top:14px;border-top:1px solid #eef2f7;display:flex;justify-content:space-between;align-items:flex-end;color:#94a3b8;font-size:11px}
  .sign{text-align:right}.sign .l{height:34px}.sign .t{border-top:1.5px solid #cbd5e1;padding-top:6px;font-weight:700;color:#475569;font-size:12px}
  @page{size:A4;margin:9mm}
  @media print{body{background:#fff}.page{margin:0;border-radius:0;box-shadow:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.body{flex:1}}
</style></head>
<body><div class="page">
  <div class="hero">
    <div class="top">
      <div class="brand">
        <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
        <div><div class="hname">${e(ctx.hotel.name)}</div><div class="hsub">${letterheadLines(ctx.hotel).join('<br>')}</div></div>
      </div>
      <div class="badge">
        <span class="k">${e(L.short)}</span>
        <div class="no">${e(ctx.invoice.number)}</div>
        <div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}</div>
        ${quote ? `<div class="dt">Valid until ${validUntil(ctx)}</div>` : ''}
      </div>
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
      <div>
        <div class="sum">
          ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
          ${taxSummaryRows(ctx, docType)}
          <div class="r grand"><span>${quote ? 'Estimated total' : 'Grand total'}</span><span>${formatCurrency(t.total)}</span></div>
          ${quote ? '' : `<div class="r"><span>Amount paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
        </div>
      </div>
    </div>
    ${quote ? `<div class="extras" style="padding:0">${quotationExtras(ctx, PAL)}</div>` : ''}
    ${paymentBlock(ctx, PAL)}
  </div>
  <div class="stripline">
    <div>${quote ? 'We look forward to hosting your celebration.' : 'Thank you for celebrating with us.'}<br>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div>
    <div class="sign"><div class="l"></div><div class="t">Authorised signatory</div></div>
  </div>
</div></body></html>`;
};

export const meta = {
  id: 'aurora',
  name: 'Aurora Celebration',
  description: 'Vibrant gradient hero with rounded cards — a bright, modern look for weddings and receptions.',
};
