// Sticky reservation summary — a live bill that recomputes as the operator
// builds the booking, plus the premium action bar (Confirm / Save / Invoice /
// Print / WhatsApp / Cancel).
import { Box, Stack, Typography, Button, Divider, Chip, Tooltip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HotelIcon from '@mui/icons-material/Hotel';
import { currencySym } from '../../../utils/billing';
import { nightsBetween } from '../../../utils/roomAvailability';
import { NAVY, NAVY_2 } from './premium';

const money = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;

const Line = ({ label, value, negative, muted }) => (
  <Stack
    direction="row"
    sx={{
      justifyContent: "space-between",
      alignItems: "baseline",
      py: 0.5
    }}>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 700, color: muted ? 'rgba(255,255,255,0.72)' : '#fff' }}>
      {negative ? '− ' : ''}{value}
    </Typography>
  </Stack>
);

const ReservationSummary = ({
  formData, room, onSave, onConfirm, onCancel, onWhatsApp, saving,
}) => {
  const nights = nightsBetween(formData.checkInDate || formData.checkIn, formData.checkOutDate || formData.checkOut);
  const total = Number(formData.totalAmount || 0);
  const paid = Number(formData.paidAmount || 0);
  const balance = Math.max(0, total - paid);
  const docsReady = !!(formData.guestName && room);

  return (
    <Box
      sx={{
        position: { md: 'sticky' }, top: 8,
        borderRadius: 3, overflow: 'hidden',
        color: '#fff',
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        boxShadow: '0 24px 50px -28px rgba(15,31,61,0.85)',
      }}
    >
      <Box sx={{ p: 2.75 }}>
        <Typography sx={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--app-primary)', fontWeight: 800 }}>
          Reservation Summary
        </Typography>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            mt: 1.5,
            mb: 2
          }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(var(--app-primary-rgb),0.18)', color: 'var(--app-primary)' }}>
            <HotelIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
              {room ? `Room ${room.roomNumber} · ${room.type}` : 'No room selected'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              {nights} night{nights === 1 ? '' : 's'} · {formData.adults || 1} adult(s){formData.children ? `, ${formData.children} child` : ''}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

        <Box sx={{ py: 1.25 }}>
          <Line label="Room charges" value={money(formData.baseAmount)} />
          {!!formData.breakfastAmount && <Line label="Breakfast" value={money(formData.breakfastAmount)} />}
          {!!formData.extraChargesTotal && <Line label="Add-ons" value={money(formData.extraChargesTotal)} />}
          {!!formData.discountAmount && <Line label={`Discount${formData.discount ? ` (${formData.discount}%)` : ''}`} value={money(formData.discountAmount)} negative />}
          <Line label="GST" value={money(formData.gstAmount)} muted />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "baseline",
            py: 1.5
          }}>
          <Typography sx={{ fontWeight: 700 }}>Total</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--app-primary)' }}>
            {money(total)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1, p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Advance</Typography>
            <Typography sx={{ fontWeight: 800 }}>{money(paid)}</Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.25, borderRadius: 2, background: balance > 0 ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.16)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Balance due</Typography>
            <Typography sx={{ fontWeight: 800, color: balance > 0 ? '#fbbf24' : '#4ade80' }}>{money(balance)}</Typography>
          </Box>
        </Stack>

        {formData.paymentStatus && (
          <Box sx={{ mt: 1.5 }}>
            <Chip size="small" label={`Payment: ${formData.paymentStatus}`}
              sx={{ fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.10)' }} />
          </Box>
        )}
      </Box>
      {/* Action bar */}
      <Box sx={{ p: 2.25, background: 'rgba(0,0,0,0.18)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button
          onClick={onConfirm} disabled={saving} fullWidth variant="contained" startIcon={<CheckCircleOutlineIcon />}
          sx={{ py: 1.25, mb: 1, fontWeight: 800, textTransform: 'none', fontSize: 15, borderRadius: 2,
            background: 'var(--app-primary)', boxShadow: '0 10px 24px -10px rgba(var(--app-primary-rgb),0.8)',
            '&:hover': { background: 'var(--app-primary)', filter: 'brightness(1.05)' } }}
        >
          {saving ? 'Saving…' : 'Confirm Booking'}
        </Button>
        <Button
          onClick={onSave} disabled={saving} fullWidth variant="outlined" startIcon={<SaveOutlinedIcon />}
          sx={{ py: 1, mb: 1.5, fontWeight: 700, textTransform: 'none', borderRadius: 2,
            color: '#fff', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#fff', background: 'rgba(255,255,255,0.06)' } }}
        >
          Save Booking
        </Button>

        {/* Invoice & Print live on the booking card after save — here we only
            surface a quick WhatsApp confirmation. */}
        <Tooltip title={docsReady ? 'Send WhatsApp confirmation' : 'Add guest & room first'}>
          <span style={{ display: 'flex' }}>
            <Button onClick={onWhatsApp} disabled={!docsReady} fullWidth
              startIcon={<WhatsAppIcon fontSize="small" />}
              sx={{ py: 0.9, textTransform: 'none', fontWeight: 700, fontSize: 13,
                color: 'rgba(255,255,255,0.9)', borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.18)',
                '&:hover': { background: 'rgba(37,211,102,0.14)', borderColor: 'rgba(37,211,102,0.6)' } }}>
              WhatsApp confirmation
            </Button>
          </span>
        </Tooltip>

        <Button onClick={onCancel} fullWidth sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
          '&:hover': { color: '#fca5a5', background: 'transparent' } }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default ReservationSummary;
