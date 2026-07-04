import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, MenuItem, Grid, Stack, Divider,
  IconButton, CircularProgress, Tooltip,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const METHODS = ['Cash', 'Card', 'UPI', 'Net Banking', 'Cheque', 'Other'];
const fmt = (n) => `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

/**
 * Advance-collection ledger for one banquet booking. Lists payments, records
 * new ones, and shows the rolling balance. Calls onUpdated(booking) with the
 * fresh booking after each change.
 */
const AdvancePaymentsDialog = ({ open, onClose, booking, onUpdated }) => {
  const [local, setLocal] = useState(booking);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setLocal(booking); }, [booking]);
  useEffect(() => {
    if (open) { setAmount(''); setMethod('Cash'); setReference(''); setNote(''); setError(''); }
  }, [open]);

  if (!local) return null;

  const total = Number(local.totalAmount) || 0;
  const payments = Array.isArray(local.payments) ? local.payments : [];
  const collected = payments.length > 0
    ? payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : (Number(local.advanceAmount) || 0);
  const balance = Math.max(0, total - collected);

  const addPayment = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await api.banquet.addPayment(local._id, { amount: amt, method, reference, note });
      const fresh = data?.data || data;
      setLocal(fresh);
      onUpdated?.(fresh);
      setAmount(''); setReference(''); setNote('');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (paymentId) => {
    if (!paymentId) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.banquet.deletePayment(local._id, paymentId);
      const fresh = data?.data || data;
      setLocal(fresh);
      onUpdated?.(fresh);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to remove payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      icon={<PaymentsIcon />}
      eyebrow="Banquet"
      title="Advance collection"
      hideCancel
      submitLabel="Close"
    >
      <FormSection>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 1.5
          }}>
          {local.customerName} · {local.eventType} · {fmtDate(local.eventDate)}
        </Typography>

        {/* Totals */}
        <Grid container spacing={1.5}>
          <Summary label="Total" value={fmt(total)} />
          <Summary label="Collected" value={fmt(collected)} color="#059669" />
          <Summary label="Balance" value={fmt(balance)} color={balance > 0 ? '#dc2626' : '#059669'} />
        </Grid>
      </FormSection>
      {/* Add payment */}
      <FormSection title="Record a Payment" icon={<AddIcon fontSize="small" />} iconColor="#10b981">
          <Grid container spacing={1.5}>
            <Grid size={6}><TextField fullWidth size="small" type="number" label={`Amount ${currencySym()}`} value={amount} onChange={(e) => setAmount(e.target.value)} /></Grid>
            <Grid size={6}>
              <TextField select fullWidth size="small" label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={6}><TextField fullWidth size="small" label="Reference / receipt no." value={reference} onChange={(e) => setReference(e.target.value)} /></Grid>
            <Grid size={6}><TextField fullWidth size="small" label="Note" value={note} onChange={(e) => setNote(e.target.value)} /></Grid>
          </Grid>
          {error && <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>{error}</Typography>}
          <Button onClick={addPayment} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : <AddIcon />}
            variant="contained" sx={{ mt: 1.5, borderRadius: '999px', textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
            Add payment
          </Button>
      </FormSection>
      {/* Ledger */}
      <FormSection title={`Ledger${payments.length > 0 ? ` · ${payments.length}` : ''}`} icon={<PaymentsIcon fontSize="small" />} iconColor="#6366f1">
        {payments.length === 0 ? (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>No payments recorded yet.</Typography>
        ) : (
          <Stack divider={<Divider />} spacing={0}>
            {payments.map((p, i) => (
              <Stack
                key={p._id || i}
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1
                }}>
                <Box>
                  <Typography variant="body2" sx={{
                    fontWeight: 700
                  }}>{fmt(p.amount)} · {p.method}</Typography>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    {fmtDate(p.date)}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}
                  </Typography>
                </Box>
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={() => removePayment(p._id)} disabled={saving} sx={{ color: '#ef4444' }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </FormSection>
    </FormDialog>
  );
};

const Summary = ({ label, value, color }) => (
  <Grid size={4}>
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>{label}</Typography>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 800,
          color: color || 'text.primary'
        }}>{value}</Typography>
    </Box>
  </Grid>
);

export default AdvancePaymentsDialog;
