import BaseInvoiceTemplate from './BaseInvoiceTemplate.js';
import RestaurantCalculationUtils from './RestaurantCalculationUtils.js';

/**
 * Hotel Room Invoice Template — editorial / modern.
 */
class HotelRoomInvoiceTemplate extends BaseInvoiceTemplate {
  constructor() {
    super();
    this.templateName = 'HotelRoomInvoice';
    this.version = '2.0.0';
  }

  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatLongDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDateTime(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  getInitials(name) {
    if (!name) return 'XX';
    return name
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
      .padEnd(2, 'X');
  }

  formatDateDDMMYY(date) {
    if (!date) return '010101';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
  }

  async getNextSerialNumber() {
    try {
      if (global.db && global.db.collection) {
        const counterCollection = global.db.collection('invoiceCounters');
        const result = await counterCollection.findOneAndUpdate(
          { _id: 'hotelInvoiceSerial' },
          { $inc: { sequence: 1 } },
          { upsert: true, returnDocument: 'after', projection: { sequence: 1 } },
        );
        return result.sequence || 10001;
      }
    } catch (error) { /* fall through */ }
    const timeSerial = Date.now() % 100000;
    return 10000 + timeSerial;
  }

  async generateInvoiceNumber(booking) {
    const prefix = 'HSG';
    const initials = this.getInitials(booking.guestName);
    const serialNumber = await this.getNextSerialNumber();
    const serialStr = String(serialNumber).padStart(5, '0');
    return `${prefix}${initials}${serialStr}`;
  }

  validateData(booking) {
    if (!booking) return false;
    const requiredFields = ['guestName', 'checkIn', 'checkOut'];
    return requiredFields.every((field) => booking[field]);
  }

  calculateNights(booking) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    let nights = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    nights = Math.max(1, nights);
    // Late-checkout rule: standard checkout is 11:00 AM.
    // Anything after 11:00 counts as an additional night.
    const checkOutTime = booking.checkOutTime || '11:00';
    if (checkOutTime) {
      try {
        const [hours, minutes] = checkOutTime.split(':').map(Number);
        const checkoutHour = hours + minutes / 60;
        if (checkoutHour > 11.0) nights += 1;
      } catch { /* ignore */ }
    }
    return nights;
  }

  // ───────────────────────── styles ─────────────────────────

