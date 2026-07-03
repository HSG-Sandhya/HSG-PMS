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

// A quotation is valid for 15 days from issue.
export const validUntil = (ctx) => {
  const base = ctx?.invoice?.issuedOn ? new Date(ctx.invoice.issuedOn) : new Date();
  return formatLongDate(new Date(base.getTime() + 15 * 24 * 60 * 60 * 1000));
};

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
  // Show the actual advance already received; if none, fall back to the
  // standard 50%-to-confirm figure so the schedule is still meaningful.
  const hasAdvance = paid > 0;
  const advance = hasAdvance ? paid : Math.round(total / 2);
  const balance = hasAdvance
    ? (Number(ctx.totals.balance) || Math.max(0, total - paid))
    : Math.max(0, total - advance);
  const advLabel = hasAdvance ? 'Advance received' : 'Advance to confirm (50%)';
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
      ${POLICY.map((x) => `<li style="margin:0 0 6px;line-height:1.55">${e(x)}</li>`).join('')}
    </ol>
  </section>`;
  })()}`;
};
