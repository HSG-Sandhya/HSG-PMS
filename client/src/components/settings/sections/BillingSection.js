import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, TextField, Switch, FormControlLabel, Button,
  InputAdornment, Divider, CircularProgress, MenuItem,
} from '@mui/material';
import PercentIcon from '@mui/icons-material/Percent';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import SaveIcon from '@mui/icons-material/Save';
import { useSettings } from '../../../contexts/SettingsContext';
import api from '../../../api';
import { FormSection } from '../../forms/FormDialog';
import { BILLING_DEFAULTS } from '../../../config/operationalDefaults';

// A handful of common ISO codes/symbols so the admin can switch currency without
// typing the glyph; the symbol field still accepts any free-form value.
const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AED', symbol: 'د.إ' },
];

const num = (v, fallback) => (v === '' || v === null || isNaN(Number(v)) ? fallback : Number(v));

const BillingSection = ({ onNotify }) => {
  const { settings, reload: reloadSettings } = useSettings();
  const [form, setForm] = useState(BILLING_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...BILLING_DEFAULTS, ...(settings?.billing || {}) });
  }, [settings?.billing]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        roomGstRate: num(form.roomGstRate, BILLING_DEFAULTS.roomGstRate),
        posGstRate: num(form.posGstRate, BILLING_DEFAULTS.posGstRate),
        breakfastChargePerNight: num(form.breakfastChargePerNight, BILLING_DEFAULTS.breakfastChargePerNight),
        banquetVenueHourlyRate: num(form.banquetVenueHourlyRate, BILLING_DEFAULTS.banquetVenueHourlyRate),
        maxDiscountPercent: num(form.maxDiscountPercent, BILLING_DEFAULTS.maxDiscountPercent),
        invoicePrefix: String(form.invoicePrefix || BILLING_DEFAULTS.invoicePrefix).trim().toUpperCase(),
      };
      await api.settings.updateSection('billing', payload);
      await reloadSettings?.();
      // Nudge any open consumer (booking form, cards) to re-read immediately.
      window.dispatchEvent(new Event('pms:settings-changed'));
      onNotify?.('Billing & tariff settings saved', 'success');
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const symbol = form.currencySymbol || '₹';

  return (
    <Stack spacing={2.5}>
      <FormSection title="Tax & charges" icon={<PercentIcon fontSize="small" />} iconColor="#6366F1">
        <Stack spacing={2}>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            GST rates apply to room tariff and restaurant/POS bills. The breakfast charge is added per night when a booking includes breakfast.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Room GST rate" type="number" fullWidth
              value={form.roomGstRate}
              onChange={(e) => set({ roomGstRate: e.target.value })}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }
              }}
            />
            <TextField
              label="Restaurant / POS GST rate" type="number" fullWidth
              value={form.posGstRate}
              onChange={(e) => set({ posGstRate: e.target.value })}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Breakfast charge (per night)" type="number" fullWidth
              value={form.breakfastChargePerNight}
              onChange={(e) => set({ breakfastChargePerNight: e.target.value })}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }
              }}
            />
            <TextField
              label="Max discount" type="number" fullWidth
              value={form.maxDiscountPercent}
              onChange={(e) => set({ maxDiscountPercent: e.target.value })}
              helperText="Upper limit a discount can reach"
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }
              }}
            />
          </Stack>
          <TextField
            label="Banquet venue rate (per hour)" type="number"
            value={form.banquetVenueHourlyRate}
            onChange={(e) => set({ banquetVenueHourlyRate: e.target.value })}
            sx={{ maxWidth: { sm: 320 } }}
            helperText="Duration-based banquet venue cost per hour"
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }
            }}
          />
        </Stack>
      </FormSection>
      <FormSection title="Default times" icon={<ScheduleIcon fontSize="small" />} iconColor="#0ea5e9">
        <Stack spacing={2}>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            Used to pre-fill new bookings when no time is entered.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Default check-in time" type="time" fullWidth
              value={form.defaultCheckInTime}
              onChange={(e) => set({ defaultCheckInTime: e.target.value })}
              slotProps={{
                inputLabel: { shrink: true }
              }}
            />
            <TextField
              label="Default check-out time" type="time" fullWidth
              value={form.defaultCheckOutTime}
              onChange={(e) => set({ defaultCheckOutTime: e.target.value })}
              slotProps={{
                inputLabel: { shrink: true }
              }}
            />
          </Stack>
        </Stack>
      </FormSection>
      <FormSection title="Currency" icon={<CurrencyRupeeIcon fontSize="small" />} iconColor="#10b981">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select label="Currency" fullWidth
            value={CURRENCIES.some((c) => c.code === form.currencyCode) ? form.currencyCode : ''}
            onChange={(e) => {
              const picked = CURRENCIES.find((c) => c.code === e.target.value);
              set({ currencyCode: e.target.value, currencySymbol: picked ? picked.symbol : form.currencySymbol });
            }}
          >
            {CURRENCIES.map((c) => (
              <MenuItem key={c.code} value={c.code}>{c.code} ({c.symbol})</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Symbol" fullWidth
            value={form.currencySymbol}
            onChange={(e) => set({ currencySymbol: e.target.value })}
            sx={{ maxWidth: { sm: 160 } }}
            helperText="Shown before amounts"
          />
        </Stack>
      </FormSection>
      <FormSection title="Invoice & rounding" icon={<ReceiptIcon fontSize="small" />} iconColor="#f59e0b">
        <Stack spacing={2}>
          <TextField
            label="Invoice prefix"
            value={form.invoicePrefix}
            onChange={(e) => set({ invoicePrefix: e.target.value })}
            sx={{ maxWidth: 260 }}
            helperText="Leads every invoice number, e.g. HSG-AB-20260616-1001"
          />
          <FormControlLabel
            control={<Switch checked={!!form.roundAmounts} onChange={(e) => set({ roundAmounts: e.target.checked })} />}
            label={
              <Box>
                <Typography sx={{
                  fontWeight: 700
                }}>Round amounts</Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  Round computed GST/charges to whole {symbol} on bookings.
                </Typography>
              </Box>
            }
          />
        </Stack>
      </FormSection>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{
            borderRadius: '999px', px: 3, fontWeight: 700,
            background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary, #8B5CF6) 100%)',
            '&:hover': { background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' },
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Stack>
  );
};

export default BillingSection;
