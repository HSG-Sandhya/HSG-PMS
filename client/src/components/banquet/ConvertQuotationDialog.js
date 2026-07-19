import { useState, useEffect, useMemo } from 'react';
import {
  Box, Grid, Typography, Stack, Divider, TextField, MenuItem,
  Radio, Checkbox, FormControlLabel, Chip, Alert,
} from '@mui/material';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import { packageTotal, addOnTotal } from './quotationPresets';

const money = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Turns an accepted quotation into a banquet booking: staff pick the package the
 * client went with, tick any optional facilities taken, confirm the final head
 * count, and the booking is created — from there the normal invoice/billing
 * flow applies.
 */
const ConvertQuotationDialog = ({ open, onClose, quotation, onConverted, onNotify }) => {
  const [packageIndex, setPackageIndex] = useState(0);
  const [addOnIndexes, setAddOnIndexes] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('Confirmed');
  const [saving, setSaving] = useState(false);

  const packages = useMemo(() => quotation?.packages || [], [quotation]);
  const addOns = useMemo(() => (quotation?.addOns || []).filter((a) => a?.name), [quotation]);

  useEffect(() => {
    if (!open || !quotation) return;
    // Pre-select whatever was marked accepted, else the recommended column.
    const accepted = Number(quotation.acceptedPackageIndex);
    const recommended = packages.findIndex((p) => p.recommended);
    const initial = accepted >= 0 ? accepted : (recommended >= 0 ? recommended : 0);
    setPackageIndex(initial);
    setAddOnIndexes([]);
    setQuantity(String(packages[initial]?.quantity || quotation.expectedGuests || ''));
    setStatus('Confirmed');
  }, [open, quotation, packages]);

  const chosen = packages[packageIndex];
  const perHead = chosen && ['per person', 'per plate'].includes(chosen.priceBasis);
  const qty = Number(quantity) || Number(chosen?.quantity) || Number(quotation?.expectedGuests) || 0;

  const packageAmount = chosen
    ? packageTotal({ ...chosen, quantity: qty }, quotation?.expectedGuests)
    : 0;
  const addOnsAmount = addOnIndexes.reduce((s, i) => s + addOnTotal(addOns[i]), 0);
  const total = packageAmount + addOnsAmount;

  const toggleAddOn = (i) => setAddOnIndexes((prev) => (
    prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
  ));

  const handleConvert = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!chosen) { onNotify?.('Select the accepted package', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.banquet.convertQuotation(quotation._id, {
        packageIndex, addOnIndexes, quantity: qty, status,
      });
      onNotify?.(data?.message || 'Booking created from quotation', 'success');
      onConverted?.(data?.data);
      onClose?.();
    } catch (err) {
      onNotify?.(err.response?.data?.message || err.response?.data?.error || 'Conversion failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!quotation) return null;

  const blockers = [
    !quotation.eventDate && 'an event date',
    !quotation.clientPhone && 'a contact number',
  ].filter(Boolean);

  // A per-head package with no head count would price at ₹0 — the server
  // refuses it, so surface the reason here rather than on submit.
  const needsHeadCount = perHead && qty <= 0;

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={handleConvert}
      maxWidth="sm"
      icon={<EventAvailableOutlinedIcon />}
      eyebrow={quotation.quotationNumber}
      title="Convert quotation to booking"
      submitDisabled={saving || blockers.length > 0 || needsHeadCount}
      submitLabel={saving ? 'Creating…' : 'Create booking'}
    >
      {blockers.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          This quotation needs {blockers.join(' and ')} before it can become a booking. Edit the quotation to add {blockers.length > 1 ? 'them' : 'it'}.
        </Alert>
      )}
      {needsHeadCount && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          “{chosen?.name}” is charged {chosen?.priceBasis} — enter the final head count below before creating the booking.
        </Alert>
      )}

      <FormSection title="Accepted package" icon={<EventAvailableOutlinedIcon fontSize="small" />} iconColor="#10b981">
        <Stack spacing={1} sx={{ mt: 1 }}>
          {packages.map((p, i) => (
            <Box
              key={i}
              onClick={() => { setPackageIndex(i); setQuantity(String(p.quantity || quotation.expectedGuests || '')); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, cursor: 'pointer',
                border: '1px solid', borderColor: i === packageIndex ? 'success.main' : 'divider',
                background: i === packageIndex ? 'rgba(16,185,129,.06)' : 'transparent',
              }}
            >
              <Radio checked={i === packageIndex} size="small" />
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800 }}>{p.name}</Typography>
                  {p.recommended && <Chip size="small" label="Recommended" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {money(p.price)} {p.priceBasis}{Number(p.days) > 1 ? ` · ${p.days} days` : ''}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: 'var(--app-primary)' }}>
                {money(packageTotal({ ...p, quantity: i === packageIndex ? qty : p.quantity }, quotation.expectedGuests))}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth type="number" size="small"
              label={perHead ? 'Final plates / pax' : 'Head count'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!perHead}
              helperText={perHead ? 'Drives the billed amount' : 'Flat-priced package'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth size="small" label="Booking status" value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="Confirmed">Confirmed</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </FormSection>

      {addOns.length > 0 && (
        <FormSection title="Facilities taken" icon={<EventAvailableOutlinedIcon fontSize="small" />} iconColor="#6366f1">
          <Stack sx={{ mt: 0.5 }}>
            {addOns.map((a, i) => (
              <FormControlLabel
                key={i}
                control={<Checkbox size="small" checked={addOnIndexes.includes(i)} onChange={() => toggleAddOn(i)} />}
                label={
                  <Typography variant="body2">
                    {a.name} — <b>{money(addOnTotal(a))}</b>
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {' '}({money(a.price)} {a.unit}{a.gstPercent ? ` + ${a.gstPercent}% GST` : ''})
                    </Typography>
                  </Typography>
                }
              />
            ))}
          </Stack>
        </FormSection>
      )}

      <FormSection title="Booking total">
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{chosen?.name || 'Package'}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(packageAmount)}</Typography>
          </Stack>
          {addOnsAmount > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Facilities ({addOnIndexes.length}, incl. GST)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(addOnsAmount)}</Typography>
            </Stack>
          )}
          <Divider />
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 800 }}>Booking total</Typography>
            <Typography sx={{ fontWeight: 800, color: 'var(--app-primary)' }}>{money(total)}</Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            The booking opens with no advance recorded — collect payments from the Bookings tab, then print the invoice.
          </Typography>
        </Stack>
      </FormSection>
    </FormDialog>
  );
};

export default ConvertQuotationDialog;
