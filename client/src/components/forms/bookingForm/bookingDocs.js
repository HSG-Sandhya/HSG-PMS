// Self-contained guest-facing documents for the booking form: a printable
// confirmation, a printable tax invoice, and a WhatsApp confirmation deep-link.
// All are built purely from form state + hotel settings (no API), using the
// app's standard window.open + print pattern.
import { currencySym } from '../../../utils/billing';
import { nightsBetween } from '../../../utils/roomAvailability';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const hotelOf = (settings) => ({
  name: settings?.hotelProfile?.hotelName || settings?.hotelName || 'Hotel Sandhya Grand',
  address: settings?.hotelProfile?.address || settings?.address || '',
  phone: settings?.hotelProfile?.phone || settings?.phone || '',
  gst: settings?.tax?.gstNumber || settings?.gstNumber || '',
});

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const money = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;

const openPrint = (title, bodyHtml) => {
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f1f3d;margin:0;padding:32px;}
    .wrap{max-width:720px;margin:0 auto}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f1f3d;padding-bottom:16px;margin-bottom:24px}
    .hotel{font-size:24px;font-weight:800;letter-spacing:-0.5px}
    .muted{color:#64748b;font-size:13px}
    .badge{display:inline-block;padding:6px 14px;border-radius:999px;background:#0f1f3d;color:#fff;font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase}
    .title{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#caa24a;font-weight:800;margin-bottom:4px}
    h1{font-size:22px;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;margin:8px 0 20px}
    td,th{padding:9px 4px;text-align:left;font-size:14px;border-bottom:1px solid #eef1f6}
    th{color:#64748b;font-weight:600;font-size:11px;letter-spacing:1px;text-transform:uppercase}
    .tot td{border:none;padding:5px 4px}
    .tot .grand td{border-top:2px solid #0f1f3d;font-weight:800;font-size:17px;padding-top:12px}
    .right{text-align:right}
    .foot{margin-top:32px;color:#64748b;font-size:12px;text-align:center;border-top:1px solid #eef1f6;padding-top:16px}
  </style></head><body><div class="wrap">${bodyHtml}</div>
  <script>window.onload=function(){window.print();}</script></body></html>`);
  win.document.close();
  return true;
};

const stayBlock = (formData, room) => {
  const nights = nightsBetween(formData.checkInDate || formData.checkIn, formData.checkOutDate || formData.checkOut);
  return `
    <table>
      <tr><th>Guest</th><th>Mobile</th><th class="right">Guests</th></tr>
      <tr><td>${esc(formData.guestName)}</td><td>+91 ${esc(formData.phone)}</td><td class="right">${esc(formData.adults || 1)} adult(s), ${esc(formData.children || 0)} child</td></tr>
    </table>
    <table>
      <tr><th>Check-in</th><th>Check-out</th><th>Nights</th><th class="right">Room</th></tr>
      <tr><td>${fmtDate(formData.checkInDate || formData.checkIn)} ${esc(formData.checkInTime || '')}</td>
          <td>${fmtDate(formData.checkOutDate || formData.checkOut)} ${esc(formData.checkOutTime || '')}</td>
          <td>${nights}</td>
          <td class="right">${room ? `${esc(room.roomNumber)} · ${esc(room.type)}` : '—'}</td></tr>
    </table>`;
};

const amountRows = (formData) => {
  const rows = [];
  if (formData.baseAmount) rows.push(['Room charges', money(formData.baseAmount)]);
  if (formData.breakfastAmount) rows.push(['Breakfast', money(formData.breakfastAmount)]);
  if (formData.extraChargesTotal) rows.push(['Add-on services', money(formData.extraChargesTotal)]);
  if (formData.discountAmount) rows.push(['Discount', `- ${money(formData.discountAmount)}`]);
  if (formData.gstAmount) rows.push(['GST', money(formData.gstAmount)]);
  return rows.map(([k, v]) => `<tr><td>${k}</td><td class="right">${v}</td></tr>`).join('');
};

export const printConfirmation = ({ formData, room, settings, bookingId }) => {
  const h = hotelOf(settings);
  openPrint('Booking Confirmation', `
    <div class="head">
      <div><div class="hotel">${esc(h.name)}</div><div class="muted">${esc(h.address)}</div>${h.phone ? `<div class="muted">${esc(h.phone)}</div>` : ''}</div>
      <div style="text-align:right"><span class="badge">${esc(formData.bookingStatus || 'Confirmed')}</span><div class="muted" style="margin-top:8px">${esc(bookingId || '')}</div></div>
    </div>
    <div class="title">Booking Confirmation</div>
    <h1>Reservation summary</h1>
    ${stayBlock(formData, room)}
    <table class="tot">
      ${amountRows(formData)}
      <tr class="grand"><td>Total</td><td class="right">${money(formData.totalAmount)}</td></tr>
      <tr><td>Advance paid</td><td class="right">${money(formData.paidAmount)}</td></tr>
      <tr><td>Balance due</td><td class="right">${money((formData.totalAmount || 0) - (formData.paidAmount || 0))}</td></tr>
    </table>
    <div class="foot">Thank you for choosing ${esc(h.name)}. We look forward to hosting you.</div>
  `);
};

export const printInvoice = ({ formData, room, settings, bookingId }) => {
  const h = hotelOf(settings);
  openPrint('Tax Invoice', `
    <div class="head">
      <div><div class="hotel">${esc(h.name)}</div><div class="muted">${esc(h.address)}</div>${h.gst ? `<div class="muted">GSTIN: ${esc(h.gst)}</div>` : ''}</div>
      <div style="text-align:right"><span class="badge">Tax Invoice</span><div class="muted" style="margin-top:8px">${esc(bookingId || '')}</div><div class="muted">${fmtDate(new Date())}</div></div>
    </div>
    <div class="title">Bill to</div>
    <h1>${esc(formData.guestName)}</h1>
    ${stayBlock(formData, room)}
    <table class="tot">
      ${amountRows(formData)}
      <tr class="grand"><td>Grand total</td><td class="right">${money(formData.totalAmount)}</td></tr>
      <tr><td>Paid</td><td class="right">${money(formData.paidAmount)}</td></tr>
      <tr><td>Balance due</td><td class="right">${money((formData.totalAmount || 0) - (formData.paidAmount || 0))}</td></tr>
    </table>
    <div class="foot">This is a computer-generated invoice. ${h.gst ? `GSTIN ${esc(h.gst)}.` : ''}</div>
  `);
};

export const sendWhatsApp = ({ formData, settings, bookingId }) => {
  const h = hotelOf(settings);
  const phone = String(formData.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return false;
  const nights = nightsBetween(formData.checkInDate || formData.checkIn, formData.checkOutDate || formData.checkOut);
  const lines = [
    `*${h.name}* — Booking ${formData.bookingStatus || 'Confirmed'} ✅`,
    bookingId ? `Booking ID: ${bookingId}` : '',
    `Guest: ${formData.guestName}`,
    `Check-in: ${fmtDate(formData.checkInDate || formData.checkIn)} ${formData.checkInTime || ''}`,
    `Check-out: ${fmtDate(formData.checkOutDate || formData.checkOut)} ${formData.checkOutTime || ''}`,
    `Nights: ${nights}`,
    `Total: ${money(formData.totalAmount)} | Balance: ${money((formData.totalAmount || 0) - (formData.paidAmount || 0))}`,
    '',
    'We look forward to welcoming you!',
  ].filter(Boolean);
  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank');
  return true;
};
