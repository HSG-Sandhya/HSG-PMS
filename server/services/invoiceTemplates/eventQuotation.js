// Printable A4 sheet for a standalone event quotation (EventQuotation) — the
// sales proposal sent to a prospect before any booking exists. Packages print
// as side-by-side comparison columns, followed by chargeable add-ons,
// complimentary services, terms and the two signature blocks.
//
// This renderer is intentionally self-contained (no normalize.js context): a
// quotation has no booking, no line-item costing and no payment state.
import { escapeHtml as e, formatCurrency, formatDate, formatLongDate, formatTime } from './formatters.js';
import { packageTotal, addOnTotal } from '../quotationPricing.js';

// Navy + gold: the hotel's print identity. Kept in one place so the whole sheet
// stays in tune.
const C = {
  navy: '#12224a',
  navySoft: '#1c3467',
  gold: '#b58a34',
  goldSoft: '#f4ecdc',
  ink: '#1f2937',
  muted: '#6b7280',
  line: '#e3e7ef',
  paper: '#fbfaf7',
};

// Ordered union of the section titles used across every package, so the
// comparison table has one row per inclusion block with each column filling in
// its own items (blank where a package doesn't offer that block).
const sectionRows = (packages) => {
  const order = [];
  for (const pkg of packages) {
    for (const sec of (pkg.sections || [])) {
      const title = (sec.title || '').trim();
      if (title && !order.includes(title)) order.push(title);
    }
  }
  return order;
};

const itemsFor = (pkg, title) => {
  const sec = (pkg.sections || []).find((s) => (s.title || '').trim() === title);
  return (sec?.items || []).filter(Boolean);
};

// "₹700/- per plate" — the headline price line under each package name.
const priceLine = (pkg) => `${formatCurrency(pkg.price)}/- <span class="basis">${e(pkg.priceBasis || '')}</span>`;

// The "Prepared for" facts. Blank values still print with a rule so the sheet
// can be filled in by hand when the enquiry details aren't known yet.
const preparedFor = (q) => {
  const timing = q.startTime
    ? `${formatTime(q.startTime)}${q.endTime ? ` – ${formatTime(q.endTime)}` : ''}`
    : '';
  return [
    ['Client Name', q.clientCompany || q.clientName],
    ['Contact Person', q.clientCompany ? q.clientName : ''],
    ['Mobile', q.clientPhone],
    ['Event Type', q.eventTitle || q.eventType],
    ['Event Date', q.eventDate ? formatLongDate(q.eventDate) : ''],
    ['Timing', timing],
    ['Expected Guests', q.expectedGuests ? `${q.expectedGuests} pax` : ''],
    ['Seating Style', q.seatingStyle],
  ].filter(([, v]) => v !== undefined);
};

const DEFAULT_TERMS = [
  '50% advance payment required for booking confirmation.',
  'Remaining amount must be paid 48 hours before the event.',
  'Prices are per the basis mentioned against each package.',
  'Outside food or catering vendors are not permitted.',
  'Additional decorations or customized menus are chargeable.',
  'GST applicable as per Government norms.',
];

