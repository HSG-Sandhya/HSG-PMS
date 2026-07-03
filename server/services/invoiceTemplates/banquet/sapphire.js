import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import { isQuote, docLabels, eventFacts, validUntil, quotationExtras, itemsSum } from './shared.js';

const PAL = { accent: '#1e40af', ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', soft: '#f8faff' };

const rows = (items) => items.map((it, i) => `
  <tr>
    <td class="c">${i + 1}</td>
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;color:#0f172a;background:#eef2f8}
  .page{max-width:860px;margin:24px auto;background:#fff;border:1px solid #d7deea}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:26px 34px;border-bottom:3px solid #1e40af;gap:20px}
  .brand{display:flex;gap:13px;align-items:center}
  .logo{width:50px;height:50px;border-radius:8px;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:contain;border-radius:8px}
  .hname{font-size:20px;font-weight:800;color:#1e293b}
  .hsub{font-size:11px;color:#64748b;margin-top:3px;line-height:1.6;max-width:340px}
  .doc{text-align:right}
  .doc .k{font-size:20px;font-weight:800;color:#1e40af;letter-spacing:-.01em}
  .doc .no{font-size:12px;color:#475569;margin-top:6px;font-weight:600}
  .doc .dt{font-size:11px;color:#64748b;margin-top:2px}
  .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0}
  .mcell{padding:18px 34px}
  .mcell+.mcell{border-left:1px solid #e2e8f0}
  .mcell h4{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#1e40af;font-weight:700;margin-bottom:9px}
  .mcell .nm{font-size:15px;font-weight:700}
  .mcell .ln{font-size:12px;color:#64748b;line-height:1.7;margin-top:4px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px}
  .facts dt{color:#94a3b8;font-weight:600}.facts dd{color:#1e293b;text-align:right;font-weight:600}
  table{width:100%;border-collapse:collapse}
  thead th{background:#1e40af;color:#dbe4ff;font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:11px 12px;font-weight:600}
  thead th.n{text-align:right}thead th.c{text-align:center}
  tbody td{padding:13px 12px;border-bottom:1px solid #eef2f8;font-size:12.5px;vertical-align:top}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}tbody td.c{text-align:center;color:#64748b}
  tbody tr:nth-child(even){background:#f8faff}
  .d{font-weight:700}.s{font-size:11px;color:#94a3b8;margin-top:2px}.b{font-weight:700}
  .foot{display:grid;grid-template-columns:1.1fr .9fr;gap:0;border-top:2px solid #1e40af}
  .lft{padding:20px 34px}
  .words{font-size:12px;color:#475569}.words strong{display:block;color:#0f172a;font-size:13px;margin-top:3px}
  .rgt{padding:16px 34px;background:#f8faff;border-left:1px solid #e2e8f0}
  .sum .r{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #e8eef7}
  .sum .r span:last-child{color:#0f172a;font-weight:600;font-variant-numeric:tabular-nums}
  .sum .r.grand{border-bottom:none;border-top:2px solid #1e40af;margin-top:4px;padding-top:12px;font-size:16px;font-weight:800}
  .sum .r.grand span{color:#1e40af}
  .sum .r.bal span:last-child{color:#b45309;font-weight:800}
  .status{display:inline-block;margin-top:12px;padding:6px 14px;border-radius:5px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .status.paid{background:#dcfce7;color:#15803d}.status.partial{background:#fef3c7;color:#b45309}.status.unpaid{background:#fee2e2;color:#b91c1c}
  .extras{padding:4px 34px 0}
  .end{padding:16px 34px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;color:#94a3b8;font-size:11px}
  .sign{text-align:right}.sign .l{height:28px}.sign .t{border-top:1.5px solid #cbd5e1;padding-top:5px;font-weight:700;color:#475569;font-size:12px}
  @page{size:A4;margin:8mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;border:none;min-height:calc(100vh - 2px);display:flex;flex-direction:column}.end{margin-top:auto}}
</style></head>
<body><div class="page">
  <div class="hdr">
    <div class="brand">
      <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
      <div><div class="hname">${e(ctx.hotel.name)}</div><div class="hsub">${e(ctx.hotel.address)}${ctx.hotel.phone ? ` · ${e(ctx.hotel.phone)}` : ''}${ctx.hotel.email ? ` · ${e(ctx.hotel.email)}` : ''}${ctx.hotel.gstin ? `<br>GSTIN ${e(ctx.hotel.gstin)}` : ''}</div></div>
    </div>
    <div class="doc"><div class="k">${e(L.title).toUpperCase()}</div><div class="no">${e(ctx.invoice.number)}</div><div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}</div>${quote ? `<div class="dt">Valid until ${validUntil(ctx)}</div>` : ''}</div>
  </div>
  <div class="meta">
    <div class="mcell"><h4>${quote ? 'Prepared for' : 'Billed to'}</h4><div class="nm">${e(ctx.customer.name)}</div><div class="ln">${ctx.customer.phone ? `${e(ctx.customer.phone)}<br>` : ''}${ctx.customer.email ? `${e(ctx.customer.email)}<br>` : ''}${ctx.customer.address ? `${e(ctx.customer.address)}` : ''}${ctx.customer.gstin ? `<br>GSTIN ${e(ctx.customer.gstin)}` : ''}</div></div>
    <div class="mcell"><h4>Event details</h4><dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>
  </div>
  <table>
    <thead><tr><th class="c">#</th><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows(ctx.items)}</tbody>
  </table>
  <div class="foot">
    <div class="lft">
      <div class="words">Amount in words<strong>${e(amountInWords(t.total))}</strong></div>
      ${quote ? '' : `<div><span class="status ${e(t.status)}">${t.status === 'paid' ? 'Paid in full' : t.status === 'partial' ? 'Partially paid' : 'Payment due'}</span></div>`}
    </div>
    <div class="rgt">
      <div class="sum">
        ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
        <div class="r grand"><span>${quote ? 'Estimate' : 'Total'}</span><span>${formatCurrency(t.total)}</span></div>
        ${quote ? '' : `<div class="r"><span>Amount paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
      </div>
    </div>
  </div>
  ${quote ? `<div class="extras">${quotationExtras(ctx, PAL)}</div>` : ''}
  <div class="end">
    <div>${quote ? 'This is a quotation and not a demand for payment.' : 'Computer-generated invoice.'}<br>${e(ctx.hotel.name)}${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div>
    <div class="sign"><div class="l"></div><div class="t">For ${e(ctx.hotel.name)}</div></div>
  </div>
</div></body></html>`;
};

export const meta = {
  id: 'sapphire',
  name: 'Sapphire Corporate',
  description: 'Clean, structured blue layout with a clear itemised table — ideal for corporate functions.',
};
