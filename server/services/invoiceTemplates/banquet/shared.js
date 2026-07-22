// Shared building blocks for the six banquet invoice / quotation templates.
// Each template owns its own markup + CSS for a distinct look, but pulls the
// data-shaping (event facts, cost sections, quotation extras) from here so the
// numbers and copy stay consistent across designs.
//
// Note: these documents do NOT show a GST/tax breakdown — line amounts roll
// straight up into a single total. The quotation carries extra detail (payment
// schedule, inclusions, section breakdown, policy) that the invoice omits.
import { escapeHtml as e, formatCurrency, formatLongDate, formatTime } from '../formatters.js';

export const isQuote = (docType) => docType === 'quotation';

// Human labels for the two document modes.
export const docLabels = (docType) => (isQuote(docType)
  ? { title: 'Quotation', short: 'Quotation', kicker: 'Estimate for your event' }
  : { title: 'Invoice', short: 'Invoice', kicker: 'Invoice for services rendered' });

// The letterhead contact lines, in print order: address, phone numbers,
// email + website, then GSTIN. Rendered to the RIGHT of the logo in the compact
// header every template now uses. Returns escaped HTML strings — join with <br>.
export const letterheadLines = (hotel = {}) => {
  const phones = [
    hotel.phone ? `Mobile ${hotel.phone}` : '',
    hotel.landline ? `Landline ${hotel.landline}` : '',
  ].filter(Boolean).join(' · ');
  const web = [hotel.email, hotel.website].filter(Boolean).join(' · ');
  return [hotel.address, phones, web, hotel.gstin ? `GSTIN ${hotel.gstin}` : '']
    .filter(Boolean)
    .map((s) => e(s));
};

// The "Payment Details" panel: the hotel's bank account (for NEFT/IMPS) on the
// left and a UPI "scan & pay" QR on the right. Data comes from Accounting via
// ctx.bank (set in banquetIndex.js). Renders nothing when no account is set.
//   pal = { accent, ink, muted, line, soft }
export const paymentBlock = (ctx, pal) => {
  const b = ctx.bank;
  if (!b || (!b.accountNumber && !b.upiId)) return '';
  const { accent, ink, muted, line, soft } = pal;
  const rows = [
    ['Account Holder', b.accountHolder],
    ['Bank', b.bankName],
    ['A/C No.', b.accountNumber],
    ['IFSC', b.ifsc],
    ['Branch', b.branch],
  ].filter(([, v]) => v && String(v).trim());
  const qr = b.qrSvg
    ? `<div style="text-align:center">
         ${b.qrSvg}
         <div style="font-size:9px;color:${muted};margin-top:4px;letter-spacing:.02em">Scan &amp; pay with any UPI app</div>
         ${b.upiId ? `<div style="font-size:10.5px;color:${ink};font-weight:700;margin-top:1px">${e(b.upiId)}</div>` : ''}
       </div>`
    : (b.upiId
      ? `<div style="text-align:center"><div style="font-size:9px;color:${muted};letter-spacing:.12em;text-transform:uppercase">UPI</div><div style="font-size:11px;font-weight:700;color:${ink}">${e(b.upiId)}</div></div>`
      : '');
  return `
  <section style="margin-top:14px;border:1px solid ${line};border-radius:10px;padding:12px 16px;background:${soft};break-inside:avoid;display:grid;grid-template-columns:1fr ${qr ? 'auto' : ''};gap:22px;align-items:center">
    <div>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:8px">Payment Details</div>
      <table style="border-collapse:collapse;font-size:11.5px">
        ${rows.map(([k, v]) => `<tr><td style="color:${muted};padding:2px 14px 2px 0;white-space:nowrap;vertical-align:top">${e(k)}</td><td style="color:${ink};font-weight:600">${e(v)}</td></tr>`).join('')}
      </table>
    </div>
    ${qr ? `<div>${qr}</div>` : ''}
  </section>`;
};

