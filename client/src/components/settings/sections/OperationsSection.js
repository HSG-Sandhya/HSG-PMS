import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, TextField, Switch, FormControlLabel, Button,
  InputAdornment, Divider, CircularProgress, MenuItem,
} from '@mui/material';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SaveIcon from '@mui/icons-material/Save';
import { useSettings } from '../../../contexts/SettingsContext';
import { useBilling } from '../../../hooks/useBilling';
import api from '../../../api';
import { FormSection } from '../../forms/FormDialog';
import { OPERATIONS_DEFAULTS } from '../../../config/operationalDefaults';

// Option lists mirror the enums on the Housekeeping / Account / Transaction models.
const TASK_TYPES = ['Regular Cleaning', 'Deep Cleaning', 'Laundry', 'Maintenance', 'Inspection', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const ACCOUNT_TYPES = ['savings', 'current', 'credit', 'cash', 'other'];
const PAYMENT_METHODS = ['cash', 'card', 'upi', 'cheque', 'bank', 'other'];

const merge = (saved = {}) => ({
  housekeeping: { ...OPERATIONS_DEFAULTS.housekeeping, ...(saved.housekeeping || {}) },
  payroll: { ...OPERATIONS_DEFAULTS.payroll, ...(saved.payroll || {}) },
  accounting: { ...OPERATIONS_DEFAULTS.accounting, ...(saved.accounting || {}) },
});

const num = (v, fallback) => (v === '' || v === null || isNaN(Number(v)) ? fallback : Number(v));

const OperationsSection = ({ onNotify }) => {
  const { settings, reload: reloadSettings } = useSettings();
  const billing = useBilling();
  const [form, setForm] = useState(merge());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(merge(settings?.operations));
  }, [settings?.operations]);

  const setGroup = (group, patch) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], ...patch } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = merge(form);
      payload.payroll.defaultSalary = num(form.payroll.defaultSalary, OPERATIONS_DEFAULTS.payroll.defaultSalary);
      payload.payroll.minWalletRecharge = num(form.payroll.minWalletRecharge, OPERATIONS_DEFAULTS.payroll.minWalletRecharge);
      await api.settings.updateSection('operations', payload);
      await reloadSettings?.();
      window.dispatchEvent(new Event('pms:settings-changed'));
      onNotify?.('Operations settings saved', 'success');
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const symbol = billing.currencySymbol || '₹';
  const hk = form.housekeeping;
  const pr = form.payroll;
  const ac = form.accounting;

  return (
    <Stack spacing={2.5}>
      <FormSection title="Housekeeping" icon={<CleaningServicesIcon fontSize="small" />} iconColor="#0ea5e9">
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={!!hk.autoCreateOnCheckout} onChange={(e) => setGroup('housekeeping', { autoCreateOnCheckout: e.target.checked })} />}
            label={
              <Box>
                <Typography fontWeight={700}>Auto-create cleaning task on checkout</Typography>
                <Typography variant="caption" color="text.secondary">
                  Raise a housekeeping task automatically when a guest checks out.
                </Typography>
              </Box>
            }
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Default task type" fullWidth
              value={hk.defaultTaskType}
              onChange={(e) => setGroup('housekeeping', { defaultTaskType: e.target.value })}>
              {TASK_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select label="Default task priority" fullWidth
              value={hk.defaultPriority}
              onChange={(e) => setGroup('housekeeping', { defaultPriority: e.target.value })}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField select label="Checkout cleaning priority" fullWidth
              value={hk.checkoutCleaningPriority}
              onChange={(e) => setGroup('housekeeping', { checkoutCleaningPriority: e.target.value })}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>
      </FormSection>

      <FormSection title="Payroll" icon={<PaymentsIcon fontSize="small" />} iconColor="#10b981">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Default salary" type="number" fullWidth
            value={pr.defaultSalary}
            onChange={(e) => setGroup('payroll', { defaultSalary: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
            helperText="Used when a staff record has no salary set" />
          <TextField label="Minimum wallet recharge" type="number" fullWidth
            value={pr.minWalletRecharge}
            onChange={(e) => setGroup('payroll', { minWalletRecharge: e.target.value })}
            InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
            helperText="Smallest allowed staff wallet top-up" />
        </Stack>
      </FormSection>

      <FormSection title="Accounting" icon={<AccountBalanceIcon fontSize="small" />} iconColor="#f59e0b">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Default account type" fullWidth
            value={ac.defaultAccountType}
            onChange={(e) => setGroup('accounting', { defaultAccountType: e.target.value })}>
            {ACCOUNT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField select label="Default payment method" fullWidth
            value={ac.defaultPaymentMethod}
            onChange={(e) => setGroup('accounting', { defaultPaymentMethod: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
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

export default OperationsSection;
