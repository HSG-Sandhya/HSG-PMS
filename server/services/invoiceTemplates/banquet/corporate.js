// Corporate — a refined navy-and-gold GST tax invoice for conferences, meetings
// and corporate events. Professional and minimal, but with character: a gold
// accent tab, diamond section markers, a filled navy table head, and a faint
// brand watermark. Engineered to sit on ONE A4 sheet (header + items + tax
// summary + bank/UPI block).
import { escapeHtml as e, formatCurrency, formatLongDate, amountInWords } from '../formatters.js';
import {
  isQuote, eventFacts, validUntil, quotationExtras, itemsSum,
  billedToTitle, billedToLines, letterheadLines, gstCell, taxSummaryRows, paymentBlock, banquetSac,
} from './shared.js';

const PAL = { accent: '#17324f', ink: '#1f2937', muted: '#64748b', line: '#e5e9f0', soft: '#f6f8fc' };

const rows = (items) => items.map((it) => `
  <tr>
    <td><div class="d">${e(it.description)}</div>${it.detail ? `<div class="s">${e(it.detail)}</div>` : ''}</td>
    <td class="c hsn">${e(banquetSac(it.category))}</td>
    <td class="n">${e(it.quantity)}</td>
    <td class="n">${formatCurrency(it.rate)}</td>
    <td class="n">${gstCell(it)}</td>
    <td class="n b">${formatCurrency(it.amount)}</td>
  </tr>`).join('');