  getHotelRoomStyles() {
    return `
      @page { size: A4; margin: 12mm 14mm; }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
        font-size: 10px;
        line-height: 1.45;
        color: #111111;
        background: #ffffff;
        font-feature-settings: 'tnum' 1, 'ss01' 1;
        -webkit-font-smoothing: antialiased;
      }

      .invoice-container {
        max-width: 210mm;
        margin: 0 auto;
        padding: 0;
        background: #ffffff;
      }

      .accent-rule {
        height: 2px;
        width: 28px;
        background: #8e6f3f;
        margin-bottom: 10px;
      }

      /* ───── masthead ───── */
      .masthead {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 18px;
        padding-bottom: 12px;
        border-bottom: 1px solid #111111;
        align-items: end;
      }
      .brand-mark {
        font-size: 8.5px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #8b8b88;
        margin-bottom: 5px;
      }
      .brand-name {
        font-size: 18px;
        font-weight: 500;
        letter-spacing: -0.012em;
        line-height: 1.15;
        color: #111111;
      }
      .brand-meta {
        margin-top: 6px;
        font-size: 9.5px;
        color: #4a4a4a;
        line-height: 1.55;
      }

      .invoice-meta { text-align: right; }
      .invoice-meta .label {
        font-size: 9px;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: #8b8b88;
      }
      .invoice-meta .number {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 500;
        color: #111111;
        font-variant-numeric: tabular-nums;
      }
      .invoice-meta .meta-row {
        margin-top: 8px;
        display: grid;
        grid-template-columns: auto auto;
        gap: 3px 14px;
        text-align: left;
        width: max-content;
        margin-left: auto;
      }
      .invoice-meta .meta-row dt {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: #8b8b88;
        padding-top: 2px;
      }
      .invoice-meta .meta-row dd {
        font-size: 10.5px;
        font-variant-numeric: tabular-nums;
        color: #111111;
      }

      /* ───── sections ───── */
      .section {
        padding: 11px 0;
        border-bottom: 1px solid #e5e3dd;
      }
      .section.no-rule { border-bottom: none; }

      .eyebrow {
        font-size: 8.5px;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: #8b8b88;
        margin-bottom: 8px;
      }

      .split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
      }
      .info-block .name {
        font-size: 13px;
        font-weight: 500;
        color: #111111;
        letter-spacing: -0.005em;
        margin-bottom: 6px;
      }

      .info-list .row {
        display: flex;
        gap: 14px;
        align-items: baseline;
        padding: 3px 0;
      }
      .info-list .row + .row { border-top: 1px solid #efece6; }
      .info-list .key {
        flex: 0 0 88px;
        color: #8b8b88;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .info-list .val {
        color: #111111;
        font-variant-numeric: tabular-nums;
        font-size: 10.5px;
      }

      /* ───── charges table ───── */
      .charges {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .charges thead th {
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
        padding: 0 0 7px 0;
        border-bottom: 1px solid #111111;
        font-weight: 500;
        text-align: left;
      }
      .charges thead th.right { text-align: right; }
      .charges tbody td {
        padding: 8px 0;
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
      .charges tfoot tr.sub td {
        padding: 8px 0;
        color: #4a4a4a;
        border-bottom: 1px solid #efece6;
        font-variant-numeric: tabular-nums;
      }
      .charges tfoot tr.sub td.lbl {
        font-size: 10px;
        color: #4a4a4a;
      }
      .charges tfoot tr.total td {
        padding: 11px 0 0 0;
        border-top: 1px solid #111111;
        font-variant-numeric: tabular-nums;
      }
      .charges tfoot tr.total td.lbl {
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
        font-weight: 500;
        vertical-align: middle;
      }
      .charges tfoot tr.total td.amt {
        font-size: 18px;
        font-weight: 500;
        letter-spacing: -0.012em;
        color: #111111;
      }
      .charges tbody tr.sub-row td {
        padding: 4px 0;
        color: #4a4a4a;
        border-bottom: 1px dashed #efece6;
        font-variant-numeric: tabular-nums;
        font-size: 10px;
      }
      .charges tbody tr.sub-row td.lbl { color: #4a4a4a; padding-left: 14px; }
      .charges tbody tr.subtotal-row td {
        padding: 6px 0;
        border-top: 1px solid #d8d3c5;
        border-bottom: 1px solid #d8d3c5;
        font-variant-numeric: tabular-nums;
        color: #111111;
        background: #fbf9f3;
      }
      .charges tbody tr.subtotal-row td.lbl { font-size: 10.5px; }
      .charges tbody tr.subtotal-row td.amt { font-size: 12px; }

      /* ───── payment summary ───── */
      .payment-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        align-items: start;
      }
      .pay-list .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 6px 0;
        border-bottom: 1px solid #efece6;
        font-variant-numeric: tabular-nums;
      }
      .pay-list .row .key {
        color: #8b8b88;
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .pay-list .row .val { color: #111111; font-size: 10.5px; }

      .status-card {
        border: 1px solid #111111;
        padding: 14px;
      }
      .status-card .eyebrow { margin-bottom: 4px; }
      .status-card .status {
        font-size: 20px;
        font-weight: 500;
        letter-spacing: -0.015em;
        color: #111111;
        line-height: 1.05;
      }
      .status-card .status.due  { color: #9a2828; }
      .status-card .status.paid { color: #1f6b3a; }
      .status-card .amount {
        margin-top: 5px;
        font-size: 10.5px;
        color: #4a4a4a;
        font-variant-numeric: tabular-nums;
      }
      .status-card .note {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #efece6;
        font-size: 9px;
        color: #8b8b88;
        line-height: 1.5;
      }

      /* ───── terms ───── */
      .terms {
        list-style: none;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px 28px;
        counter-reset: term;
        font-size: 9px;
        color: #4a4a4a;
        line-height: 1.5;
      }
      .terms li {
        position: relative;
        padding-left: 20px;
        counter-increment: term;
      }
      .terms li::before {
        content: counter(term, decimal-leading-zero);
        position: absolute;
        left: 0;
        top: 1px;
        font-size: 8.5px;
        letter-spacing: 0.18em;
        color: #8b8b88;
      }

      /* ───── signatures ───── */
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        padding-top: 18px;
      }
      .sig .sigline { height: 36px; border-bottom: 1px solid #111111; }
      .sig .role {
        margin-top: 6px;
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #8b8b88;
      }
      .sig .who {
        margin-top: 3px;
        font-size: 10.5px;
        color: #111111;
        font-weight: 500;
      }
      .sig.right { text-align: right; }

      /* ───── closing ───── */
      .closing {
        padding-top: 14px;
        text-align: center;
        font-size: 10px;
        color: #4a4a4a;
        letter-spacing: 0.01em;
      }
      .closing .mark {
        display: inline-block;
        width: 20px;
        height: 1px;
        background: #8e6f3f;
        vertical-align: middle;
        margin: 0 10px 3px;
      }

      .page-break { page-break-before: always; }

      @media print {
        body { font-size: 10.5px; }
        .invoice-container { padding: 0; }
        .section { page-break-inside: avoid; }
        .signatures, .closing { page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
      }
    `;
  }

