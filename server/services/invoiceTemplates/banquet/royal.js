import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum, billedToTitle, billedToLines, gstCell, taxSummaryRows, letterheadLines, paymentBlock} from './shared.js';

// Royal Ivory — warm ivory stationery with antique-gold rules and a crest.
// Fills the premium / high-end niche (replacing the old black "Noir") with a
// light, luxurious look built on Cormorant Garamond + Montserrat.
const PAL = { accent: '#a8862f', ink: '#2f2a22', muted: '#8c8168', line: '#e7dcc2', soft: '#faf5e8' };

const rows = (items) => items.map((it) => `
  <tr>
    <td><div class="d">${e(it.description)}</div>${it.detail ? `<div class="s">${e(it.detail)}</div>` : ''}</td>
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Montserrat',system-ui,sans-serif;color:#2f2a22;background:#f1e9d6}
  .page{max-width:840px;margin:26px auto;background:#fffdf6;padding:20px;box-shadow:0 22px 54px -26px rgba(120,100,40,.45)}
  .frame{border:2px solid #cbb06a;padding:22px 30px;position:relative}
  .frame::before{content:'';position:absolute;inset:6px;border:1px solid #e0cf9a;pointer-events:none}
  .inner{position:relative}
  .hdr{display:flex;align-items:center;gap:16px;text-align:left;padding-bottom:6px}
  .crest{width:64px;height:64px;flex:none;border-radius:50%;border:2px solid #cbb06a;display:flex;align-items:center;justify-content:center;color:#a8862f;font-family:'Cormorant Garamond',serif;font-size:30px;background:#fbf7ec;overflow:hidden}
  .crest img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  .hinfo{flex:1;min-width:0}
  .eyebrow{font-size:10px;letter-spacing:.42em;text-transform:uppercase;color:#a8862f;margin-bottom:2px}
  .hname{font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:600;color:#2f2a22;letter-spacing:.02em;line-height:1.05}
  .hmeta{font-size:10.5px;color:#8c8168;margin-top:5px;line-height:1.6}
  .rule{display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0 2px}
  .rule::before,.rule::after{content:'';height:1px;width:96px}
  .rule::before{background:linear-gradient(90deg,transparent,#cbb06a)}
  .rule::after{background:linear-gradient(90deg,#cbb06a,transparent)}
  .rule span{color:#a8862f;font-size:13px}
  .title{text-align:center;margin:8px 0 4px}
  .title .big{font-family:'Cormorant Garamond',serif;font-size:24px;letter-spacing:.32em;text-transform:uppercase;color:#a8862f}
  .title .no{font-size:11px;letter-spacing:.18em;color:#8c8168;margin-top:6px}
  .title .dt{font-size:11px;color:#8c8168;margin-top:3px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:14px 0}
  .card{border:1px solid #e7dcc2;background:#faf5e8;border-radius:4px;padding:12px 14px}
  .card h4{font-family:'Cormorant Garamond',serif;font-size:16px;color:#a8862f;margin-bottom:8px;letter-spacing:.04em}
  .card h4::after{content:'';display:block;width:26px;height:1px;background:#cbb06a;margin-top:4px}
  .card .nm{font-size:15px;font-weight:600;color:#2f2a22}
  .card .ln{font-size:11.5px;color:#8c8168;line-height:1.55;margin-top:4px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px}
  .facts dt{color:#9a8f74}.facts dd{color:#2f2a22;text-align:right;font-weight:500}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  thead th{font-family:'Cormorant Garamond',serif;font-size:14px;color:#a8862f;text-align:left;padding:8px 10px;border-top:2px solid #cbb06a;border-bottom:1px solid #cbb06a;letter-spacing:.05em}
  thead th.n{text-align:right}
  tbody td{padding:9px 10px;border-bottom:1px solid #ece1c8;font-size:12.5px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-weight:600;color:#2f2a22}.s{font-size:11px;color:#9a8f74;margin-top:3px;font-style:italic}.b{font-weight:700}
  .foot{display:grid;grid-template-columns:1fr .9fr;gap:24px;margin-top:14px;break-inside:avoid}
  .words{background:#faf5e8;padding:12px 16px;border-left:2px solid #cbb06a;font-size:12px;color:#8c8168;font-style:italic}
  .words strong{display:block;font-family:'Cormorant Garamond',serif;font-style:normal;color:#2f2a22;font-size:14px;margin-top:4px}
  .sum .r{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#8c8168;border-bottom:1px solid #ece1c8}
  .sum .r span:last-child{color:#2f2a22;font-variant-numeric:tabular-nums}
  .sum .r.grand{border-top:2px solid #cbb06a;border-bottom:none;padding-top:12px;margin-top:2px}
  .sum .r.grand span{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:#a8862f}
  .sum .r.bal span:last-child{color:#b0632c;font-weight:700}
  .stamp{display:inline-block;margin-top:12px;padding:5px 16px;border:1px solid #cbb06a;color:#a8862f;font-size:10px;letter-spacing:.2em;text-transform:uppercase}
  .sign{text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e7dcc2;color:#8c8168;font-size:11px}
  .sign .s{font-family:'Cormorant Garamond',serif;font-size:22px;color:#a8862f;margin-bottom:4px;letter-spacing:.06em}
  @page{size:A4;margin:9mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;box-shadow:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.frame{flex:1;display:flex;flex-direction:column}.inner{flex:1;display:flex;flex-direction:column}.sign{margin-top:auto}}
</style></head>
<body><div class="page"><div class="frame"><div class="inner">
  <div class="hdr">
    <div class="crest">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
    <div class="hinfo">
      <div class="eyebrow">Fine Hospitality</div>
      <div class="hname">${e(ctx.hotel.name)}</div>
      <div class="hmeta">${letterheadLines(ctx.hotel).join('<br>')}</div>
    </div>
  </div>
  <div class="rule"><span>❖</span></div>
  <div class="title">
    <div class="big">${e(L.title)}</div>
    <div class="no">${e(ctx.invoice.number)}</div>
    <div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}${quote ? ` · Valid until ${validUntil(ctx)}` : ''}</div>
  </div>
  <div class="cards">
    <div class="card"><h4>${quote ? 'Prepared for' : 'Billed to'}</h4><div class="nm">${e(billedToTitle(ctx))}</div><div class="ln">${billedToLines(ctx)}</div></div>
    <div class="card"><h4>Event details</h4><dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">GST</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows(ctx.items)}</tbody>
  </table>
  <div class="foot">
    <div>
      <div class="words">In words<strong>${e(amountInWords(t.total))}</strong></div>
      ${quote ? '' : `<div><span class="stamp">${t.status === 'paid' ? 'Paid in full' : t.status === 'partial' ? 'Partially paid' : 'Payment due'}</span></div>`}
    </div>
    <div class="sum">
      ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
      ${taxSummaryRows(ctx, docType)}
      <div class="r grand"><span>${quote ? 'Estimate' : 'Total'}</span><span>${formatCurrency(t.total)}</span></div>
      ${quote ? '' : `<div class="r"><span>Paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
    </div>
  </div>
  ${quote ? quotationExtras(ctx, PAL) : ''}
  ${paymentBlock(ctx, PAL)}
  <div class="sign"><div class="s">With gratitude</div><div>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div></div>
</div></div></div></body></html>`;
};

export const meta = {
  id: 'royal',
  name: 'Royal Ivory',
  description: 'Ivory-and-gold serif stationery with a crest and double-rule frame — refined luxury for premium events.',
};
