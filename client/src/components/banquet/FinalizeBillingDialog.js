import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, Grid, Stack, Divider, Button, IconButton } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import { roundBanquetTotal, facilityItemAmount, sumFacilityItems, banquetGstFraction } from '../../pages/management/banquet/bookingPricing';
import { isGstExemptType } from '../../pages/management/banquet/bookingConstants';

const fmt = (n) =>
  `${currencySym()}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const days = (it) => Math.max(1, Number(it?.days) || 1);
// Catering line amount (PRE-GST) at a given plate count.
const lineAmount = (perPlate, plates, d) =>
  (Number(perPlate) || 0) * (parseInt(plates, 10) || 0) * Math.max(1, Number(d) || 1);
const estAmount = (it) => lineAmount(it?.perPlate, it?.plates, it?.days);
// Catering is billed with the configured banquet GST added on top. `booking.totalAmount` includes
// this GST, so the catering figures here must be gross too or "other charges"
// (total − catering) would wrongly absorb the tax. Mirrors the invoice + form.
// GST-exempt events (weddings) carry no tax, so their catering stays at base.
const withGst = (base, gstExempt = false) => {
  const n = Number(base) || 0;
  return gstExempt ? n : n + Math.round(n * banquetGstFraction());
};

/**
 * Post-event billing for one banquet booking. Catering is quoted on estimated
 * plates; after the event staff enter the ACTUAL plates consumed here and the
 * catering charge, grand total and balance are recomputed from those actuals.
 * Venue / décor / other charges are left untouched — only the catering portion
 * of totalAmount changes. Saves via updateBooking (which re-syncs accounting).
 */
const FinalizeBillingDialog = ({ open, onClose, booking, onUpdated }) => {
  const [actuals, setActuals] = useState({}); // line index -> string
  const [extras, setExtras] = useState([]);  // items taken during the event
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
      // Re-opening a settled booking shows what was already billed, so the
      // list can be corrected rather than duplicated.
      setExtras(
        (Array.isArray(booking.postEventItems) ? booking.postEventItems : []).map((it) => ({
          name: it.name || '',
          detail: it.detail || '',
          price: it.price != null && it.price !== 0
            ? it.price
            : (Number(it.amount) || 0) / Math.max(1, Number(it.quantity) || 1),
          gstPercent: it.price != null && it.price !== 0 ? (it.gstPercent || 0) : 0,
          quantity: it.quantity != null ? it.quantity : 1,
        })),
      );
      setError('');
    }
  }, [open, booking, items]);

  if (!booking) return null;

  // Fixed (non-catering) charges stay as quoted. Take them straight from the
  // booking's own components — venue, rooms, décor, utensils, facilities and
  // vendor extras, all already GST-inclusive. Deriving this as `total − catering`
  // was fragile: an older booking whose stored total didn't yet include the 18%
  // catering GST produced a NEGATIVE "other charges" and left the new total wrong.
  const nonCatering =
    (Number(booking.floorCost) || 0) +
    (Number(booking.roomsCost) || 0) +
    (Number(booking.decorationCost) || 0) +
    (Number(booking.utensilsCost) || 0) +
    (Number(booking.extrasCost) || 0) +
    (Number(booking.photographyAmount) || 0) +
    (Number(booking.entertainmentCost) || 0);
  const total = Number(booking.totalAmount) || 0; // stored "quoted" total (reference)

  const gstExempt = isGstExemptType(booking.eventType);
  const newCateringSum = items.reduce((s, it, i) => s + withGst(lineAmount(it.perPlate, actuals[i], it.days), gstExempt), 0);
  // Items the host took on the day. Priced with the same ex-GST-in / gross-out
  // rule as the booking form's facilities, so one line means the same money
  // wherever it is entered. `nonCatering` deliberately excludes the stored
  // postEventCost — these are recomputed live from the editable list, and
  // counting both would bill the extras twice.
  const postEventSum = sumFacilityItems(extras, gstExempt);
  // Same rules as the booking form: the discount agreed at booking still applies
  // to the actuals (capped at the gross), and the re-billed total is rounded UP
  // to the next ₹100 so the amount collected at the desk stays a round sum.
  const gross = nonCatering + newCateringSum + postEventSum;
  const discount = Math.min(gross, Math.max(0, Number(booking.discount) || 0));
  const newTotal = roundBanquetTotal(gross - discount);

  const collected = (Array.isArray(booking.payments) && booking.payments.length)
    ? booking.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : (Number(booking.advanceAmount) || 0);
  const newBalance = Math.max(0, newTotal - collected);

  // A booking with no catering can still be settled — the host may only have
  // taken extras on the day.
  const canSubmit = items.length > 0 || extras.length > 0;

  const addExtra = () =>
    setExtras((p) => [...p, { name: '', detail: '', price: 0, gstPercent: gstExempt ? 0 : 18, quantity: 1 }]);
  const updateExtra = (idx, patch) =>
    setExtras((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeExtra = (idx) => setExtras((p) => p.filter((_, i) => i !== idx));

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
      // Keep the ex-GST inputs AND the gross amount the invoice bills, so the
      // line stays editable later and the money stays exact. Unnamed or
      // zero-value rows are dropped rather than saved as blanks.
      const postEventItems = extras
        .filter((it) => (it.name || '').trim() && facilityItemAmount(it, gstExempt) > 0)
        .map((it) => ({
          name: it.name.trim(),
          detail: (it.detail || '').trim(),
          price: Number(it.price) || 0,
          gstPercent: Number(it.gstPercent) || 0,
          quantity: parseInt(it.quantity, 10) || 1,
          amount: facilityItemAmount(it, gstExempt),
        }));
      const { data } = await api.banquet.updateBooking(booking._id, {
        cateringItems,
        postEventItems,
        postEventCost: postEventItems.reduce((sum, it) => sum + it.amount, 0),
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
      onSubmit={canSubmit ? handleSubmit : null}
      submitLabel={saving ? 'Finalizing…' : 'Finalize & update bill'}
      submitDisabled={saving || !canSubmit}
    >
      <FormSection>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 0.5
          }}>
          {booking.customerName} · {booking.eventType} · {fmtDate(booking.eventDate)}
          {booking.billingFinalized ? '  ·  already finalized' : ''}
        </Typography>
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          Enter the actual plates consumed for each catering line, and list anything the host took
          on the day that was not booked. The catering charge, extras, grand total and balance
          update from what you enter; venue, décor and other quoted charges stay as they are.
        </Typography>
      </FormSection>
      {items.length === 0 ? (
        <FormSection>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            This booking has no catering lines to finalize.
          </Typography>
        </FormSection>
      ) : (
        <FormSection title="Catering — actual plates consumed">
          <Stack divider={<Divider />} spacing={0}>
            {items.map((it, i) => (
              <Box key={i} sx={{ py: 1.25 }}>
                <Grid container spacing={1.5} sx={{
                  alignItems: "center"
                }}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 5
                    }}>
                    <Typography variant="body2" sx={{
                      fontWeight: 700
                    }}>{it.name || 'Catering Package'}</Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      {fmt(it.perPlate)}/plate{days(it) > 1 ? ` × ${days(it)} days` : ''} · Est. {Number(it.plates) || 0} plates ({fmt(estAmount(it))})
                    </Typography>
                  </Grid>
                  <Grid
                    size={{
                      xs: 6,
                      sm: 3
                    }}>
                    <TextField
                      fullWidth size="small" type="number" label="Actual plates"
                      value={actuals[i] ?? ''}
                      onChange={(e) => setActuals((p) => ({ ...p, [i]: e.target.value }))}
                      slotProps={{
                        htmlInput: { min: 0 }
                      }}
                    />
                  </Grid>
                  <Grid
                    sx={{ textAlign: 'right' }}
                    size={{
                      xs: 6,
                      sm: 4
                    }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: 'block'
                      }}>Line amount</Typography>
                    <Typography variant="subtitle2" sx={{
                      fontWeight: 800
                    }}>
                      {fmt(lineAmount(it.perPlate, actuals[i], it.days))}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </FormSection>
      )}
      <FormSection>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Extras taken during the event
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addExtra} sx={{ textTransform: 'none', borderRadius: '999px' }}>
            Add item
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Anything served or hired beyond the booking — an extra round of starters, more mineral
          water, a second mic. Enter the price {gstExempt ? 'per unit' : 'per unit excluding GST'};
          the line total is what gets billed{gstExempt ? '' : ', GST included'}. These print on the
          invoice under their own heading.
        </Typography>
        {extras.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No extras taken.
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={0}>
            {extras.map((it, idx) => (
              <Box key={idx} sx={{ py: 1.25 }}>
                <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth size="small" label="Item"
                      placeholder="Paneer Tikka"
                      value={it.name}
                      onChange={(e) => updateExtra(idx, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <TextField
                      fullWidth size="small" type="number" label={`Price (${currencySym()})`}
                      value={it.price}
                      onChange={(e) => updateExtra(idx, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                      helperText={gstExempt ? 'Per unit' : 'Excluding GST'}
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 1.5 }}>
                    <TextField
                      fullWidth size="small" type="number" label="Qty"
                      value={it.quantity}
                      onChange={(e) => { if (/^\d*$/.test(e.target.value)) updateExtra(idx, { quantity: e.target.value }); }}
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 1.5 }}>
                    <TextField
                      fullWidth size="small" type="number" label="GST %"
                      value={gstExempt ? 0 : it.gstPercent}
                      disabled={gstExempt}
                      onChange={(e) => updateExtra(idx, { gstPercent: Math.max(0, Math.min(28, parseFloat(e.target.value) || 0)) })}
                      helperText={gstExempt ? 'Exempt event' : ''}
                      slotProps={{ htmlInput: { min: 0, max: 28 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 10, sm: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Line total</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {fmt(facilityItemAmount(it, gstExempt))}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 2, sm: 1 }} sx={{ textAlign: 'right' }}>
                    <IconButton size="small" onClick={() => removeExtra(idx)} sx={{ color: '#ef4444' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      fullWidth size="small" label="Note (optional)"
                      placeholder="Served at dinner"
                      value={it.detail || ''}
                      onChange={(e) => updateExtra(idx, { detail: e.target.value })}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
            <Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'right', pt: 1.25, color: 'var(--app-primary)' }}>
              Extras total: {fmt(postEventSum)}
            </Typography>
          </Stack>
        )}
      </FormSection>
      <FormSection title="Revised bill">
        <Grid container spacing={1.5}>
          <Summary label="Other charges" value={fmt(nonCatering)} />
          <Summary label={gstExempt ? 'Catering (actual)' : `Catering (actual, incl. ${Math.round(banquetGstFraction() * 100)}% GST)`} value={fmt(newCateringSum)} color="#6366f1" />
          {postEventSum > 0 && <Summary label="Extras taken" value={fmt(postEventSum)} color="#b45309" />}
          {discount > 0 && <Summary label="Discount" value={`− ${fmt(discount)}`} color="#dc2626" />}
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
  <Grid
    size={{
      xs: 6,
      sm: 4
    }}>
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

export default FinalizeBillingDialog;