// ── "Billed to" / "Prepared for" party block ────────────────────────────────
// All six designs render this identically, so the content lives here and each
// template only supplies its own wrapper classes.
//
// On a GST invoice the registered business is the billed party, so a company
// name takes the headline and the individual drops to a contact line. The GSTIN
// is emphasised — it is what the client's accountant looks for to claim input
// credit, and an invoice missing it is not claimable.
export const billedToTitle = (ctx) =>
  ctx.customer?.company || ctx.customer?.name || 'Guest';

export const billedToLines = (ctx) => {
  const c = ctx.customer || {};
  const parts = [];
  if (c.company && c.name && c.name.trim() !== c.company.trim()) {
    parts.push(`Attn: ${e(c.name)}`);
  }
  if (c.phone) parts.push(e(c.phone));
  if (c.email) parts.push(e(c.email));
  if (c.address) parts.push(e(c.address));
  if (c.gstin) parts.push(`<strong>GSTIN ${e(c.gstin)}</strong>`);
  return parts.join('<br>');
};

// Ordered [label, value] pairs describing the event — drives the "event card".
export const eventFacts = (ctx) => {
  const ev = ctx.event || {};
  const rows = [];
  if (ev.hallName) rows.push(['Venue', ev.hallName]);
  if (ev.type) rows.push(['Occasion', ev.type]);
  if (ev.date) rows.push(['Event date', formatLongDate(ev.date)]);
  if (ev.startTime) {
    rows.push(['Timing', `${formatTime(ev.startTime)}${ev.endTime ? ` – ${formatTime(ev.endTime)}` : ''}`]);
  }
  if (ev.guests) rows.push(['Expected guests', `${ev.guests} pax`]);
  return rows;
};