export const render = (ctx, { docType = 'invoice' } = {}) => {
  const quote = isQuote(docType);
  const t = ctx.totals;
  const facts = eventFacts(ctx);
  const title = quote ? 'Quotation' : 'Tax Invoice';
  const watermark = ctx.hotel.logo
    ? `<img src="${e(ctx.hotel.logo)}" alt="">`
    : `<div class="t">${e((ctx.hotel.name || 'Hotel').toUpperCase())}</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${e(title)} ${e(ctx.invoice.number)} — ${e(ctx.hotel.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;color:#1f2937;background:#eef1f6;font-size:12px}
  .page{position:relative;max-width:840px;margin:20px auto;background:#fff;padding:32px 40px;overflow:hidden;box-shadow:0 16px 44px -22px rgba(23,50,79,.4)}

  /* faint brand watermark behind the content */
  .wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
  .wm img{width:52%;max-width:340px;opacity:.05}
  .wm .t{font-size:40px;font-weight:900;letter-spacing:.12em;color:#17324f;opacity:.03;transform:rotate(-22deg);white-space:nowrap;max-width:120%;text-align:center;line-height:1.1}
  .content{position:relative;z-index:1}

  .hdr{display:flex;align-items:flex-start;gap:16px}
  .logo{width:66px;height:66px;flex:none;border-radius:12px;border:1px solid #e2e7f0;display:flex;align-items:center;justify-content:center;color:#17324f;font-weight:800;font-size:28px;overflow:hidden;background:#fff}
  .logo img{width:100%;height:100%;object-fit:contain}
  .hinfo{flex:1;min-width:0}
  .hname{font-size:20px;font-weight:800;color:#17324f;letter-spacing:-.015em;line-height:1.1}
  .hmeta{font-size:10px;color:#64748b;margin-top:6px;line-height:1.7}
  .doc{text-align:right;flex:none}
  .doc .k{display:inline-block;font-size:15px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#17324f;padding-bottom:5px;border-bottom:2px solid #b0892f}
  .doc .no{font-size:12px;font-weight:700;color:#111827;margin-top:9px;font-variant-numeric:tabular-nums}
  .doc .dt{font-size:10px;color:#64748b;margin-top:2px}

  /* header divider — thin rule with a gold accent tab where the old black bar was */
  .hrule{position:relative;height:1.5px;background:#e5e9f0;margin-top:16px}
  .hrule::before{content:'';position:absolute;left:0;top:-1.5px;width:66px;height:4px;background:#b0892f;border-radius:2px}

  .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px}
  h4{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#17324f;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:7px}
  h4::before{content:'';width:7px;height:7px;background:#b0892f;transform:rotate(45deg);flex:none}
  .nm{font-size:13.5px;font-weight:700;color:#111827}
  .ln{font-size:11px;color:#64748b;line-height:1.65;margin-top:3px}
  .facts{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:11.5px}
  .facts dt{color:#94a3b8}.facts dd{color:#1f2937;text-align:right;font-weight:600}

  table{width:100%;border-collapse:separate;border-spacing:0;margin-top:20px}
  thead th{background:#17324f;color:#eaf0f8;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;text-align:left;padding:9px 12px}
  thead th:first-child{border-radius:7px 0 0 7px}
  thead th:last-child{border-radius:0 7px 7px 0}
  thead th.n{text-align:right}thead th.c{text-align:center}
  tbody td{padding:9px 12px;border-bottom:1px solid #eef1f6;font-size:12px;vertical-align:top}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tbody td.n{text-align:right;font-variant-numeric:tabular-nums}
  tbody td.c{text-align:center}
  .d{font-weight:600;color:#111827}.s{font-size:10px;color:#94a3b8;margin-top:2px}.b{font-weight:700;color:#17324f}
  .hsn{font-size:10.5px;color:#94a3b8}

  .foot{display:grid;grid-template-columns:1fr 300px;gap:24px;margin-top:18px}
  .words{font-size:11px;color:#64748b}
  .words strong{display:block;color:#111827;font-size:12px;font-weight:700;margin-top:3px}
  .status{display:inline-block;margin-top:12px;padding:5px 14px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .status.paid{background:#dcfce7;color:#15803d}.status.partial{background:#fef3c7;color:#b45309}.status.unpaid{background:#fee2e2;color:#b91c1c}
  .sum .r{display:flex;justify-content:space-between;padding:6px 2px;font-size:12px;color:#64748b;border-bottom:1px solid #eef1f6}
  .sum .r span:last-child{color:#1f2937;font-weight:600;font-variant-numeric:tabular-nums}
  .sum .r.grand{background:#17324f;color:#fff;border-bottom:none;padding:11px 14px;margin:5px 0;border-radius:8px;font-size:14px;font-weight:800;border-top:3px solid #b0892f}
  .sum .r.grand span:last-child{color:#fff}
  .sum .r.bal span:last-child{color:#b0892f;font-weight:800}

  .foota{margin-top:20px;padding-top:14px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;align-items:flex-end;color:#94a3b8;font-size:10px}
  .foota .brand{font-weight:700;color:#17324f}
  .sign{text-align:right}.sign .l{height:30px}.sign .t{border-top:1px solid #cbd5e1;padding-top:5px;font-weight:700;color:#475569;font-size:11px}

  @page{size:A4;margin:10mm}
  @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{margin:0;box-shadow:none;max-width:none;padding:0}}
</style></head>
<body><div class="page">
  <div class="wm">${watermark}</div>
  <div class="content">
    <div class="hdr">
      <div class="logo">${ctx.hotel.logo ? `<img src="${e(ctx.hotel.logo)}" alt="">` : e((ctx.hotel.name || 'H').charAt(0))}</div>
      <div class="hinfo">
        <div class="hname">${e(ctx.hotel.name)}</div>
        <div class="hmeta">${letterheadLines(ctx.hotel).join('<br>')}</div>
      </div>
      <div class="doc">
        <div class="k">${e(title)}</div>
        <div class="no">${e(ctx.invoice.number)}</div>
        <div class="dt">Issued ${formatLongDate(ctx.invoice.issuedOn)}</div>
        ${quote ? `<div class="dt">Valid until ${validUntil(ctx)}</div>` : ''}
      </div>
    </div>
    <div class="hrule"></div>

    <div class="parties">
      <div>
        <h4>${quote ? 'Prepared For' : 'Billed To'}</h4>
        <div class="nm">${e(billedToTitle(ctx))}</div>
        <div class="ln">${billedToLines(ctx)}</div>
      </div>
      <div>
        <h4>Event Details</h4>
        <dl class="facts">${facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>
      </div>
    </div>

    <table>
      <thead><tr><th>Description</th><th class="c">SAC</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">GST</th><th class="n">Amount</th></tr></thead>
      <tbody>${rows(ctx.items)}</tbody>
    </table>

    <div class="foot">
      <div>
        <div class="words">Amount in words<strong>${e(amountInWords(t.total))}</strong></div>
        ${quote ? '' : `<span class="status ${e(t.status)}">${t.status === 'paid' ? 'Paid in full' : t.status === 'partial' ? 'Partially paid' : 'Payment due'}</span>`}
      </div>
      <div class="sum">
        ${t.discount ? `<div class="r"><span>Subtotal</span><span>${formatCurrency(itemsSum(ctx))}</span></div><div class="r"><span>Discount</span><span>− ${formatCurrency(t.discount)}</span></div>` : ''}
        ${taxSummaryRows(ctx, docType)}
        <div class="r grand"><span>${quote ? 'Estimated Total' : 'Grand Total'}</span><span>${formatCurrency(t.total)}</span></div>
        ${quote ? '' : `<div class="r"><span>Amount paid</span><span>${formatCurrency(t.paid)}</span></div><div class="r bal"><span>Balance due</span><span>${formatCurrency(t.balance)}</span></div>`}
      </div>
    </div>

    ${quote ? quotationExtras(ctx, PAL) : ''}
    ${paymentBlock(ctx, PAL)}

    <div class="foota">
      <div>${quote ? 'This is a computer-generated quotation.' : 'This is a computer-generated invoice and does not require a physical signature.'}<br><span class="brand">${e(ctx.hotel.name)}</span>${ctx.hotel.website ? ` · ${e(ctx.hotel.website)}` : ''}</div>
      <div class="sign"><div class="l"></div><div class="t">For ${e(ctx.hotel.name)}</div></div>
    </div>
  </div>
</div></body></html>`;
};

export const meta = {
  id: 'corporate',
  name: 'Corporate Professional',
  description: 'Refined navy-and-gold GST tax invoice with HSN/SAC codes and a brand watermark — built for conferences, meetings and corporate events.',
};
