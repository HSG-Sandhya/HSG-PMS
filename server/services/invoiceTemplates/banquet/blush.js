import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum } from './shared.js';

const PAL = { accent: '#b06874', ink: '#5c4550', muted: '#a17f88', line: '#f2dde0', soft: '#fdf0f1' };

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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Pinyon+Script&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Montserrat',system-ui,sans-serif;color:#5c4550;background:#fbf1f0}
  .page{max-width:840px;margin:26px auto;background:#fffafa;padding:46px 52px;border:1px solid #f0d4d4;box-shadow:0 20px 50px -24px rgba(180,120,130,.4)}
  .frame{border:1px solid #e6b8bd;padding:34px 38px;position:relative}
  .frame::before{content:'❦';position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:#fffafa;color:#c98a94;padding:0 12px;font-size:20px}
  .hdr{text-align:center;padding-bottom:22px;border-bottom:1px solid #eccdd0}
  .logo{width:56px;height:56px;margin:0 auto 10px;border-radius:50%;border:1px solid #d99aa4;display:flex;align-items:center;justify-content:center;color:#c07783;font-family:'Cormorant Garamond',serif;font-size:26px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  .script{font-family:'Pinyon Script',cursive;font-size:30px;color:#c07783;line-height:1;margin-bottom:2px}
  .hname{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:600;color:#5c4550;letter-spacing:.02em}
  .hmeta{font-size:11px;color:#a17f88;margin-top:10px;line-height:1.7}
  .title{text-align:center;margin:22px 0 6px}
  .title .big{font-family:'Cormorant Garamond',serif;font-size:23px;letter-spacing:.28em;text-transform:uppercase;color:#b06874}
  .title .no{font-size:11px;letter-spacing:.2em;color:#a17f88;margin-top:6px}
  .title .dt{font-size:11px;color:#a17f88;margin-top:3px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:24px 0}
  .card h4{font-family:'Cormorant Garamond',serif;font-size:16px;color:#b06874;margin-bottom:8px}
  .card h4::after{content:'';display:block;width:26px;height:1px;background:#d99aa4;margin-top:4px}
  .card .nm{font-size:15px;font-weight:600;color:#5c4550}
  .card .ln{font-size:12px;color:#a17f88;line-height:1.8;margin-top:5px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px}
  .facts dt{color:#bd9aa1}.facts dd{color:#5c4550;text-align:right;font-weight:500}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  thead th{font-family:'Cormorant Garamond',serif;font-size:14px;color:#b06874;text-align:left;padding:12px 10px;border-top:1px solid #e6b8bd;border-bottom:1px solid #e6b8bd;letter-spacing:.04em}
  thead th.n{text-align:right}
  tbody td{padding:14px 10px;border-bottom:1px solid #f2dde0;font-size:13px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-weight:600;color:#5c4550}.s{font-size:11px;color:#bd9aa1;margin-top:3px;font-style:italic}.b{font-weight:600}
  .foot{display:grid;grid-template-columns:1fr .9fr;gap:24px;margin-top:22px}
  .words{background:#fdf0f1;padding:14px 18px;border-left:2px solid #d99aa4;font-size:12px;color:#a17f88;font-style:italic}
  .words strong{display:block;font-family:'Cormorant Garamond',serif;font-style:normal;color:#5c4550;font-size:14px;margin-top:4px}
  .sum .r{display:flex;justify-content:space-between;padding:9px 0;font-size:13px;color:#a17f88;border-bottom:1px solid #f2dde0}
  .sum .r span:last-child{color:#5c4550;font-variant-numeric:tabular-nums}
  .sum .r.grand{border-top:1px solid #d99aa4;border-bottom:none;padding-top:12px;margin-top:2px}
  .sum .r.grand span{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:#b06874}
  .sum .r.bal span:last-child{color:#bb6a3c;font-weight:700}
  .stamp{display:inline-block;margin-top:12px;padding:5px 16px;border:1px solid #d99aa4;color:#b06874;font-size:10px;letter-spacing:.2em;text-transform:uppercase}
  .sign{text-align:center;margin-top:26px;padding-top:20px;border-top:1px solid #eccdd0;color:#a17f88;font-size:11px}
  .sign .s{font-family:'Pinyon Script',cursive;font-size:26px;color:#c07783;margin-bottom:4px}
  @page{size:A4;margin:9mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;box-shadow:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.frame{flex:1;display:flex;flex-direction:column}.sign{margin-top:auto}}
</style></head>
<body><div class="page"><div class="frame">
  <div class="hdr">
    <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
    <div class="script">Celebrating</div>
    <div class="hname">${e(ctx.hotel.name)}</div>
    <div class="hmeta">${e(ctx.hotel.address)}<br>${ctx.hotel.phone ? `${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.gstin ? ` · GSTIN ${e(ctx.hotel.gstin)}` : ''}</div>
  </div>
  <div class="title">
    <div class="big">${e(L.title)}</div>
    <div class="no">${e(ctx.invoice.number)}</div>
    <div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}${quote ? ` · Valid until ${validUntil(ctx)}` : ''}</div>
  </div>
  <div class="cards">
    <div class="card"><h4>${quote ? 'Prepared for' : 'Billed to'}</h4><div class="nm">${e(ctx.customer.name)}</div><div class="ln">${ctx.customer.phone ? `${e(ctx.customer.phone)}<br>` : ''}${ctx.customer.email ? `${e(ctx.customer.email)}<br>` : ''}${ctx.customer.address ? `${e(ctx.customer.address)}` : ''}${ctx.customer.gstin ? `<br>GSTIN ${e(ctx.customer.gstin)}` : ''}</div></div>
    <div class="card"><h4>Your celebration</h4><dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>
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
  ${quote ? quotationExtras(ctx, PAL) : ''}
  <div class="sign"><div class="s">Thank you</div><div>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div></div>
</div></div></body></html>`;
};

export const meta = {
  id: 'blush',
  name: 'Blush Romance',
  description: 'Soft blush-and-rose-gold script design — made for weddings and engagements.',
};