export const renderEventQuotation = ({ quotation: q, hotel = {} }) => {
  const packages = (q.packages || []).filter((p) => p && p.name);
  const rows = sectionRows(packages);
  const addOns = (q.addOns || []).filter((a) => a && a.name);
  const complimentary = (q.complimentary || []).filter(Boolean);
  const terms = (q.terms || []).filter(Boolean);
  const termsList = terms.length ? terms : DEFAULT_TERMS;
  // Two balanced columns of terms, like the reference sheet.
  const half = Math.ceil(termsList.length / 2);

  const cols = Math.max(1, packages.length);
  const heading = `${(q.eventTitle || q.eventType || 'Event').toUpperCase()} QUOTATION`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Quotation ${e(q.quotationNumber || '')} — ${e(hotel.name || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;color:${C.ink};background:#eceff4;font-size:11px}
  .sheet{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:11mm 10mm;
    box-shadow:0 20px 50px -18px rgba(18,34,74,.35);display:flex;flex-direction:column;
    border:1.5px solid ${C.gold};outline:4px solid #fff;outline-offset:-7px}

  /* ── Letterhead ─────────────────────────────────────────────── */
  .head{display:flex;gap:14px;align-items:stretch;border-bottom:2px solid ${C.gold};padding-bottom:10px}
  .brand{flex:1.35;display:flex;gap:12px;align-items:center}
  .logo{width:62px;height:62px;flex:none;border-radius:8px;display:grid;place-items:center;overflow:hidden;
    background:${C.navy};color:#fff;font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:700}
  .logo img{width:100%;height:100%;object-fit:contain}
  .hname{font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:700;color:${C.navy};line-height:1.1;letter-spacing:.01em}
  .htag{font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;color:${C.gold};font-weight:700;margin:5px 0 6px}
  .hmeta{font-size:9px;color:${C.muted};line-height:1.65}
  .stub{flex:1;border:1px solid ${C.line};border-radius:6px;overflow:hidden;align-self:flex-start;min-width:210px}
  .stub .cap{background:${C.navy};color:#fff;text-align:center;padding:6px;font-size:11px;font-weight:800;letter-spacing:.22em}
  .stub .body{padding:8px 11px}
  .kv{display:flex;justify-content:space-between;gap:10px;font-size:9.5px;padding:2.5px 0}
  .kv .k{color:${C.muted};font-weight:500}
  .kv .v{color:${C.navy};font-weight:700;text-align:right}
  .kv .v.blank{display:block;min-width:88px;border-bottom:1px solid ${C.line}}

  /* ── Prepared-for band ──────────────────────────────────────── */
  .prep{margin-top:10px;border:1px solid ${C.line};border-radius:6px;background:${C.paper};padding:9px 12px}
  .prep h4{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:${C.gold};font-weight:800;margin-bottom:7px}
  .prep .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px 20px}
  /* Prepared-for facts stack label over value so long company names stay legible. */
  .prep .kv{display:block;padding:0}
  .prep .kv .k{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};font-weight:700}
  .prep .kv .v{display:block;text-align:left;font-size:10px;margin-top:1px;line-height:1.35}
  .prep .kv .v.blank{min-width:0;height:12px;margin-top:3px}

  /* ── Title ──────────────────────────────────────────────────── */
  .title{text-align:center;margin:15px 0 4px}
  .title h1{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:${C.navy};letter-spacing:.03em}
  .title .rule{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:5px;color:${C.gold}}
  .title .rule i{height:1px;width:52px;background:${C.gold};opacity:.55}
  .title p{font-size:9.5px;color:${C.muted};margin-top:6px;letter-spacing:.06em}

  /* ── Package comparison ─────────────────────────────────────── */
  .band{background:${C.navy};color:#fff;text-align:center;font-size:9.5px;font-weight:800;
    letter-spacing:.2em;text-transform:uppercase;padding:6px;border-radius:5px 5px 0 0;margin-top:12px}
  table.pk{width:100%;border-collapse:collapse;table-layout:fixed}
  table.pk th,table.pk td{border:1px solid ${C.line};vertical-align:top;padding:8px 10px}
  table.pk thead th{background:#f4f6fa;color:${C.navy};font-size:9px;letter-spacing:.16em;
    text-transform:uppercase;font-weight:800;text-align:center;padding:7px 8px}
  .rowlbl{width:${Math.round(100 / (cols + 2.6))}%;background:${C.paper};color:${C.navy};
    font-size:9px;letter-spacing:.11em;text-transform:uppercase;font-weight:800;text-align:center;vertical-align:middle}
  .rowlbl small{display:block;font-size:8px;letter-spacing:.04em;text-transform:none;color:${C.muted};font-weight:600;margin-top:2px}
  .pkname{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:700;color:${C.navy};letter-spacing:.01em}
  .pktag{font-size:8.5px;color:${C.muted};margin-top:2px;font-weight:500}
  .ribbon{display:inline-block;margin-top:4px;background:${C.goldSoft};color:${C.gold};
    border:1px solid ${C.gold};border-radius:99px;padding:1.5px 8px;font-size:7.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .price{text-align:center;font-size:17px;font-weight:800;color:${C.navy};font-variant-numeric:tabular-nums}
  .price .basis{display:block;font-size:8.5px;font-weight:600;color:${C.muted};letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
  .est{text-align:center;font-size:8.5px;color:${C.gold};font-weight:700;margin-top:3px}
  ul.inc{list-style:none}
  ul.inc li{position:relative;padding:0 0 3px 11px;font-size:9.5px;line-height:1.5;color:${C.ink}}
  ul.inc li::before{content:'';position:absolute;left:0;top:6px;width:4px;height:4px;border-radius:50%;background:${C.gold}}
  .dash{color:#c3c9d6;font-size:10px;text-align:center}
  .note{font-size:8.5px;color:${C.muted};text-align:center;padding:6px 0 0;font-style:italic}

  /* ── Add-ons / complimentary ────────────────────────────────── */
  .sect{margin-top:12px;border:1px solid ${C.line};border-radius:6px;overflow:hidden}
  .sect .cap{background:${C.navy};color:#fff;text-align:center;font-size:9px;font-weight:800;
    letter-spacing:.2em;text-transform:uppercase;padding:5px}
  .addons{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));padding:10px 6px}
  .addon{text-align:center;padding:0 10px;border-right:1px solid ${C.line}}
  .addon:last-child{border-right:none}
  .addon .n{font-size:9px;font-weight:800;color:${C.navy};letter-spacing:.1em;text-transform:uppercase}
  .addon .p{font-size:14px;font-weight:800;color:${C.ink};margin-top:3px;font-variant-numeric:tabular-nums}
  .addon .u{font-size:8px;color:${C.muted};margin-top:2px}
  .comp{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));padding:9px 6px;gap:4px}
  .comp div{text-align:center;padding:0 7px;border-right:1px solid ${C.line};font-size:8.5px;
    line-height:1.45;color:${C.ink};font-weight:600}
  .comp div:last-child{border-right:none}
  .comp .tick{display:block;color:${C.gold};font-size:12px;margin-bottom:2px}

  /* ── Terms + signatures ─────────────────────────────────────── */
  .terms{margin-top:12px;border:1px solid ${C.line};border-radius:6px;padding:9px 12px 10px}
  .terms h4{text-align:center;font-size:9px;letter-spacing:.2em;text-transform:uppercase;
    color:${C.navy};font-weight:800;margin-bottom:7px}
  .terms .cols{display:grid;grid-template-columns:1fr 1fr;gap:2px 22px}
  .terms li{position:relative;list-style:none;padding:0 0 3px 11px;font-size:8.5px;line-height:1.5;color:${C.ink}}
  .terms li::before{content:'•';position:absolute;left:2px;color:${C.gold};font-weight:700}
  .memo{margin-top:9px;font-size:9px;color:${C.muted};line-height:1.55}
  .memo b{color:${C.navy}}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
  .sign{border:1px solid ${C.line};border-radius:6px;padding:8px 12px 10px;text-align:center}
  .sign .t{font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${C.navy}}
  .sign .s{font-size:9px;color:${C.muted};margin-top:3px}
  .sign .l{border-bottom:1px solid ${C.navy};margin:26px 12px 5px}
  .sign .c{font-size:8.5px;color:${C.muted}}
  .foot{margin-top:auto;padding-top:11px;text-align:center}
  .foot .ty{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:700;color:${C.navy}}
  .foot .sl{font-size:8.5px;color:${C.gold};font-style:italic;margin-top:2px}
  .foot .bar{margin-top:7px;border-top:1px solid ${C.gold};padding-top:6px;font-size:8.5px;color:${C.muted};
    display:flex;justify-content:center;gap:16px;flex-wrap:wrap}

  @page{size:A4;margin:0}
  @media print{
    body{background:#fff}
    .sheet{margin:0;width:auto;min-height:auto;box-shadow:none}
    .sect,.terms,.signs,table.pk tr{break-inside:avoid}
  }
</style></head>
<body><div class="sheet">

  <div class="head">
    <div class="brand">
      <div class="logo">${hotel.logo ? `<img src="${e(hotel.logo)}" alt="">` : e((hotel.name || 'S').charAt(0))}</div>
      <div>
        <div class="hname">${e(hotel.name || 'Hotel Sandhya Grand & Marriage Hall')}</div>
        <div class="htag">Luxury Banquet &middot; Rooms &middot; Events</div>
        <div class="hmeta">
          ${hotel.address ? `${e(hotel.address)}<br>` : ''}
          ${hotel.contact?.email ? `${e(hotel.contact.email)}` : ''}${hotel.contact?.email && hotel.contact?.phone ? ' &nbsp;|&nbsp; ' : ''}${hotel.contact?.phone ? `+91 ${e(hotel.contact.phone)}` : ''}
          ${hotel.gstin ? `<br>GSTIN ${e(hotel.gstin)}` : ''}
        </div>
      </div>
    </div>
    <div class="stub">
      <div class="cap">QUOTATION</div>
      <div class="body">
        <div class="kv"><span class="k">Quotation No.</span><span class="v">${e(q.quotationNumber || '—')}</span></div>
        <div class="kv"><span class="k">Quotation Date</span><span class="v">${formatDate(q.quotationDate)}</span></div>
        <div class="kv"><span class="k">Valid Upto</span><span class="v">${formatDate(q.validUpto)}</span></div>
        ${q.preparedBy ? `<div class="kv"><span class="k">Executive</span><span class="v">${e(q.preparedBy)}</span></div>` : ''}
      </div>
    </div>
  </div>

  <div class="prep">
    <h4>Prepared For</h4>
    <div class="grid">
      ${preparedFor(q).map(([k, v]) => `<div class="kv"><span class="k">${e(k)}</span>${v ? `<span class="v">${e(v)}</span>` : '<span class="v blank"></span>'}</div>`).join('')}
    </div>
  </div>

  <div class="title">
    <div class="rule"><i></i>&#10022;<i></i></div>
    <h1>${e(heading)}</h1>
    <div class="rule"><i></i>&#10022;<i></i></div>
    <p>Conference &middot; Meeting &middot; Seminar &middot; Corporate Events &middot; Celebrations</p>
  </div>

  ${packages.length ? `
  <div class="band">Event packages ${q.hallName ? `&middot; ${e(q.hallName)}` : '(AC Hall)'}</div>
  <table class="pk">
    <thead>
      <tr>
        <th class="rowlbl">Package</th>
        ${packages.map((p) => `<th>
          <div class="pkname">${e(p.name)}</div>
          ${p.tagline ? `<div class="pktag">${e(p.tagline)}</div>` : ''}
          ${p.recommended ? '<div class="ribbon">Recommended</div>' : ''}
        </th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="rowlbl">Price</td>
        ${packages.map((p) => {
          const total = packageTotal(p, q.expectedGuests);
          const showEst = p.priceBasis !== 'lump sum' && total > 0;
          return `<td>
            <div class="price">${priceLine(p)}</div>
            ${showEst ? `<div class="est">Est. ${formatCurrency(total)} for ${e(String(Number(p.quantity) || Number(q.expectedGuests) || 0))}${Number(p.days) > 1 ? ` × ${e(String(p.days))} days` : ''}</div>` : ''}
          </td>`;
        }).join('')}
      </tr>
      ${rows.map((title) => `<tr>
        <td class="rowlbl">${e(title.replace(/\s*\(.*\)$/, ''))}${/\(.*\)$/.test(title) ? `<small>${e((title.match(/\((.*)\)$/) || [, ''])[1])}</small>` : ''}</td>
        ${packages.map((p) => {
          const list = itemsFor(p, title);
          return `<td>${list.length
            ? `<ul class="inc">${list.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`
            : '<div class="dash">—</div>'}</td>`;
        }).join('')}
      </tr>`).join('')}
      ${packages.some((p) => p.notes) ? `<tr>
        <td class="rowlbl">Notes</td>
        ${packages.map((p) => `<td>${p.notes ? `<div style="font-size:9px;color:${C.muted};line-height:1.5">${e(p.notes)}</div>` : '<div class="dash">—</div>'}</td>`).join('')}
      </tr>` : ''}
    </tbody>
  </table>
  <div class="note">Menu items are subject to availability &amp; may be changed without prior notice.</div>` : ''}

  ${addOns.length ? `
  <div class="sect">
    <div class="cap">Additional Facilities (Optional)</div>
    <div class="addons">
      ${addOns.map((a) => `<div class="addon">
        <div class="n">${e(a.name)}</div>
        <div class="p">${formatCurrency(a.price)}/-</div>
        <div class="u">${a.gstPercent ? `+ ${e(String(a.gstPercent))}% GST &middot; ` : ''}${e(a.unit || '')}</div>
        ${a.gstPercent ? `<div class="u">Gross ${formatCurrency(addOnTotal(a))}</div>` : ''}
        ${a.note ? `<div class="u">${e(a.note)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${complimentary.length ? `
  <div class="sect">
    <div class="cap">Complimentary Services</div>
    <div class="comp">
      ${complimentary.map((x) => `<div><span class="tick">&#10022;</span>${e(x)}</div>`).join('')}
    </div>
  </div>` : ''}

  <div class="terms">
    <h4>Terms &amp; Conditions</h4>
    <div class="cols">
      <ul>${termsList.slice(0, half).map((t) => `<li>${e(t)}</li>`).join('')}</ul>
      <ul>${termsList.slice(half).map((t) => `<li>${e(t)}</li>`).join('')}</ul>
    </div>
    ${q.notes ? `<div class="memo"><b>Note:</b> ${e(q.notes)}</div>` : ''}
  </div>

  <div class="signs">
    <div class="sign">
      <div class="t">Prepared By</div>
      <div class="s">${e(hotel.name || '')}</div>
      <div class="l"></div>
      <div class="c">Authorised Signatory${q.preparedBy ? ` — ${e(q.preparedBy)}` : ''}</div>
    </div>
    <div class="sign">
      <div class="t">Customer Acceptance</div>
      <div class="s">${e(q.clientCompany || q.clientName || '')}</div>
      <div class="l"></div>
      <div class="c">Client Signature &amp; Date</div>
    </div>
  </div>

  <div class="foot">
    <div class="ty">Thank you for choosing ${e(hotel.name || 'us')}.</div>
    <div class="sl">"Making Every Celebration Memorable"</div>
    <div class="bar">
      <span>${e(hotel.contact?.website || 'www.sandhyagrand.in')}</span>
      ${hotel.contact?.email ? `<span>${e(hotel.contact.email)}</span>` : ''}
      ${hotel.contact?.phone ? `<span>+91 ${e(hotel.contact.phone)}</span>` : ''}
    </div>
  </div>

</div></body></html>`;
};

export default renderEventQuotation;
