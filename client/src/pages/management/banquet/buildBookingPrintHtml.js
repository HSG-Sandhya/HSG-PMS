// Builds the printable A4 booking sheet for one banquet booking.
// Pure function of the booking object; returns an HTML string that the print
// window writes. Extracted verbatim from the page's print button.
import { currencySym } from '../../../utils/billing';
import { hotelIdentity } from '../../../utils/hotelProfile';

export function buildBookingPrintHtml(booking) {
                              const id = hotelIdentity();
                              const decorationCost = (() => {
                                if (booking.decorationCost && booking.decorationCost > 0) return booking.decorationCost;
                                const m = { Standard: 15000, Premium: 25000, Custom: 0 };
                                return m[booking.decorationType] || 0;
                              })();
                              const menuEntries = (obj) => obj && typeof obj === 'object'
                                ? Object.entries(obj).filter(([, v]) => Number(v) > 0)
                                : [];
                              const comboEntries = menuEntries(booking.menu?.combo);
                              const beverageEntries = menuEntries(booking.menu?.beverages);
                              const extraEntries = menuEntries(booking.menu?.extra);
                              const sideEntries = menuEntries(booking.menu?.side);
                              // Catering packages selected on the booking form (source of truth).
                              const cateringList = (Array.isArray(booking.cateringItems) ? booking.cateringItems : [])
                                .filter((it) => it && (it.name || Number(it.perPlate) > 0 || Number(it.plates) > 0));
                              const cateringTotal = cateringList.reduce(
                                (s, it) => s + (Number(it.perPlate) || 0) * (Number(it.plates) || 0) * (Number(it.days) || 1), 0);
                              // Rented utensils / cookware (chargeable) selected on the booking.
                              const utensilList = (Array.isArray(booking.utensilItems) ? booking.utensilItems : [])
                                .filter((it) => it && (Number(it.quantity) > 0));
                              const utensilsTotal = utensilList.reduce(
                                (s, it) => s + (Number(it.amount) || (Number(it.cost) || 0) * (Number(it.quantity) || 0)), 0);
                              const total = booking.totalAmount || 0;
                              const paid = booking.advanceAmount || 0;
                              const balance = total - paid;
                              const statusKey = (booking.status || '').toLowerCase();
                              const issuedOn = new Date(booking.createdAt || booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                              const bookingRef = (booking._id || '').toString().slice(-6).toUpperCase() || '------';

                              const menuGroup = (title, entries) => entries.length === 0 ? '' : `
                                <div class="menu-group">
                                  <div class="menu-group-title">${title}</div>
                                  <ul class="menu-list">
                                    ${entries.map(([k, v]) => `<li><span>${k}</span><span class="qty">×${v}</span></li>`).join('')}
                                  </ul>
                                </div>`;

                              // ── Helpers + extended cards for the enhanced booking sheet ──
                              const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
                              const fmtMoney = (n) => `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN')}`;
                              const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                              const fact = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
                              const factFull = (label, value) => `<div class="full"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
                              const cardBlock = (title, meta, factsHtml) => !factsHtml ? '' : `
                                <div class="card">
                                  <div class="card-head"><div class="card-title">${esc(title)}</div>${meta ? `<span class="card-meta">${esc(meta)}</span>` : ''}</div>
                                  <dl class="facts">${factsHtml}</dl>
                                </div>`;

                              // Guests & venue
                              const guestFacts = [
                                booking.expectedGuests ? fact('Expected', booking.expectedGuests) : '',
                                booking.guaranteedGuests ? fact('Guaranteed', booking.guaranteedGuests) : '',
                                booking.vipGuests ? fact('VIP', booking.vipGuests) : '',
                                booking.kidsCount ? fact('Kids', booking.kidsCount) : '',
                                booking.venueCapacity ? fact('Venue Capacity', booking.venueCapacity) : '',
                                booking.seatingStyle ? fact('Seating', booking.seatingStyle) : '',
                              ].join('');

                              // Room booking
                              const roomFacts = [
                                booking.roomCheckIn ? fact('Check-in', fmtDate(booking.roomCheckIn)) : '',
                                booking.roomCheckOut ? fact('Check-out', fmtDate(booking.roomCheckOut)) : '',
                                (booking.roomTypes && booking.roomTypes.length) ? factFull('Room Types', booking.roomTypes.join(', ')) : '',
                                booking.complimentaryRooms ? fact('Complimentary', booking.complimentaryRooms) : '',
                                booking.extraBedRequired ? fact('Extra Bed', 'Yes') : '',
                              ].join('');

                              // Services & vendors
                              const photoTags = [
                                booking.photographyRequired ? 'Photography' : '',
                                booking.videographyRequired ? 'Videography' : '',
                                booking.droneCoverage ? 'Drone' : '',
                                booking.preWeddingShoot ? 'Pre-Wedding' : '',
                              ].filter(Boolean).join(', ');
                              const serviceFacts = [
                                (booking.additionalServices && booking.additionalServices.length) ? factFull('Additional', booking.additionalServices.join(', ')) : '',
                                (booking.decorationOptions && booking.decorationOptions.length) ? factFull('Decor Add-ons', booking.decorationOptions.join(', ')) : '',
                                booking.decorVendor ? fact('Decor Vendor', booking.decorVendor) : '',
                                photoTags ? factFull('Photo/Video', photoTags) : '',
                                booking.photographyVendor ? fact('Photo Vendor', booking.photographyVendor) : '',
                                booking.photographyAmount ? fact('Photo Amount', fmtMoney(booking.photographyAmount)) : '',
                                (booking.entertainmentOptions && booking.entertainmentOptions.length) ? factFull('Entertainment', booking.entertainmentOptions.join(', ')) : '',
                                booking.entertainmentVendor ? fact('Entertainment Vendor', booking.entertainmentVendor) : '',
                                booking.entertainmentCost ? fact('Entertainment Cost', fmtMoney(booking.entertainmentCost)) : '',
                              ].join('');

                              // Coordinator
                              const coordFacts = [
                                booking.salesExecutive ? fact('Sales Executive', booking.salesExecutive) : '',
                                booking.eventManager ? fact('Event Manager', booking.eventManager) : '',
                                booking.coordinatorPhone ? fact('Contact', booking.coordinatorPhone) : '',
                              ].join('');

                              // Terms
                              const termsFacts = [
                                booking.cancellationPolicy ? factFull('Cancellation', booking.cancellationPolicy) : '',
                                booking.refundPolicy ? factFull('Refund', booking.refundPolicy) : '',
                                booking.damageCharges ? fact('Damage Charges', booking.damageCharges) : '',
                                booking.overtimeCharges ? fact('Overtime', booking.overtimeCharges) : '',
                                booking.outsideVendorPolicy ? factFull('Outside Vendor', booking.outsideVendorPolicy) : '',
                                fact('Terms Accepted', booking.termsAccepted ? 'Yes' : 'No'),
                              ].join('');

                              const extraCardsHtml = [
                                cardBlock('Guests & Venue', '', guestFacts),
                                cardBlock('Room Booking', '', roomFacts),
                                cardBlock('Services & Vendors', '', serviceFacts),
                                cardBlock('Event Coordinator', '', coordFacts),
                                cardBlock('Contract & Terms', '', termsFacts),
                              ].join('');

                              // Payment schedule (installment plan) — full-width table card
                              const scheduleHtml = (Array.isArray(booking.paymentSchedule) && booking.paymentSchedule.length) ? `
                                <div class="card span-2">
                                  <div class="card-head"><div class="card-title">Payment Schedule</div></div>
                                  <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                    <thead>
                                      <tr style="text-align:left; color:#64748b;">
                                        <th style="padding:4px 6px; border-bottom:1px solid #e2e8f0;">Installment</th>
                                        <th style="padding:4px 6px; border-bottom:1px solid #e2e8f0;">Due Date</th>
                                        <th style="padding:4px 6px; border-bottom:1px solid #e2e8f0; text-align:right;">Amount</th>
                                        <th style="padding:4px 6px; border-bottom:1px solid #e2e8f0;">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${booking.paymentSchedule.map((p) => `
                                        <tr>
                                          <td style="padding:4px 6px; border-bottom:1px solid #f1f5f9;">${esc(p.label || '—')}</td>
                                          <td style="padding:4px 6px; border-bottom:1px solid #f1f5f9;">${fmtDate(p.dueDate)}</td>
                                          <td style="padding:4px 6px; border-bottom:1px solid #f1f5f9; text-align:right;">${fmtMoney(p.amount)}</td>
                                          <td style="padding:4px 6px; border-bottom:1px solid #f1f5f9;">${esc(p.status || 'Pending')}</td>
                                        </tr>`).join('')}
                                    </tbody>
                                  </table>
                                </div>` : '';

  return `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Banquet Hall Booking · ${booking.eventType || 'Event'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #fff; font-size: 11px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { max-width: 820px; margin: 0 auto; padding: 24px 0; }

  .masthead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 1px solid #0f172a; margin-bottom: 22px; }
  .brand-mark { font-family: 'Inter', sans-serif; font-size: 9px; letter-spacing: 0.32em; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 6px; }
  .brand-name { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; color: #0f172a; }
  .brand-meta { font-size: 10px; color: #475569; margin-top: 6px; line-height: 1.7; }
  .doc-meta { text-align: right; }
  .doc-tag { font-size: 9px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--app-primary); font-weight: 700; }
  .doc-ref { font-size: 18px; font-weight: 700; margin-top: 4px; letter-spacing: -0.01em; }
  .doc-date { font-size: 10px; color: #475569; margin-top: 4px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .span-2 { grid-column: 1 / -1; }

  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; background: #fafbff; }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  .card-title { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .card-meta { font-size: 9px; color: #94a3b8; }

  dl.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
  dl.facts .full { grid-column: 1 / -1; }
  dl.facts dt { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 2px; }
  dl.facts dd { font-size: 12px; color: #0f172a; font-weight: 500; line-height: 1.45; word-break: break-word; }

  .status-pill { display: inline-block; padding: 3px 11px; border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .status-confirmed { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }
  .status-completed { background: #e0e7ff; color: #3730a3; }

  .menu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin-top: 6px; }
  .menu-group { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #fff; }
  .menu-group-title { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--app-primary); font-weight: 700; margin-bottom: 6px; }
  .menu-list { list-style: none; }
  .menu-list li { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10.5px; color: #1f2937; border-bottom: 1px dotted #e2e8f0; }
  .menu-list li:last-child { border-bottom: none; }
  .menu-list .qty { font-weight: 700; color: var(--app-primary); font-variant-numeric: tabular-nums; }
  .menu-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
  .menu-table th { text-align: left; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
  .menu-table td { padding: 5px 8px; border-bottom: 1px dotted #e2e8f0; color: #1f2937; }
  .menu-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .menu-table tfoot td { font-weight: 700; color: var(--app-primary); border-top: 1px solid #cbd5e1; border-bottom: none; }
  .empty-note { font-size: 10px; color: #94a3b8; font-style: italic; padding: 6px 0; }

  .payment { padding: 18px 22px; border-radius: 8px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; }
  .payment-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .payment-head .title { font-size: 9px; letter-spacing: 0.28em; text-transform: uppercase; font-weight: 700; color: #cbd5e1; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .pay-cell { padding: 10px 12px; background: rgba(255, 255, 255, var(--app-surface-alpha, 0.05)); border: 1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08)); border-radius: 6px; }
  .pay-cell .lbl { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .pay-cell .val { font-size: 17px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .pay-cell.balance { background: rgba(245, 158, 11, 0.18); border-color: rgba(245, 158, 11, 0.4); }
  .pay-cell.balance .val { color: #fbbf24; }
  .pay-cell.settled { background: rgba(34, 197, 94, 0.18); border-color: rgba(34, 197, 94, 0.4); }
  .pay-cell.settled .val { color: #34d399; }

  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; }
  .sig { padding-top: 56px; border-top: 1px solid #0f172a; }
  .sig .label { font-size: 9px; letter-spacing: 0.24em; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .sig .name { font-size: 12px; font-weight: 600; margin-top: 4px; color: #0f172a; }

  .stamp { margin-top: 26px; text-align: center; font-size: 9px; color: #94a3b8; letter-spacing: 0.08em; }
  .stamp strong { color: #0f172a; font-family: 'Cormorant Garamond', serif; font-size: 13px; font-weight: 600; letter-spacing: 0.01em; }

  @media print {
    body { background: #fff; }
    .sheet { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="masthead">
      <div>
        <div class="brand-mark">Hotel · Marriage Hall · Est. 2019</div>
        <div class="brand-name">${id.hotelNameFull}</div>
        <div class="brand-meta">
          ${id.addressLine}<br />
          ${id.phone} · ${id.email}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-tag">Banquet Booking</div>
        <div class="doc-ref">#BQT-${bookingRef}</div>
        <div class="doc-date">Issued ${issuedOn}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <div class="card-title">Booking Information</div>
          <span class="status-pill status-${statusKey}">${booking.status || ''}</span>
        </div>
        <dl class="facts">
          ${booking.eventTitle ? `<div class="full"><dt>Event Title</dt><dd>${esc(booking.eventTitle)}</dd></div>` : ''}
          ${(booking.groomName || booking.brideName) ? `<div class="full"><dt>Couple</dt><dd>${esc([booking.groomName, booking.brideName].filter(Boolean).join(' & '))}</dd></div>` : ''}
          ${booking.eventDetails?.organizationName ? `<div class="full"><dt>Organization</dt><dd>${esc(booking.eventDetails.organizationName)}</dd></div>` : ''}
          ${booking.eventDetails?.contactPerson ? `<div class="full"><dt>Contact Person</dt><dd>${esc(booking.eventDetails.contactPerson)}</dd></div>` : ''}
          ${booking.eventDetails?.delegates ? `<div><dt>Attendees</dt><dd>${esc(booking.eventDetails.delegates)}</dd></div>` : ''}
          ${booking.eventDetails?.sessionsDays ? `<div><dt>Sessions / Days</dt><dd>${esc(booking.eventDetails.sessionsDays)}</dd></div>` : ''}
          ${booking.eventDetails?.birthdayPersonName ? `<div class="full"><dt>Birthday Person</dt><dd>${esc(booking.eventDetails.birthdayPersonName)}${booking.eventDetails.birthdayAge ? ` (turning ${esc(booking.eventDetails.birthdayAge)})` : ''}</dd></div>` : ''}
          ${booking.eventDetails?.theme ? `<div><dt>Theme</dt><dd>${esc(booking.eventDetails.theme)}</dd></div>` : ''}
          ${booking.eventDetails?.cakeRequired ? `<div class="full"><dt>Cake</dt><dd>Required${booking.eventDetails.cakeMessage ? ` — “${esc(booking.eventDetails.cakeMessage)}”` : ''}</dd></div>` : ''}
          ${booking.eventDetails?.celebrantNames ? `<div class="full"><dt>Celebrant(s)</dt><dd>${esc(booking.eventDetails.celebrantNames)}</dd></div>` : ''}
          ${booking.eventDetails?.occasionNote ? `<div class="full"><dt>Occasion</dt><dd>${esc(booking.eventDetails.occasionNote)}</dd></div>` : ''}
          ${booking.seatingStyle ? `<div><dt>Seating</dt><dd>${esc(booking.seatingStyle)}</dd></div>` : ''}
          ${booking.eventDetails?.avRequired ? `<div><dt>AV / Projector</dt><dd>Required</dd></div>` : ''}
          ${booking.eventDetails?.agenda ? `<div class="full"><dt>Agenda / Purpose</dt><dd>${esc(booking.eventDetails.agenda)}</dd></div>` : ''}
          <div><dt>Event Type</dt><dd>${booking.eventType || '—'}</dd></div>
          <div><dt>Guests</dt><dd>${booking.guestCount || '—'}</dd></div>
          <div class="full"><dt>Customer</dt><dd>${booking.customerName || '—'}</dd></div>
          <div><dt>Phone</dt><dd>${booking.customerPhone || '—'}</dd></div>
          <div><dt>Email</dt><dd>${booking.customerEmail || '—'}</dd></div>
          <div><dt>Date</dt><dd>${new Date(booking.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</dd></div>
          <div><dt>Time</dt><dd>${(booking.startTime && booking.endTime) ? `${booking.startTime} – ${booking.endTime}` : '—'}</dd></div>
        </dl>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">Venue &amp; Decoration</div>
          <span class="card-meta">${(booking.floorSelection && booking.floorSelection.length) ? `${booking.floorSelection.length} floor${booking.floorSelection.length > 1 ? 's' : ''}` : 'No floors'}</span>
        </div>
        <dl class="facts">
          <div class="full"><dt>Floors</dt><dd>${booking.floorSelection?.join(', ') || 'Not specified'}</dd></div>
          <div><dt>Floor Cost</dt><dd>${currencySym()}${(booking.floorCost || 0).toLocaleString('en-IN')}</dd></div>
          ${(booking.roomsCost || 0) > 0 ? `<div><dt>Reserved Rooms</dt><dd>${currencySym()}${(booking.roomsCost || 0).toLocaleString('en-IN')}</dd></div>` : ''}
          <div><dt>Decoration</dt><dd>${booking.decorationType || 'Standard'}</dd></div>
          <div><dt>Decoration Cost</dt><dd>${currencySym()}${decorationCost.toLocaleString('en-IN')}</dd></div>
        </dl>
      </div>

      <div class="card span-2">
        <div class="card-head">
          <div class="card-title">Catering &amp; Menu</div>
          <span class="card-meta">${cateringList.length
    ? `${cateringList.length} package${cateringList.length > 1 ? 's' : ''}${cateringTotal ? ` · ${fmtMoney(cateringTotal)}` : ''}`
    : (booking.menu?.hasMeals ? `Meal · ${booking.menu.mealType || 'N/A'}` : 'No meal package')}${(booking.numberOfPlates || booking.menu?.numberOfPlates) ? ` · ${booking.numberOfPlates || booking.menu.numberOfPlates} plates` : ''}</span>
        </div>
        ${cateringList.length ? `
          <table class="menu-table">
            <thead><tr><th>Catering Package</th><th>Meal</th><th>Category</th><th class="num">Per Plate</th><th class="num">Plates</th><th class="num">Days</th><th class="num">Amount</th></tr></thead>
            <tbody>
              ${cateringList.map((it) => {
    const amt = (Number(it.perPlate) || 0) * (Number(it.plates) || 0) * (Number(it.days) || 1);
    return `<tr><td>${esc(it.name || 'Catering Package')}</td><td>${esc(it.meal || '—')}</td><td>${esc(it.category || '—')}</td><td class="num">${fmtMoney(it.perPlate)}</td><td class="num">${Number(it.plates) || 0}</td><td class="num">${Number(it.days) || 1}</td><td class="num">${fmtMoney(amt)}</td></tr>`;
  }).join('')}
            </tbody>
            <tfoot><tr><td colspan="6">Catering Total</td><td class="num">${fmtMoney(cateringTotal)}</td></tr></tfoot>
          </table>
        ` : ''}
        ${(comboEntries.length || beverageEntries.length || extraEntries.length || sideEntries.length) ? `
          <div class="menu-grid">
            ${menuGroup('Combo selection', comboEntries)}
            ${menuGroup('Beverages', beverageEntries)}
            ${menuGroup('Side menu', sideEntries)}
            ${menuGroup('Extras', extraEntries)}
          </div>
        ` : ''}
        ${(!cateringList.length && !comboEntries.length && !beverageEntries.length && !extraEntries.length && !sideEntries.length)
    ? '<div class="empty-note">No menu items selected for this booking.</div>' : ''}
      </div>

      ${utensilList.length ? `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Utensils &amp; Cookware</div>
          <span class="card-meta">${utensilList.length} item${utensilList.length > 1 ? 's' : ''} · ${fmtMoney(utensilsTotal)}</span>
        </div>
        <table class="menu-table">
          <thead><tr><th>Utensil</th><th class="num">Rate</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${utensilList.map((it) => {
    const amt = Number(it.amount) || (Number(it.cost) || 0) * (Number(it.quantity) || 0);
    return `<tr><td>${esc(it.name || 'Utensil')}</td><td class="num">${fmtMoney(it.cost)}/${esc(it.unit || 'unit')}</td><td class="num">${Number(it.quantity) || 0}</td><td class="num">${fmtMoney(amt)}</td></tr>`;
  }).join('')}
          </tbody>
          <tfoot><tr><td colspan="3">Utensils Total</td><td class="num">${fmtMoney(utensilsTotal)}</td></tr></tfoot>
        </table>
      </div>
      ` : ''}

      ${extraCardsHtml}

      ${scheduleHtml}

      ${booking.specialRequests ? `
      <div class="card span-2">
        <div class="card-head">
          <div class="card-title">Special Requests</div>
        </div>
        <div style="font-size: 11.5px; color: #1f2937; line-height: 1.6;">${esc(booking.specialRequests)}</div>
      </div>
      ` : ''}

      <div class="span-2">
        <div class="payment">
          <div class="payment-head">
            <span class="title">Payment Summary</span>
            <span style="font-size: 10px; color: #cbd5e1;">${booking.paymentStatus || ''}</span>
          </div>
          <div class="payment-grid">
            <div class="pay-cell">
              <div class="lbl">Total</div>
              <div class="val">${currencySym()}${total.toLocaleString('en-IN')}</div>
            </div>
            <div class="pay-cell">
              <div class="lbl">Advance paid</div>
              <div class="val">${currencySym()}${paid.toLocaleString('en-IN')}</div>
            </div>
            <div class="pay-cell ${balance <= 0 ? 'settled' : 'balance'}">
              <div class="lbl">${balance <= 0 ? 'Settled' : 'Balance due'}</div>
              <div class="val">${currencySym()}${balance.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="label">Customer signature</div>
        <div class="name">${booking.customerName || ''}</div>
      </div>
      <div class="sig">
        <div class="label">Authorised signatory</div>
        <div class="name">${id.hotelName}</div>
      </div>
    </div>

    <div class="stamp">
      Thank you for choosing <strong>${id.hotelNameFull}</strong>.<br />
      Generated ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
</body>
</html>
  `;
}
