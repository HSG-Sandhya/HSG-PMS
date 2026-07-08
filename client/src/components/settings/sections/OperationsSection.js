import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, TextField, Switch, FormControlLabel, Button,
  InputAdornment, Divider, CircularProgress, MenuItem,
} from '@mui/material';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CelebrationIcon from '@mui/icons-material/Celebration';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const D = OPERATIONS_DEFAULTS;

const merge = (saved = {}) => ({
  housekeeping: { ...D.housekeeping, ...(saved.housekeeping || {}) },
  payroll: { ...D.payroll, ...(saved.payroll || {}) },
  accounting: { ...D.accounting, ...(saved.accounting || {}) },
  banquet: { ...D.banquet, ...(saved.banquet || {}) },
  frontDesk: { ...D.frontDesk, ...(saved.frontDesk || {}) },
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
      // Coerce every numeric field to a Number (falling back to its default).
      payload.housekeeping.expectedCleaningMinutes = num(form.housekeeping.expectedCleaningMinutes, D.housekeeping.expectedCleaningMinutes);
      payload.payroll.defaultSalary = num(form.payroll.defaultSalary, D.payroll.defaultSalary);
      payload.payroll.minWalletRecharge = num(form.payroll.minWalletRecharge, D.payroll.minWalletRecharge);
      payload.payroll.payDay = num(form.payroll.payDay, D.payroll.payDay);
      payload.payroll.overtimeMultiplier = num(form.payroll.overtimeMultiplier, D.payroll.overtimeMultiplier);
      payload.accounting.financialYearStartMonth = num(form.accounting.financialYearStartMonth, D.accounting.financialYearStartMonth);
      payload.banquet.advancePercent = num(form.banquet.advancePercent, D.banquet.advancePercent);
      payload.banquet.quotationValidityDays = num(form.banquet.quotationValidityDays, D.banquet.quotationValidityDays);
      payload.banquet.defaultEventHours = num(form.banquet.defaultEventHours, D.banquet.defaultEventHours);
      payload.banquet.minAdvanceAmount = num(form.banquet.minAdvanceAmount, D.banquet.minAdvanceAmount);
      payload.frontDesk.holdExpiryHours = num(form.frontDesk.holdExpiryHours, D.frontDesk.holdExpiryHours);
      payload.frontDesk.lateCheckoutGraceMinutes = num(form.frontDesk.lateCheckoutGraceMinutes, D.frontDesk.lateCheckoutGraceMinutes);
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
  const bq = form.banquet;
  const fd = form.frontDesk;

  const toggle = (title, desc, checked, onChange) => (
    <FormControlLabel
      control={<Switch checked={!!checked} onChange={(e) => onChange(e.target.checked)} />}
      label={
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{desc}</Typography>
        </Box>
      }
    />
  );

  return (
    <Stack spacing={2.5}>
      {/* ── Housekeeping ─────────────────────────────────────────── */}
      <FormSection title="Housekeeping" icon={<CleaningServicesIcon fontSize="small" />} iconColor="#0ea5e9">
        <Stack spacing={2}>
          {toggle(
            'Auto-create cleaning task on checkout',
            'Raise a housekeeping task automatically when a guest checks out.',
            hk.autoCreateOnCheckout,
            (v) => setGroup('housekeeping', { autoCreateOnCheckout: v }),
          )}
          {toggle(
            'Require inspection after cleaning',
            'A completed cleaning goes to “Inspection” before the room is marked Clean.',
            hk.requireInspection,
            (v) => setGroup('housekeeping', { requireInspection: v }),
          )}
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
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Checkout cleaning priority" fullWidth
              value={hk.checkoutCleaningPriority}
              onChange={(e) => setGroup('housekeeping', { checkoutCleaningPriority: e.target.value })}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField label="Expected cleaning time" type="number" fullWidth
              value={hk.expectedCleaningMinutes}
              onChange={(e) => setGroup('housekeeping', { expectedCleaningMinutes: e.target.value })}
              helperText="Stamped on auto-created cleaning tasks"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">min</InputAdornment> } }} />
          </Stack>
        </Stack>
      </FormSection>

      {/* ── Front desk & reservations ────────────────────────────── */}
      <FormSection title="Front desk & reservations" icon={<MeetingRoomIcon fontSize="small" />} iconColor="#6366f1">
        <Stack spacing={2}>
          {toggle(
            'Require ID proof to book',
            'Block creating a booking unless a guest ID (number or photo) is captured.',
            fd.requireIdProof,
            (v) => setGroup('frontDesk', { requireIdProof: v }),
          )}
          {toggle(
            'Allow overbooking',
            'Permit booking a room that is already occupied for the same dates.',
            fd.allowOverbooking,
            (v) => setGroup('frontDesk', { allowOverbooking: v }),
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Tentative hold expires after" type="number" fullWidth
              value={fd.holdExpiryHours}
              onChange={(e) => setGroup('frontDesk', { holdExpiryHours: e.target.value })}
              helperText="Auto-release an unconfirmed hold after this many hours"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">hrs</InputAdornment> } }} />
            <TextField label="Late-checkout grace" type="number" fullWidth
              value={fd.lateCheckoutGraceMinutes}
              onChange={(e) => setGroup('frontDesk', { lateCheckoutGraceMinutes: e.target.value })}
              helperText="Free window after checkout time; then ½ night is charged"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">min</InputAdornment> } }} />
            <TextField label="Full night charged after" type="time" fullWidth
              value={fd.lateCheckoutFullDayAfter}
              onChange={(e) => setGroup('frontDesk', { lateCheckoutFullDayAfter: e.target.value })}
              helperText="Checkout past this time = a full night's tariff"
              slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        </Stack>
      </FormSection>

      {/* ── Banquet ──────────────────────────────────────────────── */}
      <FormSection title="Banquet bookings" icon={<CelebrationIcon fontSize="small" />} iconColor="#ec4899">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Advance to confirm" type="number" fullWidth
              value={bq.advancePercent}
              onChange={(e) => setGroup('banquet', { advancePercent: e.target.value })}
              helperText="% of total shown on the quotation as advance-to-confirm"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
            <TextField label="Quotation valid for" type="number" fullWidth
              value={bq.quotationValidityDays}
              onChange={(e) => setGroup('banquet', { quotationValidityDays: e.target.value })}
              helperText="Validity window printed on the quotation"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Minimum advance" type="number" fullWidth
              value={bq.minAdvanceAmount}
              onChange={(e) => setGroup('banquet', { minAdvanceAmount: e.target.value })}
              helperText="Floor on the advance figure (0 = just use the %)"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> } }} />
            <TextField label="Default event duration" type="number" fullWidth
              value={bq.defaultEventHours}
              onChange={(e) => setGroup('banquet', { defaultEventHours: e.target.value })}
              helperText="Pre-fills a new event's length"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">hrs</InputAdornment> } }} />
          </Stack>
        </Stack>
      </FormSection>

      {/* ── Payroll ──────────────────────────────────────────────── */}
      <FormSection title="Payroll" icon={<PaymentsIcon fontSize="small" />} iconColor="#10b981">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Default salary" type="number" fullWidth
              value={pr.defaultSalary}
              onChange={(e) => setGroup('payroll', { defaultSalary: e.target.value })}
              helperText="Used when a staff record has no salary set"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> } }} />
            <TextField label="Minimum wallet recharge" type="number" fullWidth
              value={pr.minWalletRecharge}
              onChange={(e) => setGroup('payroll', { minWalletRecharge: e.target.value })}
              helperText="Smallest allowed staff wallet top-up"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> } }} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Pay day (of month)" type="number" fullWidth
              value={pr.payDay}
              onChange={(e) => setGroup('payroll', { payDay: e.target.value })}
              helperText="Salary pay date on payslips + the pay-day reminder" />
            <TextField label="Overtime rate" type="number" fullWidth
              value={pr.overtimeMultiplier}
              onChange={(e) => setGroup('payroll', { overtimeMultiplier: e.target.value })}
              helperText="× hourly rate for overtime"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">×</InputAdornment> } }} />
          </Stack>
        </Stack>
      </FormSection>

      {/* ── Accounting ───────────────────────────────────────────── */}
      <FormSection title="Accounting" icon={<AccountBalanceIcon fontSize="small" />} iconColor="#f59e0b">
        <Stack spacing={2}>
          {toggle(
            'Auto-post to accounting ledger',
            'Mirror room / POS / banquet income and payroll expenses into the ledger automatically.',
            ac.autoPostIncome,
            (v) => setGroup('accounting', { autoPostIncome: v }),
          )}
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
            <TextField select label="Financial year starts" fullWidth
              value={ac.financialYearStartMonth}
              onChange={(e) => setGroup('accounting', { financialYearStartMonth: e.target.value })}
              helperText="India: April">
              {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
            </TextField>
          </Stack>
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
