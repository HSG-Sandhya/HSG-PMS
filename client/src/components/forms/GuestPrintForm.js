import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  Button, Typography, Grid, Box, TextField, Stack, Chip,
} from '@mui/material';
import { format, parseISO, isValid } from 'date-fns';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import HotelIcon from '@mui/icons-material/HotelOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import api from '../../api';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  labelSx,
  valueSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from './formStyles';
import { useBilling } from '../../hooks/useBilling';
import { currencySym } from '../../utils/billing';
import { hotelIdentity } from '../../utils/hotelProfile';

const safeFormat = (input, pattern) => {
  if (!input) return '—';
  const date = input instanceof Date ? input : parseISO(input);
  return isValid(date) ? format(date, pattern) : '—';
};

const GuestPrintForm = ({ open, onClose, booking, room, restaurantOrders = [] }) => {
  const billing = useBilling();
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [fetchedRestaurantOrders, setFetchedRestaurantOrders] = useState([]);
  const [_isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Helper function to calculate nights based on checkout time
  const calculateNights = (checkIn, checkOut, checkInTime, checkOutTime) => {
    if (!checkIn || !checkOut) {return 1;}

    const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());

    // Calculate base nights as the difference in days
    let nights = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    nights = Math.max(1, nights);

    // Apply late checkout rule: if checkout time is after 12:00 PM, add 1 more night
    const checkOutTimeStr = checkOutTime || billing.defaultCheckOutTime;
    if (checkOutTimeStr) {
      try {
        const [hours, minutes] = checkOutTimeStr.split(':').map(Number);
        const checkoutHour = hours + (minutes / 60); // Convert to decimal hours
        
        // If checkout is after 12:00 PM (12.0), add one more night
        if (checkoutHour > 12.0) {
          nights += 1;
        }
      } catch (error) {
        console.error('Error parsing checkout time:', error);
      }
    }

    return nights;
  };

  // Fetch restaurant orders when component opens
  useEffect(() => {
    const fetchRestaurantOrders = async () => {
      if (!open || !booking?._id) {
        setFetchedRestaurantOrders([]);
        return;
      }
      
      try {
        setIsLoadingOrders(true);
        const response = await api.restaurant.getOrdersByBooking(booking._id);
        setFetchedRestaurantOrders(response.data || []);
      } catch (error) {
        console.error('Error fetching restaurant orders:', error);
        if (error.response?.status !== 404) {
          console.warn('Restaurant orders not available:', error.message);
        }
        setFetchedRestaurantOrders([]);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchRestaurantOrders();
  }, [open, booking?._id]);

  // Use provided restaurant orders or fetched ones
  const allRestaurantOrders = restaurantOrders.length > 0 ? restaurantOrders : fetchedRestaurantOrders;

  // Calculate restaurant charges
  const restaurantCharges = allRestaurantOrders.reduce((total, order) => {
    return total + (order.totalAmount || 0);
  }, 0);

  // Calculate total amount including restaurant charges
  const _totalWithRestaurant = (booking?.totalAmount || 0) + restaurantCharges;

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      alert('Please allow popups for this site to print guest forms');
      return;
    }

    try {
      // Try to use server-side template first
      const options = { additionalNotes };
      
      const response = await api.guestPrint.generateForm(booking._id, options);
      const htmlContent = response.data;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.print();
          printWindow.onafterprint = function() {
            printWindow.close();
          };
        }, 300);
      };
    } catch (error) {
      console.error('Error using server-side template, falling back to client-side:', error);
      
      // Fallback to client-side template generation
      const htmlContent = generatePrintHTML();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.print();
          printWindow.onafterprint = function() {
            printWindow.close();
          };
        }, 300);
      };
    }
  };

  const generatePrintHTML = () => {
    const nights = calculateNights(
      new Date(booking.checkIn),
      new Date(booking.checkOut),
      booking.checkInTime,
      booking.checkOutTime,
    );

    const longDate = (d) => format(parseISO(d), 'dd MMM yyyy');
    const fmtTime = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    const inr = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;
    const id = hotelIdentity();

    const baseTariff = booking.baseAmount || ((booking.totalAmount || 0) / (1 + billing.roomGstRate / 100));
    const roomGst = (booking.totalAmount || 0) - baseTariff;
    const restBase = restaurantCharges / (1 + billing.posGstRate / 100);
    const restGst = restaurantCharges - restBase;
    const grandTotal = (booking.totalAmount || 0) + restaurantCharges;

    const bookingId = booking._id ? booking._id.toString().slice(-8).toUpperCase() : '—';
    const customerId = booking.customerId || (booking._id ? `CUST-${booking._id.toString().slice(-6).toUpperCase()}` : '—');
    const formNo = `GDF-${booking._id ? booking._id.toString().slice(-6).toUpperCase() : 'NEW'}`;
    const issuedOn = format(new Date(), 'dd MMM yyyy');
    const bookingDate = booking.createdAt ? longDate(booking.createdAt) : '—';
    const phoneVal = booking.phone ? `+91 ${booking.phone}` : '';
    const addressVal = [booking.streetName, booking.area, booking.district, booking.state, booking.pincode].filter(Boolean).join(', ');
    const guestsVal = `${booking.adults || 1} adult${(booking.adults || 1) > 1 ? 's' : ''}${booking.children ? ` · ${booking.children} child${booking.children > 1 ? 'ren' : ''}` : ''}`;
    const idProof = (booking.idCardType || booking.idCardNumber) ? `${booking.idCardType || 'ID'} · ${booking.idCardNumber || ''}`.trim() : '';
    const roomLabel = room?.roomNumber ? `${room.roomNumber}${room.type ? ` · ${room.type}` : ''}` : '';

    const field = (key, val, wide = false) => {
      const empty = !val || String(val).trim() === '';
      return `
        <div class="field${wide ? ' wide' : ''}">
          <span class="key">${key}</span>
          <span class="val ${empty ? 'placeholder' : ''}">${empty ? '—' : val}</span>
        </div>
      `;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Guest Details &amp; Checkout — ${id.hotelName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Caveat:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 11mm 14mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px; line-height: 1.45; color: #111; background: #fff;
      font-feature-settings: 'tnum' 1, 'ss01' 1;
      -webkit-font-smoothing: antialiased;
    }
    .form-container { max-width: 210mm; margin: 0 auto; padding: 0; }
    .accent-rule { height: 2px; width: 32px; background: #8e6f3f; margin-bottom: 12px; }

    .masthead {
      display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px;
      padding-bottom: 14px; border-bottom: 1px solid #111; align-items: end;
    }
    .brand-mark { font-size: 9px; letter-spacing: 0.24em; text-transform: uppercase; color: #8b8b88; margin-bottom: 8px; }
    .brand-name { font-size: 22px; font-weight: 500; letter-spacing: -0.012em; line-height: 1.15; color: #111; }
    .brand-meta { margin-top: 10px; font-size: 10px; color: #4a4a4a; line-height: 1.7; }

    .form-meta { text-align: right; }
    .form-meta .label { font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: #8b8b88; }
    .form-meta .number { margin-top: 6px; font-size: 13px; font-weight: 500; color: #111; font-variant-numeric: tabular-nums; }
    .form-meta .meta-row {
      margin-top: 14px; display: grid; grid-template-columns: auto auto;
      gap: 6px 16px; text-align: left; width: max-content; margin-left: auto;
    }
    .form-meta .meta-row dt { font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; color: #8b8b88; padding-top: 2px; }
    .form-meta .meta-row dd { font-size: 10.5px; font-variant-numeric: tabular-nums; color: #111; }

    .section { padding: 13px 0; border-bottom: 1px solid #e5e3dd; }
    .section.no-rule { border-bottom: none; }
    .eyebrow { font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: #8b8b88; margin-bottom: 10px; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 48px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 40px; }

    .field { padding: 6px 0; border-bottom: 1px solid #efece6; }
    .field .key { display: block; color: #8b8b88; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 4px; }
    .field .val { display: block; color: #111; font-size: 11.5px; font-variant-numeric: tabular-nums; word-break: break-word; }
    .field .val.placeholder { color: #a8a8a4; }
    .field.wide { grid-column: 1 / -1; }

    .charges { width: 100%; border-collapse: collapse; font-size: 11px; }
    .charges thead th {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.22em;
      color: #8b8b88; padding: 0 0 12px 0; border-bottom: 1px solid #111;
      font-weight: 500; text-align: left;
    }
    .charges thead th.right { text-align: right; }
    .charges tbody td { padding: 9px 0; border-bottom: 1px solid #efece6; color: #111; vertical-align: top; }
    .charges td.amt { text-align: right; font-variant-numeric: tabular-nums; }
    .charges td.detail { color: #4a4a4a; font-variant-numeric: tabular-nums; }
    .charges tbody td .sub { display: block; color: #8b8b88; font-size: 9.5px; margin-top: 3px; }
    .charges tfoot tr.total td { padding: 12px 0 0 0; border-top: 1px solid #111; font-variant-numeric: tabular-nums; }
    .charges tfoot tr.total td.lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.22em; color: #8b8b88; font-weight: 500; vertical-align: middle; }
    .charges tfoot tr.total td.amt { font-size: 22px; font-weight: 500; letter-spacing: -0.012em; color: #111; }

    .notes { padding: 12px 16px; border: 1px solid #e5e3dd; color: #4a4a4a; font-size: 10.5px; line-height: 1.55; }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; padding-top: 22px; }
    .sig { position: relative; }
    .sig .sigline { height: 40px; border-bottom: 1px solid #111; }
    .sig .role { margin-top: 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.22em; color: #8b8b88; }
    .sig .who { margin-top: 6px; font-size: 11px; color: #111; font-weight: 500; }
    .sig .ack { margin-top: 6px; font-size: 9.5px; color: #4a4a4a; line-height: 1.6; }
    .sig.right { text-align: right; }

    .closing { padding-top: 16px; text-align: center; font-size: 10.5px; color: #4a4a4a; letter-spacing: 0.01em; }
    .closing .mark { display: inline-block; width: 22px; height: 1px; background: #8e6f3f; vertical-align: middle; margin: 0 12px 4px; }
    .closing .stamp { margin-top: 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.22em; color: #8b8b88; }

    @media print {
      body { font-size: 10px; line-height: 1.4; }
      .form-container { padding: 0; }
      /* Keep the whole folio together so it never spills onto a 2nd sheet. */
      .form-container { page-break-inside: avoid; }
      .section { page-break-inside: avoid; padding: 11px 0; }
      .signatures { padding-top: 18px; }
      .closing { padding-top: 12px; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="accent-rule"></div>

    <header class="masthead">
      <div class="brand">
        <div class="brand-mark">— Hotel · Marriage Hall · Est. 2019</div>
        <div class="brand-name">${id.hotelNameFull}</div>
        <div class="brand-meta">
          ${id.addressLine}<br>
          ${id.phone} &middot; ${id.email}
        </div>
      </div>
      <div class="form-meta">
        <div class="label">Guest Details &amp; Checkout</div>
        <div class="number">No. ${formNo}</div>
        <dl class="meta-row">
          <dt>Issued</dt><dd>${issuedOn}</dd>
          <dt>Booking</dt><dd>${bookingId}</dd>
          <dt>GSTIN</dt><dd>${id.gstin}</dd>
        </dl>
      </div>
    </header>

    <section class="section">
      <div class="eyebrow">— 01 · Guest information</div>
      <div class="grid-2">
        ${field('Guest name', booking.guestName)}
        ${field('Customer ID', customerId)}
        ${field('Phone', phoneVal)}
        ${field('Email', booking.email)}
        ${field('Address', addressVal, true)}
        ${field('ID proof', idProof, true)}
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">— 02 · Stay details</div>
      <div class="grid-3">
        ${field('Booking ID', bookingId)}
        ${field('Room', roomLabel)}
        ${field('Guests', guestsVal)}

        ${field('Arriving', `${longDate(booking.checkIn)} · ${fmtTime(booking.checkInTime) || '12:00 PM'}`)}
        ${field('Departing', `${longDate(booking.checkOut)} · ${fmtTime(booking.checkOutTime) || '11:00 AM'}`)}
        ${field('Duration', `${nights} night${nights > 1 ? 's' : ''}`)}

        ${field('Booking date', bookingDate)}
        ${field('Booking status', booking.bookingStatus)}
        ${field('Payment status', booking.paymentStatus)}

        ${field('Arrival from', booking.customerOrigin)}
        ${field('Departing to', booking.customerDestination)}
        ${field('Purpose of visit', booking.purposeOfVisit)}
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
            <td class="amt">${inr(baseTariff)}</td>
            <td class="amt">${inr(roomGst)}</td>
            <td class="amt">${inr(booking.totalAmount || 0)}</td>
          </tr>
          ${restaurantCharges > 0 ? `
          <tr>
            <td>Food &amp; Beverage<span class="sub">Restaurant &amp; room service</span></td>
            <td class="detail">—</td>
            <td class="amt">${inr(restBase)}</td>
            <td class="amt">${inr(restGst)}</td>
            <td class="amt">${inr(restaurantCharges)}</td>
          </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr class="total">
            <td class="lbl" colspan="4">Total amount</td>
            <td class="amt">${inr(grandTotal)}</td>
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
        <div class="who">For ${id.hotelName}</div>
        <div class="ack">${id.hotelNameFull}</div>
      </div>
    </section>

    <div class="closing">
      Thank you for staying with us<span class="mark"></span>${id.hotelName}
      <div class="stamp">Generated · ${format(new Date(), 'dd MMM yyyy · HH:mm')}</div>
    </div>
  </div>
</body>
</html>`;
  };

  if (!booking) return null;
  const isDarkMode = false; // print form stays light by design — physical print friendly

  const nights = (() => {
    try {
      return calculateNights(
        new Date(booking.checkIn),
        new Date(booking.checkOut),
        booking.checkInTime,
        booking.checkOutTime,
      );
    } catch {
      return 1;
    }
  })();

  const Row = ({ label, value }) => (
    <Box sx={{ mb: 1.25 }}>
      <Typography sx={labelSx(isDarkMode)}>{label}</Typography>
      <Typography sx={{ ...valueSx(isDarkMode), mt: 0.25 }}>{value || '—'}</Typography>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: dialogPaperSx(isDarkMode) }}
      BackdropProps={{ sx: dialogBackdropSx }}
    >
      <Box sx={headerWrapSx(isDarkMode)}>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
              Guest Registration
            </Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', mt: 0.5 }}>
              {booking.guestName || 'Guest'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<HotelIcon sx={{ fontSize: 16 }} />}
                label={`${room?.roomNumber || '—'}${room?.type ? ` · ${room.type}` : ''}`}
                size="small"
                sx={{ borderRadius: 999 }}
              />
              <Chip
                label={`Booking ${booking._id?.slice(-8).toUpperCase() || ''}`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 999 }}
              />
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={labelSx(isDarkMode)}>Total</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {currencySym()}{booking.totalAmount?.toLocaleString('en-IN') || '0'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {nights === 1 ? '1 night stay' : `${nights} nights stay`}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
        <Grid container spacing={2.5}>
          {/* Guest Info */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>
                <PersonIcon fontSize="inherit" />
                Guest Information
              </Typography>
              <Row label="Customer ID" value={booking.customerId || `CUST-${booking._id?.slice(-6)}`} />
              <Row label="Phone" value={booking.phone} />
              <Row label="Email" value={booking.email} />
              <Row
                label="Address"
                value={[booking.streetName, booking.area, booking.district, booking.state, booking.pincode]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Row
                label="ID Proof"
                value={`${booking.idCardType || 'N/A'}${booking.idCardNumber ? ` · ${booking.idCardNumber}` : ''}`}
              />
            </Box>
          </Grid>

          {/* Booking Info */}
          <Grid item xs={12} md={6}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>
                <HotelIcon fontSize="inherit" />
                Booking Details
              </Typography>
              <Row
                label="Check-in"
                value={`${safeFormat(booking.checkIn, 'dd MMM yyyy')} · ${booking.checkInTime || billing.defaultCheckInTime}`}
              />
              <Row
                label="Check-out"
                value={`${safeFormat(booking.checkOut, 'dd MMM yyyy')} · ${booking.checkOutTime || billing.defaultCheckOutTime}`}
              />
              <Row label="Stay duration" value={nights === 1 ? '1 night' : `${nights} nights`} />
              <Row
                label="Number of guests"
                value={`${booking.adults || 1} adult${(booking.adults || 1) > 1 ? 's' : ''}${booking.children ? ` · ${booking.children} child${booking.children > 1 ? 'ren' : ''}` : ''}`}
              />
              <Row label="Payment status" value={booking.payment?.status || booking.paymentStatus} />
            </Box>
          </Grid>

          {/* Additional Notes */}
          <Grid item xs={12}>
            <Box sx={sectionCardSx(isDarkMode)}>
              <Typography sx={sectionTitleSx(isDarkMode)}>
                <EditNoteIcon fontSize="inherit" />
                Additional Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Special instructions, allergy notes, requests, etc."
                variant="outlined"
              />
            </Box>
          </Grid>

        </Grid>
      </DialogContent>

      <DialogActions sx={actionsBarSx(isDarkMode)}>
        <Button onClick={onClose} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
          Close
        </Button>
        <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} sx={primaryButtonSx}>
          Print form
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GuestPrintForm;