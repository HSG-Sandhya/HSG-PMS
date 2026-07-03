import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, Grid, Stack, Divider } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const fmt = (n) =>
  `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const days = (it) => Math.max(1, Number(it?.days) || 1);
// Catering line amount at a given plate count.
const lineAmount = (perPlate, plates, d) =>
  (Number(perPlate) || 0) * (parseInt(plates, 10) || 0) * Math.max(1, Number(d) || 1);
const estAmount = (it) => lineAmount(it?.perPlate, it?.plates, it?.days);

/**
 * Post-event billing for one banquet booking. Catering is quoted on estimated
 * plates; after the event staff enter the ACTUAL plates consumed here and the
 * catering charge, grand total and balance are recomputed from those actuals.
 * Venue / décor / other charges are left untouched — only the catering portion
 * of totalAmount changes. Saves via updateBooking (which re-syncs accounting).
 */
const FinalizeBillingDialog = ({ open, onClose, booking, onUpdated }) => {
  const [actuals, setActuals] = useState({}); // line index -> string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const items = useMemo(
    () => (Array.isArray(booking?.cateringItems) ? booking.cateringItems : []),
    [booking],
  );

  useEffect(() => {
    if (open && booking) {
      const seed = {};
      items.forEach((it, i) => {
        const cur = it.actualPlates != null && it.actualPlates !== '' ? it.actualPlates : it.plates;
        seed[i] = cur != null ? String(cur) : '';
      });
      setActuals(seed);
      setError('');
    }
  }, [open, booking, items]);

  if (!booking) return null;

  // The catering amount currently baked into totalAmount (stored amount, or the
  // estimate if a line has none). Everything else in the total is "other charges".
  const currentCateringSum = items.reduce((s, it) => s + (Number(it.amount) || estAmount(it)), 0);
  const total = Number(booking.totalAmount) || 0;
  const nonCatering = total - currentCateringSum;

  const newCateringSum = items.reduce((s, it, i) => s + lineAmount(it.perPlate, actuals[i], it.days), 0);
  const newTotal = Math.max(0, nonCatering + newCateringSum);

  const collected = (Array.isArray(booking.payments) && booking.payments.length)
    ? booking.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : (Number(booking.advanceAmount) || 0);
  const newBalance = Math.max(0, newTotal - collected);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      const cateringItems = items.map((it, i) => {
        const parsed = parseInt(actuals[i], 10);
        const actualPlates = Number.isFinite(parsed) ? parsed : (Number(it.plates) || 0);
        return {
          ...it,
          actualPlates,
          amount: lineAmount(it.perPlate, actualPlates, it.days),
        };
      });
      const { data } = await api.banquet.updateBooking(booking._id, {
        cateringItems,
        totalAmount: newTotal,
        billingFinalized: true,
        finalizedAt: new Date().toISOString(),
      });
      onUpdated?.(data?.data || data);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to finalize billing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      formId="finalize-billing-form"
      icon={<FactCheckOutlinedIcon />}
      eyebrow="Banquet · Post-event"
      title="Finalize billing"
      onSubmit={items.length ? handleSubmit : null}
      submitLabel={saving ? 'Finalizing…' : 'Finalize & update bill'}
      submitDisabled={saving || !items.length}
    >
      <FormSection>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {booking.customerName} · {booking.eventType} · {fmtDate(booking.eventDate)}
          {booking.billingFinalized ? '  ·  already finalized' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Enter the actual plates consumed for each catering line. The catering charge, grand total
          and balance update from the actuals; venue, décor and other charges stay as quoted.
        </Typography>
      </FormSection>

      {items.length === 0 ? (
        <FormSection>
          <Typography variant="body2" color="text.secondary">
            This booking has no catering lines to finalize.
          </Typography>
        </FormSection>
      ) : (
        <FormSection title="Catering — actual plates consumed">
          <Stack divider={<Divider />} spacing={0}>
            {items.map((it, i) => (
              <Box key={i} sx={{ py: 1.25 }}>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <Typography variant="body2" fontWeight={700}>{it.name || 'Catering Package'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmt(it.perPlate)}/plate{days(it) > 1 ? ` × ${days(it)} days` : ''} · Est. {Number(it.plates) || 0} plates ({fmt(estAmount(it))})
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth size="small" type="number" label="Actual plates"
                      value={actuals[i] ?? ''}
                      onChange={(e) => setActuals((p) => ({ ...p, [i]: e.target.value }))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Line amount</Typography>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {fmt(lineAmount(it.perPlate, actuals[i], it.days))}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </FormSection>
      )}

      <FormSection title="Revised bill">
        <Grid container spacing={1.5}>
          <Summary label="Other charges" value={fmt(nonCatering)} />
          <Summary label="Catering (actual)" value={fmt(newCateringSum)} color="#6366f1" />
          <Summary label="New total" value={fmt(newTotal)} color="#0f7fc9" />
          <Summary label="Collected" value={fmt(collected)} color="#059669" />
          <Summary label="Balance due" value={fmt(newBalance)} color={newBalance > 0 ? '#dc2626' : '#059669'} />
          <Summary label="Quoted total" value={fmt(total)} />
        </Grid>
        {error && <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>{error}</Typography>}
      </FormSection>
    </FormDialog>
  );
};

const Summary = ({ label, value, color }) => (
  <Grid item xs={6} sm={4}>
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="subtitle2" fontWeight={800} sx={{ color: color || 'text.primary' }}>{value}</Typography>
    </Box>
  </Grid>
);

export default FinalizeBillingDialog;