  // ───────────────────────── helpers for templates ─────────────────────────

  _assembleAddress(booking) {
    return [booking.streetName, booking.area, booking.district, booking.state, booking.pincode]
      .filter(Boolean)
      .join(', ') || 'Not provided';
  }

  _statusFor(grandTotal, paidAmount) {
    const balance = grandTotal - paidAmount;
    if (paidAmount <= 0) return { label: 'Awaiting Payment', cls: 'due', amount: this.formatCurrency(grandTotal), balance };
    if (balance > 0)     return { label: 'Balance Due',      cls: 'due', amount: `${this.formatCurrency(paidAmount)} of ${this.formatCurrency(grandTotal)} received`, balance };
    if (balance < 0)     return { label: 'Overpaid',         cls: 'paid', amount: `${this.formatCurrency(paidAmount)} received · ${this.formatCurrency(Math.abs(balance))} to refund`, balance };
    return { label: 'Fully Paid', cls: 'paid', amount: `${this.formatCurrency(paidAmount)} received`, balance: 0 };
  }

  // ───────────────────────── food bill ─────────────────────────

  async generateFoodBillHTML(booking, hotelInfo = null, invoiceNumber = null) {
    const hotel = hotelInfo || this.getDefaultHotelInfo();
    const restaurantCharges = booking.restaurantCharges || 0;
    const restaurantOrders = booking.restaurantOrders || [];
    if (restaurantCharges === 0 && restaurantOrders.length === 0) return '';

    const calc = RestaurantCalculationUtils.calculateRestaurantTotals(restaurantOrders, restaurantCharges);
    const { subtotal, gstAmount, total, itemsBreakdown, totalItems } = calc;

    const foodBillNumber = invoiceNumber
      ? invoiceNumber.replace('HSG', 'FB')
      : (await this.generateInvoiceNumber(booking)).replace('HSG', 'FB');

    const itemsRows = itemsBreakdown.map((item) => `
      <tr>
        <td>${item.name}<span class="sub">${RestaurantCalculationUtils.formatDateTime(item.orderDate || new Date())}</span></td>
        <td class="detail">${item.quantity} × ${RestaurantCalculationUtils.formatCurrency(item.rate)}</td>
        <td class="amt">${RestaurantCalculationUtils.formatCurrency(item.amount)}</td>
      </tr>
    `).join('');

    // Use the restaurant identity from settings — name + GSTIN can differ
    // from the hotel when F&B operates under its own GST registration.
    const restaurant = {
      name: hotel.restaurant?.name || hotel.name,
      gstin: hotel.restaurant?.gstin || hotel.gstin,
      fssai: hotel.restaurant?.fssai || '',
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Food Bill — ${restaurant.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    ${this.getCommonStyles()}
    ${this.getHotelRoomStyles()}
  </style>
</head>
<body>
  <div class="invoice-container page-break">
    <div class="accent-rule"></div>
    <div class="masthead">
      <div class="brand">
        <div class="brand-mark">— Restaurant &amp; Room Service</div>
        <div class="brand-name">${restaurant.name}</div>
        <div class="brand-meta">${hotel.address}<br>${hotel.contact?.phone} · ${hotel.contact?.email}${restaurant.fssai ? `<br>FSSAI ${restaurant.fssai}` : ''}</div>
      </div>
      <div class="invoice-meta">
        <div class="label">Food Bill</div>
        <div class="number">No. ${foodBillNumber}</div>
        <dl class="meta-row">
          <dt>Issued</dt><dd>${this.formatLongDate(new Date())}</dd>
          <dt>GSTIN</dt><dd>${restaurant.gstin}</dd>
          <dt>Items</dt><dd>${totalItems}</dd>
        </dl>
      </div>
    </div>

    <div class="section split">
      <div class="info-block">
        <div class="eyebrow">— Billed to</div>
        <div class="name">${booking.guestName || 'Guest'}</div>
        <div class="info-list">
          <div class="row"><span class="key">Room</span><span class="val">${booking.roomId?.roomNumber || 'N/A'}</span></div>
          <div class="row"><span class="key">Stay</span><span class="val">${this.formatLongDate(booking.checkIn)} → ${this.formatLongDate(booking.checkOut)}</span></div>
        </div>
      </div>
      <div class="info-block">
        <div class="eyebrow">— Summary</div>
        <div class="name">${totalItems} item${totalItems !== 1 ? 's' : ''}</div>
        <div class="info-list">
          <div class="row"><span class="key">Orders</span><span class="val">${calc.totalOrders}</span></div>
          <div class="row"><span class="key">Method</span><span class="val">${calc.calculationMethod}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="eyebrow">— Items</div>
      <table class="charges">
        <thead>
          <tr>
            <th style="width: 56%;">Item</th>
            <th style="width: 24%;">Detail</th>
            <th class="right" style="width: 20%;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
        <tfoot>
          <tr class="sub"><td class="lbl" colspan="2">Food subtotal</td><td class="amt">${RestaurantCalculationUtils.formatCurrency(subtotal)}</td></tr>
          <tr class="sub"><td class="lbl" colspan="2">GST @ 5%</td><td class="amt">${RestaurantCalculationUtils.formatCurrency(gstAmount)}</td></tr>
          <tr class="total"><td class="lbl" colspan="2">Food bill total</td><td class="amt">${RestaurantCalculationUtils.formatCurrency(total)}</td></tr>
        </tfoot>
      </table>
    </div>

    <div class="section no-rule">
      <div class="eyebrow">— Note</div>
      <p style="font-size:10.5px;color:#4a4a4a;line-height:1.7;max-width:520px;">
        These charges form part of your stay invoice and will be settled together at check-out.
      </p>
    </div>

    <div class="closing">
      Thank you for dining with us<span class="mark"></span>${restaurant.name}
    </div>
  </div>
</body>
</html>`;
  }

  // ───────────────────────── main invoice ─────────────────────────

  async generateHTML(booking, hotelInfo = null) {
    if (!this.validateData(booking)) {
      throw new Error('Invalid booking data provided');
    }

    const hotel = hotelInfo || this.getDefaultHotelInfo();
    const finalNights = this.calculateNights(booking);
    const totalAmount = booking.totalAmount || 0;

    const restaurantOrders = booking.restaurantOrders || [];
    const restaurantCharges = booking.restaurantCharges || 0;
    const restaurantCalc = RestaurantCalculationUtils.calculateRestaurantTotals(restaurantOrders, restaurantCharges);
    const finalRestaurantCharges = restaurantCalc.total;
    const grandTotal = totalAmount + finalRestaurantCharges;
    const paidAmount = booking.paidAmount || 0;
    const status = this._statusFor(grandTotal, paidAmount);

    const invoiceNumber = await this.generateInvoiceNumber(booking);
    const foodBillHTML = await this.generateFoodBillHTML(booking, hotelInfo, invoiceNumber);

    const perNight = booking.roomId?.pricePerNight
      || booking.baseAmount
      || (totalAmount / finalNights);
    const accommodationBase = (totalAmount * 100) / 105;
    const cgst = (totalAmount * 2.5) / 105;
    const sgst = (totalAmount * 2.5) / 105;

    const issuedOn = this.formatLongDate(new Date());
    const dueOn    = this.formatLongDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const contactStr = booking.phone ? `+91 ${booking.phone}` : 'Not provided';
    const emailStr   = booking.email || 'Not provided';
    const addressStr = this._assembleAddress(booking);

    const guestCount = `${booking.adults || 1} adult${(booking.adults || 1) > 1 ? 's' : ''}` +
      ((booking.children && booking.children > 0)
        ? ` · ${booking.children} child${booking.children > 1 ? 'ren' : ''}`
        : '');

    const paymentInfoLine = (() => {
      if (!booking.paymentMethod) return '';
      const refPart = booking.paymentReference ? ` · Ref ${booking.paymentReference}` : '';
      return `<span style="color:#8b8b88;"> &middot; ${booking.paymentMethod}${refPart}</span>`;
    })();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tax Invoice — ${hotel.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    ${this.getCommonStyles()}
    ${this.getHotelRoomStyles()}
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="accent-rule"></div>

    <header class="masthead">
      <div class="brand">
        <div class="brand-mark">— Hotel · Marriage Hall · Est. 2019</div>
        <div class="brand-name">${hotel.name}</div>
        <div class="brand-meta">
          ${hotel.address}<br>
          ${hotel.contact?.phone} &middot; ${hotel.contact?.email}<br>
          ${hotel.contact?.website || 'www.sandhyagrand.in'}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="label">Tax Invoice</div>
        <div class="number">No. ${invoiceNumber}</div>
        <dl class="meta-row">
          <dt>Issued</dt><dd>${issuedOn}</dd>
          <dt>Due</dt><dd>${dueOn}</dd>
          <dt>GSTIN</dt><dd>${hotel.gstin}</dd>
        </dl>
      </div>
    </header>

    <section class="section split">
      <div class="info-block">
        <div class="eyebrow">— Billed to</div>
        <div class="name">${booking.guestName || 'Guest'}</div>
        <div class="info-list">
          <div class="row"><span class="key">Contact</span><span class="val">${contactStr}</span></div>
          <div class="row"><span class="key">Email</span><span class="val">${emailStr}</span></div>
          <div class="row"><span class="key">Address</span><span class="val">${addressStr}</span></div>
        </div>
      </div>
      <div class="info-block">
        <div class="eyebrow">— Stay</div>
        <div class="name">Room ${booking.roomId?.roomNumber || 'N/A'} &middot; ${booking.roomId?.type || 'Standard'}</div>
        <div class="info-list">
          <div class="row"><span class="key">Arriving</span><span class="val">${this.formatLongDate(booking.checkIn)} · ${this.formatTime(booking.checkInTime) || '12:00 PM'}</span></div>
          <div class="row"><span class="key">Departing</span><span class="val">${this.formatLongDate(booking.checkOut)} · ${this.formatTime(booking.checkOutTime) || '11:00 AM'}</span></div>
          <div class="row"><span class="key">Duration</span><span class="val">${finalNights} night${finalNights > 1 ? 's' : ''}</span></div>
          <div class="row"><span class="key">Guests</span><span class="val">${guestCount}</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">— Charges</div>
      <table class="charges">
        <thead>
          <tr>
            <th style="width: 50%;">Item</th>
            <th style="width: 30%;">Detail</th>
            <th class="right" style="width: 20%;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Accommodation<span class="sub">The ${booking.roomId?.type || 'Standard'} Room · No. ${booking.roomId?.roomNumber || 'N/A'}</span></td>
            <td class="detail">${finalNights} night${finalNights > 1 ? 's' : ''} × ${this.formatCurrency(perNight)}</td>
            <td class="amt">${this.formatCurrency(accommodationBase)}</td>
          </tr>
          <tr class="sub-row"><td class="lbl">CGST @ 2.5%</td><td class="detail">on accommodation</td><td class="amt">${this.formatCurrency(cgst)}</td></tr>
          <tr class="sub-row"><td class="lbl">SGST @ 2.5%</td><td class="detail">on accommodation</td><td class="amt">${this.formatCurrency(sgst)}</td></tr>
          <tr class="subtotal-row"><td class="lbl"><strong>Accommodation subtotal</strong></td><td class="detail">incl. GST 5%</td><td class="amt"><strong>${this.formatCurrency(totalAmount)}</strong></td></tr>
          ${finalRestaurantCharges > 0 ? `
          <tr>
            <td>Food &amp; Beverage<span class="sub">Restaurant &amp; room service · ${restaurantOrders.length} order${restaurantOrders.length === 1 ? '' : 's'}</span></td>
            <td class="detail">Inclusive of GST 5%</td>
            <td class="amt">${RestaurantCalculationUtils.formatCurrency(finalRestaurantCharges)}</td>
          </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr class="total"><td class="lbl" colspan="2">Grand total</td><td class="amt">${this.formatCurrency(grandTotal)}</td></tr>
        </tfoot>
      </table>
    </section>

    <section class="section">
      <div class="eyebrow">— Payment</div>
      <div class="payment-grid">
        <div class="pay-list">
          <div class="row"><span class="key">Accommodation</span><span class="val">${this.formatCurrency(totalAmount)}</span></div>
          ${finalRestaurantCharges > 0 ? `
          <div class="row"><span class="key">Food &amp; Beverage</span><span class="val">${RestaurantCalculationUtils.formatCurrency(finalRestaurantCharges)}</span></div>
          ` : ''}
          <div class="row"><span class="key">Grand total</span><span class="val" style="font-weight:500;">${this.formatCurrency(grandTotal)}</span></div>
          ${paidAmount > 0 ? `
          <div class="row"><span class="key">Paid${paymentInfoLine ? '' : ''}</span><span class="val">${this.formatCurrency(paidAmount)}${paymentInfoLine}</span></div>
          ` : ''}
        </div>
        <div class="status-card">
          <div class="eyebrow">— Status</div>
          <div class="status ${status.cls}">${status.label}</div>
          <div class="amount">${status.amount}</div>
          <div class="note">
            Settle by ${dueOn}.<br>
            Accepted &middot; Cash · Card · UPI · Bank transfer.
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">— Terms</div>
      <ol class="terms">
        <li>All rates are inclusive of taxes.</li>
        <li>Check-in 12:00 PM &middot; Check-out 11:00 AM.</li>
        <li>Cancellation policy applies — please refer to our website or contact reception.</li>
        <li>This invoice is due for payment within 7 days from the issue date.</li>
      </ol>
    </section>

    <section class="section no-rule signatures">
      <div class="sig">
        <div class="sigline"></div>
        <div class="role">Guest signature</div>
        <div class="who">${booking.guestName || 'Guest'}</div>
      </div>
      <div class="sig right">
        <div class="sigline"></div>
        <div class="role">Authorised signatory</div>
        <div class="who">For ${hotel.name.split('&')[0].trim()}</div>
      </div>
    </section>

    <div class="closing">
      Thank you for staying with us<span class="mark"></span>${hotel.name}
      ${finalRestaurantCharges > 0 ? '<div style="margin-top:6px;font-size:9.5px;color:#8b8b88;letter-spacing:0.18em;text-transform:uppercase;">Food bill attached overleaf</div>' : ''}
    </div>
  </div>
</body>
</html>${foodBillHTML}`;
  }
}

export default HotelRoomInvoiceTemplate;