// A quotation is valid for a configurable window (Settings → Operations →
// Banquet). Falls back to 15 days when no config is supplied.
export const validUntil = (ctx) => {
  const days = Number(ctx?.banquet?.quotationValidityDays) || 15;
  const base = ctx?.invoice?.issuedOn ? new Date(ctx.invoice.issuedOn) : new Date();
  return formatLongDate(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
};

// SAC (Service Accounting Code) per banquet line, for GST tax invoices. Banquet
// event services sit under 9963xx; 996334 (catering / marriage / event /
// conference services) is the sensible default, with reserved guest rooms billed
// as accommodation (996311) and décor under 998596. Kept banquet-specific so it
// never disturbs the room/restaurant SAC map in formatters.js.
const BANQUET_SAC = {
  hall: '996334', rooms: '996311', decoration: '998596',
  catering: '996334', meals: '996334', side: '996334', extra: '996334',
  photography: '998383',
};
export const banquetSac = (category) => BANQUET_SAC[category] || '996334';

// Short human tag for a line-item category (used as a pill on some designs).
export const categoryTag = (category) => ({
  hall: 'Venue',
  rooms: 'Rooms',
  decoration: 'Décor',
  catering: 'Catering',
  meals: 'Catering',
  side: 'Add-on',
  extra: 'Add-on',
  photography: 'Media',
}[category] || 'Service');

// Sum of the line-item amounts (the pre-discount subtotal).
export const itemsSum = (ctx) =>
  (ctx.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);

// The GST cell for one line in the items table. Shows the PER-UNIT tax (to match
// the per-unit Rate beside it) — e.g. the GST on one plate, not the whole line —
// so Rate + GST is the per-unit taxed price and × Qty gives the Amount. Blank
// (an en dash) when the line carries no tax.
export const gstCell = (it) => {
  const gst = Number(it?.gstAmount) || 0;
  if (!(gst > 0)) return '—';
  const qty = Math.max(1, Number(it?.quantity) || 1);
  return formatCurrency(Math.round(gst / qty));
};

// The tax-summary rows injected into a template's totals block on an INVOICE:
// taxable value, then CGST and SGST (each half of the 18% total). Returns '' for
// a quotation (which carries its own estimate breakdown) or when there is no
// tax to show. Each row is a plain `<div class="r"><span>…</span><span>…</span></div>`
// so it drops straight into every template's `.sum` list.
export const taxSummaryRows = (ctx, docType) => {
  if (isQuote(docType)) return '';
  const t = ctx.totals || {};
  const gst = Number(t.gstTotal != null ? t.gstTotal : (Number(t.cgst) || 0) + (Number(t.sgst) || 0));
  if (!(gst > 0)) return '';
  return `
    <div class="r"><span>Taxable value</span><span>${formatCurrency(t.subtotal)}</span></div>
    <div class="r"><span>CGST @ 9%</span><span>${formatCurrency(t.cgst)}</span></div>
    <div class="r"><span>SGST @ 9%</span><span>${formatCurrency(t.sgst)}</span></div>`;
};

// ── Quotation-only building blocks ──────────────────────────────────────────

const SECTION_OF = {
  hall: 'Venue & Hall',
  rooms: 'Venue & Hall',
  decoration: 'Decoration',
  catering: 'Catering & Menu',
  meals: 'Catering & Menu',
  side: 'Add-ons & Extras',
  extra: 'Add-ons & Extras',
  photography: 'Media & Services',
};

// Group the line items into named sections with per-section subtotals.
export const sectionBreakdown = (ctx) => {
  const map = {};
  for (const it of (ctx.items || [])) {
    const sec = SECTION_OF[it.category] || 'Other Services';
    if (!map[sec]) map[sec] = { section: sec, items: [], subtotal: 0 };
    map[sec].items.push(it);
    map[sec].subtotal += Number(it.amount) || 0;
  }
  return Object.values(map);
};

// A "what's included" list drawn from the itemised services.
export const inclusionsList = (ctx) =>
  (ctx.items || []).map((it) => (it.detail ? `${it.description} (${it.detail})` : it.description));

// Expanded booking & cancellation policy shown on the quotation.
export const POLICY = [
  'This quotation is valid for 15 days from the date of issue and is subject to availability.',
  'A 50% advance confirms the booking; the balance is payable on or before the event day.',
  'The final guest count must be confirmed at least 72 hours before the event.',
  'Any additional services or menu changes requested later will be billed separately.',
  'Cancellation 7 or more days before the event: 50% of the advance is refundable.',
  'Cancellation within 7 days of the event: the advance paid is non-refundable.',
];

// The full quotation-extras block: payment schedule, inclusions, cost breakdown
// by section, and booking policy. Palette-driven so it matches each template.
//   pal = { accent, ink, muted, line, soft }
export const quotationExtras = (ctx, pal) => {
  const { accent, ink, muted, line, soft } = pal;
  const total = Number(ctx.totals.total) || 0;
  const paid = Number(ctx.totals.paid) || 0;
  // Advance %, minimum advance and validity window are configurable (Settings →
  // Operations → Banquet); fall back to the historical 50% / 15-day figures.
  const pct = Number(ctx?.banquet?.advancePercent);
  const advancePct = Number.isFinite(pct) && pct > 0 ? pct : 50;
  const minAdvance = Number(ctx?.banquet?.minAdvanceAmount) || 0;
  const validityDays = Number(ctx?.banquet?.quotationValidityDays) || 15;
  // Show the actual advance already received; if none, fall back to the
  // configured %-to-confirm figure so the schedule is still meaningful.
  const hasAdvance = paid > 0;
  const computedAdvance = Math.min(Math.max(Math.round(total * advancePct / 100), minAdvance), total);
  const advance = hasAdvance ? paid : computedAdvance;
  const balance = hasAdvance
    ? (Number(ctx.totals.balance) || Math.max(0, total - paid))
    : Math.max(0, total - advance);
  const advLabel = hasAdvance ? 'Advance received' : `Advance to confirm (${advancePct}%)`;
  const advNote = hasAdvance ? 'Paid towards booking' : 'Due on confirmation';
  const eventDate = ctx.event?.date ? formatLongDate(ctx.event.date) : 'the event day';
  const sections = sectionBreakdown(ctx);
  const inclusions = inclusionsList(ctx);

  const h = (txt) => `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700;margin:0 0 11px">${e(txt)}</div>`;
  const card = (label, amount, note) => `
    <div style="border:1px solid ${line};border-radius:12px;padding:14px 16px;background:${soft};break-inside:avoid">
      <div style="font-size:11px;color:${muted};font-weight:600">${e(label)}</div>
      <div style="font-size:19px;font-weight:800;color:${ink};margin:5px 0 2px;font-variant-numeric:tabular-nums">${formatCurrency(amount)}</div>
      <div style="font-size:10.5px;color:${muted}">${e(note)}</div>
    </div>`;

  return `
  <section style="margin-top:26px;break-inside:avoid">
    ${h('Payment schedule')}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${card(advLabel, advance, advNote)}
      ${card('Balance', balance, `Due on ${eventDate}`)}
      ${card('Total estimate', total, 'Inclusive of all listed services')}
    </div>
  </section>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:24px">
    <section style="break-inside:avoid">
      ${h("What's included")}
      <ul style="list-style:none;margin:0;padding:0">
        ${inclusions.map((x) => `<li style="position:relative;padding:0 0 8px 20px;font-size:12px;color:${ink};line-height:1.5"><span style="position:absolute;left:0;color:${accent};font-weight:700">✓</span>${e(x)}</li>`).join('')}
      </ul>
    </section>
    <section style="break-inside:avoid">
      ${h('Cost breakdown')}
      <table style="width:100%;border-collapse:collapse">
        ${sections.map((s) => `<tr><td style="padding:8px 0;font-size:12px;color:${ink};border-bottom:1px solid ${line}">${e(s.section)}<div style="font-size:10.5px;color:${muted};margin-top:2px">${s.items.length} item${s.items.length > 1 ? 's' : ''}</div></td><td style="padding:8px 0;text-align:right;font-size:12px;font-weight:700;color:${ink};border-bottom:1px solid ${line};font-variant-numeric:tabular-nums">${formatCurrency(s.subtotal)}</td></tr>`).join('')}
        <tr><td style="padding:10px 0 0;font-size:13px;font-weight:800;color:${accent}">Estimated total</td><td style="padding:10px 0 0;text-align:right;font-size:13px;font-weight:800;color:${accent};font-variant-numeric:tabular-nums">${formatCurrency(total)}</td></tr>
      </table>
    </section>
  </div>

  ${(() => {
    // Per-booking contract terms the staff filled on the booking (shown above the
    // standard boilerplate). Blank fields are skipped.
    const t = ctx.terms || {};
    const rows = [
      ['Cancellation Policy', t.cancellation],
      ['Refund Policy', t.refund],
      ['Damage Charges', t.damage],
      ['Overtime Charges', t.overtime],
      ['Outside Vendor Policy', t.outsideVendor],
    ].filter(([, v]) => v && String(v).trim());
    return `
  <section style="margin-top:24px;break-inside:avoid">
    ${h('Booking & cancellation policy')}
    ${rows.length ? `<div style="margin:0 0 12px">
      ${rows.map(([label, val]) => `<div style="margin:0 0 7px;font-size:11.5px;line-height:1.5"><span style="font-weight:700;color:${ink}">${e(label)}:</span> <span style="color:${muted}">${e(val)}</span></div>`).join('')}
    </div>` : ''}
    <ol style="margin:0;padding:0 0 0 18px;color:${muted};font-size:11px">
      ${[
        `This quotation is valid for ${validityDays} days from the date of issue and is subject to availability.`,
        `A ${advancePct}% advance confirms the booking; the balance is payable on or before the event day.`,
        ...POLICY.slice(2),
      ].map((x) => `<li style="margin:0 0 6px;line-height:1.55">${e(x)}</li>`).join('')}
    </ol>
  </section>`;
  })()}`;
};
