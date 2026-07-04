import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Stack, Typography, Button, IconButton, Tooltip, Chip, Avatar,
  CircularProgress, TextField, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { fmt, cardSx } from './accountingShared';

const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
  { value: 'credit', label: 'Credit' },
  { value: 'cash', label: 'Cash / Petty Cash' },
  { value: 'other', label: 'Other' },
];

// Ledger payment buckets (AccountingEntry.account) an account can claim.
const PAYMENT_BUCKETS = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other'];
// Sensible defaults: a bank account catches all non-cash money; a petty-cash
// account catches Cash. ('Bank' also covers net banking / bank transfer.)
const defaultMethodsForType = (type) => (type === 'cash' ? ['Cash'] : ['Bank', 'UPI', 'Card', 'Cheque']);

// Robustly unwrap the various envelope shapes the banking API can return.
const unwrap = (response) => {
  const d = response?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

const emptyForm = () => ({
  name: '', type: 'savings', accountNumber: '', bankName: '', ifsc: '',
  branch: '', upi: '', balance: '', currency: 'INR', notes: '',
  paymentMethods: defaultMethodsForType('savings'),
});

const BankAccountsTab = ({ onNotify }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.banking.getAccounts();
      setAccounts(unwrap(res));
    } catch {
      onNotify?.('Failed to load bank accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openNew = () => { setEditId(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (a) => {
    setEditId(a._id);
    setForm({
      name: a.name || '', type: a.type || 'savings', accountNumber: a.accountNumber || '',
      bankName: a.bankName || '', ifsc: a.ifsc || '', branch: a.branch || '',
      // `balance` is the opening balance (openingBalance echoes it from the server).
      upi: a.upi || '', balance: a.openingBalance ?? a.balance ?? '', currency: a.currency || 'INR', notes: a.notes || '',
      paymentMethods: Array.isArray(a.paymentMethods) && a.paymentMethods.length
        ? a.paymentMethods
        : defaultMethodsForType(a.type || 'savings'),
    });
    setDialogOpen(true);
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim()) { onNotify?.('Account name is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, balance: Number(form.balance) || 0 };
      if (editId) {
        await api.banking.updateAccount(editId, payload);
        onNotify?.('Account updated');
      } else {
        await api.banking.createAccount(payload);
        onNotify?.('Account added');
      }
      setDialogOpen(false);
      fetchAccounts();
    } catch {
      onNotify?.(`Failed to ${editId ? 'update' : 'add'} account`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await api.banking.deleteAccount(a._id);
      onNotify?.('Account deleted', 'info');
      fetchAccounts();
    } catch {
      onNotify?.('Delete failed', 'error');
    }
  };

  const balanceOf = (a) => Number(a.currentBalance ?? a.balance) || 0;
  const totalBalance = accounts.reduce((s, a) => s + balanceOf(a), 0);

  return (
    <Box sx={cardSx}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { md: 'center' },
          mb: 2
        }}>
        <Box>
          <Typography variant="h6" sx={{
            fontWeight: 800
          }}>Bank Accounts</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {accounts.length} account{accounts.length === 1 ? '' : 's'} · Total balance {fmt(totalBalance)}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none',
            background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
          Add account
        </Button>
      </Stack>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : accounts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          No bank accounts yet. Click “Add account” to register a bank, UPI or petty-cash account.
        </Box>
      ) : (
        <Grid container spacing={2}>
          {accounts.map((a) => (
            <Grid
              key={a._id}
              size={{
                xs: 12,
                sm: 6,
                lg: 4
              }}>
              <Box sx={{ p: 2.5, borderRadius: 3, height: '100%', border: '1px solid rgba(var(--app-primary-rgb),0.12)',
                background: 'rgba(var(--app-primary-rgb),0.03)', display: 'flex', flexDirection: 'column' }}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: "center",
                    mb: 1.5
                  }}>
                  <Avatar sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.12)', color: 'var(--app-primary)' }}>
                    <AccountBalanceIcon />
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{
                      fontWeight: 800
                    }}>{a.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {a.bankName || ACCOUNT_TYPES.find((t) => t.value === a.type)?.label || a.type}
                    </Typography>
                  </Box>
                  <Chip size="small" label={ACCOUNT_TYPES.find((t) => t.value === a.type)?.label || a.type}
                    sx={{ height: 22, fontWeight: 700 }} />
                </Stack>

                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: 'var(--app-primary)',
                    mb: 0.25
                  }}>
                  {fmt(balanceOf(a))}
                </Typography>
                {a.currentBalance != null && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Opening {fmt(a.openingBalance || 0)}
                    {a.ledgerNet ? ` · ${a.ledgerNet >= 0 ? 'received' : 'paid'} ${fmt(Math.abs(a.ledgerNet))}` : ''}
                  </Typography>
                )}
                {Array.isArray(a.paymentMethods) && a.paymentMethods.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {a.paymentMethods.map((m) => (
                      <Chip key={m} size="small" label={m} sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: 'rgba(var(--app-primary-rgb),0.08)' }} />
                    ))}
                  </Stack>
                )}

                <Stack spacing={0.25} sx={{ mb: 1.5 }}>
                  {a.accountNumber && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>A/C: {a.accountNumber}</Typography>
                  )}
                  {a.ifsc && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>IFSC: {a.ifsc}{a.branch ? ` · ${a.branch}` : ''}</Typography>
                  )}
                  {a.upi && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>UPI: {a.upi}</Typography>
                  )}
                </Stack>

                <Stack direction="row" spacing={0.5} sx={{ mt: 'auto', justifyContent: 'flex-end' }}>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(a)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(a)} sx={{ color: '#ef4444' }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      {/* Add / Edit dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        onSubmit={handleSave}
        maxWidth="sm"
        icon={<AccountBalanceIcon />}
        eyebrow="Banking"
        title={editId ? 'Edit Account' : 'Add Account'}
        submitDisabled={saving}
        submitLabel={saving ? 'Saving…' : editId ? 'Save' : 'Add'}
      >
        <FormSection title="Account Details" icon={<AccountBalanceIcon fontSize="small" />} iconColor="#6366f1">
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid
              size={{
                xs: 12,
                sm: 8
              }}>
              <TextField fullWidth required label="Account Name" value={form.name} onChange={set('name')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 4
              }}>
              <TextField select fullWidth label="Type" value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, paymentMethods: defaultMethodsForType(e.target.value) }))}>
                {ACCOUNT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Bank Name" value={form.bankName} onChange={set('bankName')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Account Number" value={form.accountNumber} onChange={set('accountNumber')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="IFSC" value={form.ifsc} onChange={set('ifsc')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Branch" value={form.branch} onChange={set('branch')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="UPI ID" value={form.upi} onChange={set('upi')} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth type="number" label="Opening balance" value={form.balance} onChange={set('balance')}
                helperText="Starting balance before ledger tracking" />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                select fullWidth label="Receives payments"
                value={form.paymentMethods}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethods: e.target.value }))}
                helperText="Ledger money in these buckets updates this balance"
                slotProps={{
                  select: { multiple: true, renderValue: (sel) => (sel.length ? sel.join(', ') : 'None') }
                }}
              >
                {PAYMENT_BUCKETS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={set('notes')} />
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>
    </Box>
  );
};

export default BankAccountsTab;
