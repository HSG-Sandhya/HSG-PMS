import { useState, useEffect } from 'react';
import {
  Box, TextField, MenuItem, Grid, ToggleButton, ToggleButtonGroup,
  Typography, InputAdornment,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FormDialog, { FormSection } from '../forms/FormDialog';
import AppDatePicker from '../forms/AppDatePicker';
import { currencySym } from '../../utils/billing';
import api from '../../api';
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, ACCOUNTS, GST_RATES,
  toInputDate, fmt, INCOME_COLOR, EXPENSE_COLOR,
} from './accountingShared';

const emptyEntry = {
  date: toInputDate(new Date()),
  entryType: 'income',
  category: '',
  account: 'Cash',
  party: '',
  description: '',
  amount: '',
  gstRate: 0,
  reference: '',
};

const AccountingEntryDialog = ({ open, onClose, entry, onSaved, onNotify }) => {
  const [form, setForm] = useState(emptyEntry);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        date: toInputDate(entry.date),
        entryType: entry.entryType || 'income',
        category: entry.category || '',
        account: entry.account || 'Cash',
        party: entry.party || '',
        description: entry.description || '',
        amount: entry.amount ?? '',
        gstRate: entry.gstRate || 0,
        reference: entry.reference || '',
      });
    } else {
      setForm(emptyEntry);
    }
  }, [open, entry]);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const categories = form.entryType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const base = Number(form.amount) || 0;
  const gst = Math.round(base * (Number(form.gstRate) || 0)) / 100;
  const total = Math.round((base + gst) * 100) / 100;

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.category.trim()) { onNotify?.('Pick a category', 'error'); return; }
    if (!(Number(form.amount) > 0)) { onNotify?.('Enter a positive amount', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount) || 0,
        gstRate: Number(form.gstRate) || 0,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      };
      if (entry?._id) await api.accounting.updateEntry(entry._id, payload);
      else await api.accounting.createEntry(payload);
      onNotify?.(`Entry ${entry ? 'updated' : 'recorded'}`, 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const accent = form.entryType === 'income' ? INCOME_COLOR : EXPENSE_COLOR;

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={handleSave}
      maxWidth="sm"
      icon={<ReceiptLongIcon />}
      eyebrow="Accounting"
      title={entry ? 'Edit entry' : 'New entry'}
      submitDisabled={saving}
      submitLabel={saving ? 'Saving…' : (entry ? 'Save changes' : 'Add entry')}
    >
      <FormSection title="Entry Type" icon={<ReceiptLongIcon fontSize="small" />} iconColor={accent}>
        <ToggleButtonGroup
          exclusive size="small" value={form.entryType}
          onChange={(e, v) => v && setForm((prev) => ({ ...prev, entryType: v, category: '' }))}
          sx={{
            '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 3 },
            '& .Mui-selected': { color: '#fff !important' },
            '& .MuiToggleButton-root.Mui-selected[value="income"]': { background: INCOME_COLOR },
            '& .MuiToggleButton-root.Mui-selected[value="expense"]': { background: EXPENSE_COLOR },
          }}
        >
          <ToggleButton value="income">Income</ToggleButton>
          <ToggleButton value="expense">Expense</ToggleButton>
        </ToggleButtonGroup>
      </FormSection>

      <FormSection title="Details">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <AppDatePicker label="Date" value={form.date} onChange={(v) => set('date', v)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Account" value={form.account} onChange={(e) => set('account', e.target.value)}>
              {ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label={form.entryType === 'income' ? 'Customer / party' : 'Vendor / party'}
              value={form.party} onChange={(e) => set('party', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth type="number" label="Amount (taxable)" value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="GST rate" value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)}>
              {GST_RATES.map((r) => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Reference / voucher no." value={form.reference} onChange={(e) => set('reference', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Taxable {fmt(base)} · GST {fmt(gst)}</Typography>
          <Typography variant="subtitle1" fontWeight={800} sx={{ color: accent }}>Total {fmt(total)}</Typography>
        </Box>
      </FormSection>
    </FormDialog>
  );
};

export default AccountingEntryDialog;
