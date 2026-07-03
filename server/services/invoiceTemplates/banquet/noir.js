import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum } from './shared.js';

const PAL = { accent: '#c5a048', ink: '#f4efe2', muted: '#9a9384', line: '#2a2620', soft: '#17161b' };

const rows = (items) => items.map((it) => `
  <tr>
    <td><div class="d">${e(it.description)}</div>${it.detail ? `<div class="s">${e(it.detail)}</div>` : ''}</td>
    <td class="n">${e(it.quantity)}</td>
    <td class="n">${formatCurrency(it.rate)}</td>
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Jost',system-ui,sans-serif;color:#e7e3d8;background:#0b0b0d}
  .page{max-width:840px;margin:26px auto;background:#141318;border:1px solid #2a2620}
  .hdr{padding:40px 46px 30px;text-align:center;border-bottom:1px solid #b8912e;background:radial-gradient(circle at 50% -40%,rgba(197,160,72,.18),transparent 60%)}
  .logo{width:60px;height:60px;margin:0 auto 12px;border:1px solid #c5a048;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#d8b658;font-family:'Playfair Display',serif;font-size:26px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  .hname{font-family:'Playfair Display',serif;font-size:32px;font-weight:600;color:#f4efe2;letter-spacing:.02em}
  .htag{font-size:10px;letter-spacing:.5em;text-transform:uppercase;color:#c5a048;margin-top:10px}
  .hmeta{font-size:11px;color:#9a9384;margin-top:12px;line-height:1.7}
  .title{text-align:center;padding:26px 0 8px}
  .title .big{font-family:'Playfair Display',serif;font-size:26px;color:#f4efe2;letter-spacing:.1em}
  .title .big::before,.title .big::after{content:'✦';color:#c5a048;font-size:13px;margin:0 16px;vertical-align:middle}
  .title .no{font-size:12px;letter-spacing:.24em;color:#c5a048;margin-top:8px}
  .title .dt{font-size:11px;color:#9a9384;margin-top:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#2a2620;margin:26px 46px;border:1px solid #2a2620}
  .cell{background:#17161b;padding:20px 22px}
  .cell h4{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#c5a048;margin-bottom:10px}
  .cell .nm{font-family:'Playfair Display',serif;font-size:18px;color:#f4efe2}
  .cell .ln{font-size:12px;color:#9a9384;line-height:1.8;margin-top:6px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12px}
  .facts dt{color:#8a8272}.facts dd{color:#e7e3d8;text-align:right}
  table{width:100%;border-collapse:collapse;margin:0 46px;width:calc(100% - 92px)}
  thead th{font-family:'Playfair Display',serif;font-size:13px;color:#c5a048;text-align:left;padding:12px 10px;border-top:1px solid #b8912e;border-bottom:1px solid #b8912e;letter-spacing:.05em}
  thead th.n{text-align:right}
  tbody td{padding:15px 10px;border-bottom:1px solid #242029;font-size:13px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-weight:500;color:#f4efe2}.s{font-size:11px;color:#8a8272;margin-top:3px;font-style:italic}.b{color:#f4efe2}
  .foot{display:grid;grid-template-columns:1.05fr .95fr;gap:26px;margin:26px 46px 0}
  .words{border-left:2px solid #c5a048;padding:12px 18px;font-size:12px;color:#9a9384;font-style:italic}
  .words strong{display:block;font-family:'Playfair Display',serif;font-style:normal;color:#f4efe2;font-size:14px;margin-top:4px}
  .sum .r{display:flex;justify-content:space-between;padding:10px 0;font-size:13px;color:#9a9384;border-bottom:1px solid #242029}
  .sum .r span:last-child{color:#e7e3d8;font-variant-numeric:tabular-nums}
  .sum .r.grand{border-top:1px solid #b8912e;border-bottom:none;padding-top:14px;margin-top:4px}
  .sum .r.grand span{font-family:'Playfair Display',serif;font-size:22px;color:#f4efe2}
  .sum .r.grand span:first-child{color:#c5a048}
  .sum .r.bal span:last-child{color:#e0a860;font-weight:600}
  .stamp{display:inline-block;margin-top:14px;padding:6px 16px;border:1px solid #c5a048;color:#c5a048;font-size:10px;letter-spacing:.22em;text-transform:uppercase}
  .extras{margin:0 46px}
  footer{margin:30px 46px 0;padding:22px 0;border-top:1px solid #b8912e;text-align:center;color:#8a8272;font-size:11px}
  footer .sig{font-family:'Playfair Display',serif;font-size:18px;color:#f4efe2;letter-spacing:.14em;margin-bottom:6px}
  @page{size:A4;margin:9mm}
  @media print{body{background:#0b0b0d;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;min-height:calc(100vh - 2px);display:flex;flex-direction:column}footer{margin-top:auto}}
</style></head>
<body><div class="page">
  <div class="hdr">
    <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
    <div class="hname">${e(ctx.hotel.name)}</div>
    <div class="htag">Celebrations of distinction</div>
    <div class="hmeta">${e(ctx.hotel.address)}<br>${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.gstin ? ` · GSTIN ${e(ctx.hotel.gstin)}` : ''}</div>
  </div>
  <div class="title">
    <div class="big">${e(L.title)}</div>
    <div class="no">${e(ctx.invoice.number)}</div>
    <div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}${quote ? ` · Valid until ${validUntil(ctx)}` : ''}</div>
  </div>
  <div class="grid">
    <div class="cell"><h4>${quote ? 'Prepared for' : 'Billed to'}</h4><div class="nm">${e(ctx.customer.name)}</div><div class="ln">${ctx.customer.phone ? `${e(ctx.customer.phone)}<br>` : ''}${ctx.customer.email ? `${e(ctx.customer.email)}<br>` : ''}${ctx.customer.address ? `${e(ctx.customer.address)}` : ''}${ctx.customer.gstin ? `<br>GSTIN ${e(ctx.customer.gstin)}` : ''}</div></div>
    <div class="cell"><h4>The occasion</h4><dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows(ctx.items)}</tbody>
  </table>
  <div class="foot">
    <div>
      <div class="words">In words<strong>${e(amountInWords(t.total))}</strong></div>
      ${quote ? '' : `<div><span class="stamp">${t.status === 'paid' ? 'Paid in full' : t.status === 'partial' ? 'Partially paid' : 'Payment due'}</span></div>`}
    </div>
    <div class="sum">
      ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
      <div class="r grand"><span>${quote ? 'Estimate' : 'Total'}</span><span>${formatCurrency(t.total)}</span></div>
      ${quote ? '' : `<div class="r"><span>Paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
    </div>
  </div>
  ${quote ? `<div class="extras">${quotationExtras(ctx, PAL)}</div>` : ''}
  <footer>
    <div class="sig">— With gratitude —</div>
    <div>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}${ctx.hotel.gstin ? ` · GSTIN ${e(ctx.hotel.gstin)}` : ''}</div>
  </footer>
</div></body></html>`;
};

export const meta = {
  id: 'noir',
  name: 'Noir Luxe',
  description: 'Black-and-gold serif design with an editorial feel — for premium, high-end events.',
};
