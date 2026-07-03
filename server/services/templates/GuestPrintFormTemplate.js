import BaseInvoiceTemplate from './BaseInvoiceTemplate.js';

/**
 * Guest Details & Checkout Form — editorial / modern.
 */
class GuestPrintFormTemplate extends BaseInvoiceTemplate {
  constructor() {
    super();
    this.templateName = 'GuestPrintForm';
    this.version = '2.0.0';
  }

  validateData(booking) {
    if (!booking) return false;
    const requiredFields = ['guestName', 'checkIn', 'checkOut'];
    return requiredFields.every((field) => booking[field]);
  }

  formatLongDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  calculateNights(booking) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    if (!checkIn || !checkOut) return 1;

    const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());

    let nights = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    nights = Math.max(1, nights);

    // Standard checkout is 11:00 AM. Anything after 11:00 counts as an extra night.
    const checkOutTimeStr = booking.checkOutTime || '11:00';
    if (checkOutTimeStr) {
      try {
        const [hours, minutes] = checkOutTimeStr.split(':').map(Number);
        const checkoutHour = hours + minutes / 60;
        if (checkoutHour > 11.0) nights += 1;
      } catch { /* ignore */ }
    }
    return nights;
  }

  // ───────────────────────── styles ─────────────────────────

  getGuestFormStyles() {
    return `
      @page { size: A4; margin: 11mm 14mm; }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
        font-size: 11px;
        line-height: 1.55;
        color: #111111;
        background: #ffffff;
        font-feature-settings: 'tnum' 1, 'ss01' 1;
        -webkit-font-smoothing: antialiased;
      }

      .form-container {
        max-width: 210mm;
        margin: 0 auto;
        padding: 0;
        background: #ffffff;
      }

      .accent-rule {
        height: 2px;
        width: 32px;
        background: #8e6f3f;
        margin-bottom: 16px;
      }

      /* ───── masthead ───── */
      .masthead {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid #111111;
        align-items: end;
      }
      .brand-mark {
        font-size: 9px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #8b8b88;
        margin-bottom: 8px;
      }
      .brand-name {
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.012em;
        line-height: 1.15;
        color: #111111;
      }
      .brand-meta {
        margin-top: 10px;
        font-size: 10px;
        color: #4a4a4a;
        line-height: 1.7;
      }

      .form-meta { text-align: right; }
      .form-meta .label {
        font-size: 9px;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: #8b8b88;
      }
      .form-meta .number {
        margin-top: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #111111;
        font-variant-numeric: tabular-nums;
      }
      .form-meta .meta-row {
        margin-top: 14px;
        display: grid;
        grid-template-columns: auto auto;
        gap: 6px 16px;
        text-align: left;
        width: max-content;
        margin-left: auto;
      }
      .form-meta .meta-row dt {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: #8b8b88;
        padding-top: 2px;
      }
      .form-meta .meta-row dd {
        font-size: 10.5px;
        font-variant-numeric: tabular-nums;
        color: #111111;
      }

      /* ───── sections ───── */
      .section {
        padding: 13px 0;
        border-bottom: 1px solid #e5e3dd;
      }
      .section.no-rule { border-bottom: none; }

      .eyebrow {
        font-size: 9px;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: #8b8b88;
        margin-bottom: 14px;
      }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 48px;
      }
      .grid-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0 40px;
      }

      .field {
        padding: 6px 0;
        border-bottom: 1px solid #efece6;
      }
      .field .key {
        display: block;
        color: #8b8b88;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        margin-bottom: 4px;
      }
      .field .val {
        display: block;
        color: #111111;
        font-size: 11.5px;
        font-variant-numeric: tabular-nums;
        word-break: break-word;
      }
      .field .val.placeholder {
        color: #a8a8a4;
      }
      .field.wide { grid-column: 1 / -1; }

      /* ───── charges table ───── */
      .charges {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .charges thead th {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
        padding: 0 0 12px 0;
        border-bottom: 1px solid #111111;
        font-weight: 500;
        text-align: left;
      }
      .charges thead th.right { text-align: right; }
      .charges tbody td {
        padding: 13px 0;
        border-bottom: 1px solid #efece6;
        color: #111111;
        vertical-align: top;
      }
      .charges td.amt {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .charges td.detail {
        color: #4a4a4a;
        font-variant-numeric: tabular-nums;
      }
      .charges tbody td .sub {
        display: block;
        color: #8b8b88;
        font-size: 9.5px;
        margin-top: 3px;
      }
      .charges tfoot tr.total td {
        padding: 18px 0 0 0;
        border-top: 1px solid #111111;
        font-variant-numeric: tabular-nums;
      }
      .charges tfoot tr.total td.lbl {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
        font-weight: 500;
        vertical-align: middle;
      }
      .charges tfoot tr.total td.amt {
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.012em;
        color: #111111;
      }

      /* ───── notes ───── */
      .notes {
        padding: 18px 22px;
        border: 1px solid #e5e3dd;
        color: #4a4a4a;
        font-size: 10.5px;
        line-height: 1.7;
      }

      /* ───── signatures ───── */
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 56px;
        padding-top: 20px;
      }
      .sig { position: relative; }
      .sig .sigline {
        height: 40px;
        border-bottom: 1px solid #111111;
      }
      .sig .role {
        margin-top: 10px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
      }
      .sig .who {
        margin-top: 6px;
        font-size: 11px;
        color: #111111;
        font-weight: 500;
      }
      .sig .ack {
        margin-top: 6px;
        font-size: 9.5px;
        color: #4a4a4a;
        line-height: 1.6;
      }
      .sig.right { text-align: right; }

      /* ───── closing ───── */
      .closing {
        padding-top: 28px;
        text-align: center;
        font-size: 10.5px;
        color: #4a4a4a;
        letter-spacing: 0.01em;
      }
      .closing .mark {
        display: inline-block;
        width: 22px;
        height: 1px;
        background: #8e6f3f;
        vertical-align: middle;
        margin: 0 12px 4px;
      }
      .closing .stamp {
        margin-top: 14px;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
      }

      @media print {
        body { font-size: 10px; line-height: 1.4; }
        .form-container { padding: 0; }
        .section { padding: 11px 0; }
        .signatures { padding-top: 16px; }
        .closing { padding-top: 12px; }
        /* No forced section breaks — the fit-to-page script keeps it on one sheet. */
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
      }
    `;
  }

  // ───────────────────────── helpers ─────────────────────────

  _formNumber(booking) {
    const ts = booking._id ? booking._id.toString().slice(-6).toUpperCase() : Math.random().toString(36).slice(-6).toUpperCase();
    return `GDF-${ts}`;
  }

  _addressOf(booking) {
    return [booking.streetName, booking.area, booking.district, booking.state, booking.pincode]
      .filter(Boolean).join(', ');
  }

  _field(key, val, opts = {}) {
    const empty = !val || String(val).trim() === '' || val === 'N/A';
    const cls = opts.wide ? 'field wide' : 'field';
    const valCls = empty ? 'val placeholder' : 'val';
    return `
      <div class="${cls}">
        <span class="key">${key}</span>
        <span class="${valCls}">${empty ? '—' : val}</span>
      </div>
    `;
  }

  // ───────────────────────── main ─────────────────────────

  generateHTML(booking, room = null, options = {}, hotelInfo = null) {
    if (!this.validateData(booking)) {
      throw new Error('Invalid booking data provided');
    }

    const hotel = hotelInfo || this.getDefaultHotelInfo();
    const nights = this.calculateNights(booking);
    const {
      additionalNotes = '',
      restaurantOrders = [],
    } = options;

    const restaurantCharges = restaurantOrders.reduce((t, o) => t + (o.totalAmount || 0), 0);
    const roomTotal = booking.totalAmount || 0;
    const baseTariff = booking.baseAmount || (roomTotal / 1.05);
    const roomGst = roomTotal - baseTariff;
    const restBase = restaurantCharges / 1.05;
    const restGst = restaurantCharges - restBase;
    const grandTotal = roomTotal + restaurantCharges;

    const formNo = this._formNumber(booking);
    const issuedOn = this.formatLongDate(new Date());
    const bookingDate = booking.createdAt ? this.formatLongDate(booking.createdAt) : '—';
    const bookingId = booking._id ? booking._id.toString().slice(-8).toUpperCase() : '—';
    const customerId = booking.customerId || (booking._id ? `CUST-${booking._id.toString().slice(-6).toUpperCase()}` : '—');
    const phoneVal = booking.phone ? `+91 ${booking.phone}` : '';
    const guestsVal = `${booking.adults || 1} adult${(booking.adults || 1) > 1 ? 's' : ''}${booking.children ? ` · ${booking.children} child${booking.children > 1 ? 'ren' : ''}` : ''}`;
    const idProof = (booking.idCardType || booking.idCardNumber)
      ? `${booking.idCardType || 'ID'} · ${booking.idCardNumber || ''}`.trim()
      : '';
    const roomLabel = room?.roomNumber
      ? `${room.roomNumber}${room.type ? ` · ${room.type}` : ''}`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Guest Details &amp; Checkout — ${hotel.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Caveat:wght@400;500&display=swap" rel="stylesheet">
  <style>
    ${this.getCommonStyles()}
    ${this.getGuestFormStyles()}
  </style>
</head>
<body>
  <div id="fit-outer">
  <div id="fit-inner">
  <div class="form-container">
    <div class="accent-rule"></div>

    <header class="masthead">
      <div class="brand">
        <div class="brand-mark">— Hotel · Marriage Hall · Est. 2019</div>
        <div class="brand-name">${hotel.name}</div>
        <div class="brand-meta">
          ${hotel.address}<br>
          ${hotel.contact?.phone} &middot; ${hotel.contact?.email}
        </div>
      </div>
      <div class="form-meta">
        <div class="label">Guest Details &amp; Checkout</div>
        <div class="number">No. ${formNo}</div>
        <dl class="meta-row">
          <dt>Issued</dt><dd>${issuedOn}</dd>
          <dt>Booking</dt><dd>${bookingId}</dd>
          <dt>GSTIN</dt><dd>${hotel.gstin}</dd>
        </dl>
      </div>
    </header>

    <section class="section">
      <div class="eyebrow">— 01 · Guest information</div>
      <div class="grid-2">
        ${this._field('Guest name', booking.guestName)}
        ${this._field('Customer ID', customerId)}
        ${this._field('Phone', phoneVal)}
        ${this._field('Email', booking.email)}
        ${this._field('Address', this._addressOf(booking), { wide: true })}
        ${this._field('ID proof', idProof, { wide: true })}
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">— 02 · Stay details</div>
      <div class="grid-3">
        ${this._field('Booking ID', bookingId)}
        ${this._field('Room', roomLabel)}
        ${this._field('Guests', guestsVal)}

        ${this._field('Arriving', `${this.formatLongDate(booking.checkIn)} · ${this.formatTime(booking.checkInTime) || '12:00 PM'}`)}
        ${this._field('Departing', `${this.formatLongDate(booking.checkOut)} · ${this.formatTime(booking.checkOutTime) || '11:00 AM'}`)}
        ${this._field('Duration', `${nights} night${nights > 1 ? 's' : ''}`)}

        ${this._field('Booking date', bookingDate)}
        ${this._field('Booking status', booking.bookingStatus)}
        ${this._field('Payment status', booking.paymentStatus)}

        ${this._field('Arrival from', booking.customerOrigin)}
        ${this._field('Departing to', booking.customerDestination)}
        ${this._field('Purpose of visit', booking.purposeOfVisit)}
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">— 03 · Charges</div>
      <table class="charges">
        <thead>
          <tr>
            <th style="width: 38%;">Description</th>
            <th style="width: 16%;">Duration</th>
            <th class="right" style="width: 16%;">Base tariff</th>
            <th class="right" style="width: 14%;">GST</th>
            <th class="right" style="width: 16%;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Accommodation<span class="sub">${roomLabel || 'Room charges'}</span></td>
            <td class="detail">${nights} night${nights > 1 ? 's' : ''}</td>
            <td class="amt">${this.formatCurrency(baseTariff)}</td>
            <td class="amt">${this.formatCurrency(roomGst)}</td>
            <td class="amt">${this.formatCurrency(roomTotal)}</td>
          </tr>
          ${restaurantCharges > 0 ? `
          <tr>
            <td>Food &amp; Beverage<span class="sub">Restaurant &amp; room service</span></td>
            <td class="detail">—</td>
            <td class="amt">${this.formatCurrency(restBase)}</td>
            <td class="amt">${this.formatCurrency(restGst)}</td>
            <td class="amt">${this.formatCurrency(restaurantCharges)}</td>
          </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr class="total">
            <td class="lbl" colspan="4">Total amount</td>
            <td class="amt">${this.formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </section>

    ${additionalNotes ? `
    <section class="section">
      <div class="eyebrow">— Notes</div>
      <div class="notes">${additionalNotes}</div>
    </section>
    ` : ''}

    <section class="section no-rule signatures">
      <div class="sig">
        <div class="sigline"></div>
        <div class="role">Guest signature</div>
        <div class="who">${booking.guestName || 'Guest'}</div>
        <div class="ack">I acknowledge receipt of all services and confirm the charges above.</div>
      </div>
      <div class="sig right">
        <div class="sigline"></div>
        <div class="role">Authorised signatory</div>
        <div class="who">For ${hotel.name.split('&')[0].trim()}</div>
        <div class="ack">${hotel.name}</div>
      </div>
    </section>

    <div class="closing">
      Thank you for staying with us<span class="mark"></span>${hotel.name}
      <div class="stamp">Generated · ${new Date().toLocaleDateString('en-GB')} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
  </div>
  </div>
  <script>
    // Guarantee a single A4 sheet: if the folio is taller than one page, scale it
    // down and collapse the layout box to the scaled height (a plain transform
    // does not change pagination height, so the wrapper height must shrink too).
    (function () {
      function fit() {
        var inner = document.getElementById('fit-inner');
        var outer = document.getElementById('fit-outer');
        if (!inner || !outer) return;
        inner.style.transform = 'none';
        outer.style.height = '';
        outer.style.overflow = 'visible';
        // A4 @ 96dpi ≈ 1123px tall; @page top+bottom margins (11mm ≈ 42px each)
        // sit outside the body, leaving ~1039px of printable height.
        var available = 1123 - 2 * 42;
        var h = inner.scrollHeight;
        if (h > available) {
          var s = available / h;
          inner.style.transformOrigin = 'top center';
          inner.style.transform = 'scale(' + s + ')';
          outer.style.height = Math.floor(h * s) + 'px';
          outer.style.overflow = 'hidden';
        }
      }
      function run() { try { fit(); } catch (e) {} }
      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
    })();
  </script>
</body>
</html>`;
  }
}

export default GuestPrintFormTemplate;
