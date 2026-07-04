import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Divider,
  Stack,
  MenuItem,
  Alert,
  CircularProgress,
  useTheme,
  InputAdornment,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import api from '../../api';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from './formStyles';
import { useBilling } from '../../hooks/useBilling';
import { currencySym } from '../../utils/billing';

const METHODS = ['Cash', 'Card', 'UPI', 'Net Banking', 'Other'];

const moneyRow = (label, value, opts = {}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
    <Typography sx={{ fontSize: 13, color: opts.muted ? 'text.secondary' : 'inherit' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 13, fontWeight: opts.bold ? 700 : 500, color: opts.color || 'inherit' }}>
      {value}
    </Typography>
  </Box>
);

const SettleBalanceDialog = ({ open, onClose, booking, onSettled }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const billing = useBilling();

  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !booking?._id) return;
    setLoadingOrders(true);
    api.restaurant.getOrdersByBooking(booking._id)
      .then((res) => setRestaurantOrders(res.data || []))
      .catch(() => setRestaurantOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [open, booking?._id]);

  useEffect(() => {
    if (!open) {
      setPaymentMethod('Cash');
      setPaymentReference('');
      setPaymentAmount(0);
    }
  }, [open]);

  const { roomTotal, foodSubtotal, foodGst, foodTotal, grandTotal, paidAmount, balance } = useMemo(() => {
    const rt = Number(booking?.totalAmount || 0);
    const fs = restaurantOrders.reduce((t, o) => t + (Number(o.totalAmount) || 0), 0);
    const fg = Math.round(fs * (billing.posGstRate / 100) * 100) / 100;
    const ft = fs + fg;
    const gt = rt + ft;
    const pa = Number(booking?.paidAmount || 0);
    const bal = Math.max(0, gt - pa);
    return {
      roomTotal: rt,
      foodSubtotal: fs,
      foodGst: fg,
      foodTotal: ft,
      grandTotal: gt,
      paidAmount: pa,
      balance: bal,
    };
  }, [booking, restaurantOrders, billing.posGstRate]);

  useEffect(() => {
    if (open && !loadingOrders) {
      setPaymentAmount(balance);
    }
  }, [open, loadingOrders, balance]);

  const amountNum = Number(paymentAmount) || 0;
  const canSubmit = balance > 0 && amountNum > 0 && amountNum <= balance && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const newPaid = paidAmount + amountNum;
      await api.bookings.update(booking._id, {
        paidAmount: newPaid,
        paymentMethod,
        paymentReference,
        paymentDate: new Date(),
        paymentStatus: newPaid >= grandTotal ? 'Paid' : 'Partial',
      });
      onSettled?.({ amount: amountNum, method: paymentMethod, reference: paymentReference });
      onClose?.();
    } catch (err) {
      console.error('Settle balance failed', err);
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: dialogBackdropSx },
        paper: { sx: dialogPaperSx(isDarkMode) }
      }}>
      <Box sx={headerWrapSx(isDarkMode)}>
        <Stack direction="row" spacing={1.5} sx={{
          alignItems: "center"
        }}>
          <PaymentsOutlinedIcon sx={{ color: 'var(--app-primary)' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Settle balance
            </Typography>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Record an additional payment against this booking.
            </Typography>
          </Box>
        </Stack>
      </Box>
      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
        <Box sx={sectionCardSx(isDarkMode)}>
          <Typography sx={sectionTitleSx(isDarkMode)}>Bill summary</Typography>
          {loadingOrders ? (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: "center",
                py: 2
              }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>Loading food bill…</Typography>
            </Stack>
          ) : (
            <>
              {moneyRow('Room total (incl. GST)', `${currencySym()}${roomTotal.toFixed(2)}`)}
              {foodSubtotal > 0 && (
                <>
                  {moneyRow('Food & beverage', `${currencySym()}${foodSubtotal.toFixed(2)}`)}
                  {moneyRow(`Food GST (${billing.posGstRate}%)`, `${currencySym()}${foodGst.toFixed(2)}`, { muted: true })}
                  {moneyRow('Food total (incl. GST)', `${currencySym()}${foodTotal.toFixed(2)}`, { bold: true })}
                </>
              )}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow('Grand total', `${currencySym()}${grandTotal.toFixed(2)}`, { bold: true })}
              {moneyRow('Already paid', `− ${currencySym()}${paidAmount.toFixed(2)}`, { color: 'success.main' })}
              <Divider sx={{ my: 1.5, opacity: isDarkMode ? 0.2 : 0.4 }} />
              {moneyRow(
                'Balance due',
                `${currencySym()}${balance.toFixed(2)}`,
                { bold: true, color: balance > 0 ? 'error.main' : 'success.main' },
              )}
            </>
          )}
        </Box>

        {!loadingOrders && balance === 0 && (
          <Alert severity="success" sx={{ mt: 2.5 }}>
            No outstanding balance — this booking is fully settled.
          </Alert>
        )}

        {!loadingOrders && balance > 0 && (
          <Box sx={{ ...sectionCardSx(isDarkMode), mt: 2.5 }}>
            <Typography sx={sectionTitleSx(isDarkMode)}>Payment</Typography>
            <Stack spacing={2}>
              <TextField
                label="Amount"
                type="number"
                size="small"
                fullWidth
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                helperText={
                  amountNum > balance
                    ? `Cannot exceed balance of ${currencySym()}${balance.toFixed(2)}`
                    : `Default: full balance ${currencySym()}${balance.toFixed(2)}`
                }
                error={amountNum > balance}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment>,
                  }
                }}
              />
              <TextField
                label="Method"
                select
                size="small"
                fullWidth
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
              {paymentMethod !== 'Cash' && (
                <TextField
                  label="Reference / Txn ID"
                  size="small"
                  fullWidth
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Optional"
                />
              )}
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={actionsBarSx(isDarkMode)}>
        <Button onClick={onClose} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <PaymentsOutlinedIcon />}
          sx={primaryButtonSx}
        >
          {submitting ? 'Recording…' : `Record ${currencySym()}${amountNum.toFixed(2)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettleBalanceDialog;
