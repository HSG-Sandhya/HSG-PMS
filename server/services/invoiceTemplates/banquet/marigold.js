import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum, billedToTitle, billedToLines, gstCell, taxSummaryRows, letterheadLines, paymentBlock} from './shared.js';

const PAL = { accent: '#c0392b', ink: '#4a1c17', muted: '#9a6b46', line: '#eccf8f', soft: '#fff8ea' };

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
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Poppins',system-ui,sans-serif;color:#4a1c17;background:#fdf3e3}
  .page{max-width:840px;margin:24px auto;background:#fffcf5;padding:12px;border:2px solid #c9992f;box-shadow:0 20px 50px -24px rgba(140,70,20,.4)}
  .inner{border:1px solid #e0b558;padding:22px 30px}
  .hdr{padding-bottom:12px;position:relative}
  .hrow{display:flex;align-items:center;gap:16px;text-align:left}
  .hdr::after{content:'';display:block;height:3px;margin-top:12px;background:repeating-linear-gradient(90deg,#c9992f 0,#c9992f 10px,transparent 10px,transparent 18px)}
  .om{font-size:12px;color:#c0392b;letter-spacing:.3em;margin-bottom:1px}
  .logo{width:64px;height:64px;flex:none;border-radius:50%;border:2px solid #d4a017;display:flex;align-items:center;justify-content:center;color:#c0392b;font-family:'Marcellus',serif;font-size:30px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  .hinfo{flex:1;min-width:0}
  .hname{font-family:'Marcellus',serif;font-size:25px;color:#8c2d1a;letter-spacing:.02em;line-height:1.05}
  .hmeta{font-size:10.5px;color:#9a6b46;margin-top:5px;line-height:1.6}
  .title{text-align:center;margin:12px 0 4px}
  .title .big{display:inline-block;font-family:'Marcellus',serif;font-size:20px;letter-spacing:.22em;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#e0801a,#c0392b);padding:8px 28px;border-radius:4px}
  .title .no{font-size:12px;letter-spacing:.16em;color:#9a6b46;margin-top:6px}
  .title .dt{font-size:11px;color:#9a6b46;margin-top:2px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0}
  .card{border:1px solid #eccf8f;border-radius:8px;padding:12px 14px;background:#fff8ea}
  .card h4{font-family:'Marcellus',serif;font-size:14px;color:#c0392b;margin-bottom:8px}
  .card .nm{font-size:15px;font-weight:600;color:#4a1c17}
  .card .ln{font-size:11.5px;color:#9a6b46;line-height:1.55;margin-top:4px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px}
  .facts dt{color:#b18a5f}.facts dd{color:#4a1c17;text-align:right;font-weight:600}
  table{width:100%;border-collapse:collapse}
  thead th{background:#8c2d1a;color:#ffe6b8;font-family:'Marcellus',serif;font-size:13px;text-align:left;padding:8px 10px;letter-spacing:.04em}
  thead th.n{text-align:right}
  tbody td{padding:9px 10px;border-bottom:1px solid #f0dcb4;font-size:12.5px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  tbody tr:nth-child(even){background:#fff8ea}
  .d{font-weight:600;color:#4a1c17}.s{font-size:11px;color:#b18a5f;margin-top:2px}.b{font-weight:600}
  .foot{display:grid;grid-template-columns:1fr .9fr;gap:22px;margin-top:14px;break-inside:avoid}
  .words{background:#fff3dc;border:1px solid #eccf8f;border-radius:8px;padding:12px 16px;font-size:12px;color:#9a6b46}
  .words strong{display:block;font-family:'Marcellus',serif;color:#8c2d1a;font-size:14px;margin-top:4px}
  .sum .r{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#9a6b46;border-bottom:1px solid #f0dcb4}
  .sum .r span:last-child{color:#4a1c17;font-weight:500;font-variant-numeric:tabular-nums}
  .sum .r.grand{border-top:2px solid #c9992f;border-bottom:none;padding-top:12px;margin-top:2px}
  .sum .r.grand span{font-family:'Marcellus',serif;font-size:20px;color:#8c2d1a}
  .sum .r.bal span:last-child{color:#b45309;font-weight:700}
  .stamp{display:inline-block;margin-top:12px;padding:6px 16px;border:1.5px solid #c0392b;color:#c0392b;border-radius:4px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:600}
  .end{text-align:center;margin-top:14px;padding-top:12px;border-top:3px double #c9992f;color:#9a6b46;font-size:11px}
  .end .sig{font-family:'Marcellus',serif;font-size:18px;color:#8c2d1a;letter-spacing:.1em;margin-bottom:5px}
  @page{size:A4;margin:8mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;box-shadow:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.inner{flex:1;display:flex;flex-direction:column}.end{margin-top:auto}}
</style></head>
<body><div class="page"><div class="inner">
  <div class="hdr">
    <div class="hrow">
      <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
      <div class="hinfo">
        <div class="om">॥ शुभम् ॥</div>
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">${letterheadLines(ctx.hotel).join('<br>')}</div>
      </div>
    </div>
  </div>
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
  <div class="end"><div class="sig">Dhanyavaad · Thank you</div><div>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}${ctx.hotel.gstin ? ` · GSTIN ${e(ctx.hotel.gstin)}` : ''}</div></div>
</div></div></body></html>`;
};

export const meta = {
  id: 'marigold',
  name: 'Marigold Festive',
  description: 'Warm saffron-and-maroon ornamental design with a traditional touch — perfect for Indian weddings.',
};
