import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Grid, Typography, Tabs, Tab, TextField, MenuItem, Stack,
  Snackbar, Alert, CircularProgress, InputAdornment, Tooltip, IconButton,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import PageLayout from '../../components/layout/PageLayout';
import AppDatePicker from '../../components/forms/AppDatePicker';
import { currencySym } from '../../utils/billing';
import api from '../../api';
import { fmt, toInputDate, cardSx, INCOME_COLOR, EXPENSE_COLOR } from '../../components/accounting/accountingShared';
import IncomeExpenseTab from '../../components/accounting/IncomeExpenseTab';
import CashBookTab from '../../components/accounting/CashBookTab';
import LedgerTab from '../../components/accounting/LedgerTab';
import GstReportTab from '../../components/accounting/GstReportTab';
import ProfitLossTab from '../../components/accounting/ProfitLossTab';
import BalanceSheetTab from '../../components/accounting/BalanceSheetTab';
import BankAccountsTab from '../../components/accounting/BankAccountsTab';

// Date-range presets ---------------------------------------------------------
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const financialYear = (d) => {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // FY starts April
  return { from: new Date(y, 3, 1), to: new Date(y + 1, 2, 31) };
};

const PRESETS = {
  thisMonth: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  lastMonth: () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return { from: startOfMonth(d), to: endOfMonth(d) };
  },
  thisFY: () => financialYear(new Date()),
};

const TAB_LABELS = ['Income & Expense', 'Cash Book', 'Ledger', 'GST Reports', 'Profit & Loss', 'Balance Sheet', 'Bank Accounts'];

const StatCard = ({ label, value, color }) => (
  <Grid
    size={{
      xs: 12,
      sm: 4
    }}>
    <Box sx={{ ...cardSx, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>{label}</Typography>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          color: color || 'text.primary',
          mt: 0.5
        }}>{value}</Typography>
    </Box>
  </Grid>
);

const Accounting = () => {
  const init = PRESETS.thisMonth();
  const [from, setFrom] = useState(toInputDate(init.from));
  const [to, setTo] = useState(toInputDate(init.to));
  const [preset, setPreset] = useState('thisMonth');

  const [openingCash, setOpeningCash] = useState(() => Number(localStorage.getItem('acct_openingCash')) || 0);
  const [openingBank, setOpeningBank] = useState(() => Number(localStorage.getItem('acct_openingBank')) || 0);

  const [tab, setTab] = useState(0);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const notify = useCallback((message, severity = 'info') => setSnackbar({ open: true, message, severity }), []);

  const range = useMemo(() => ({ from, to }), [from, to]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.accounting.getReports({ from, to, openingCash, openingBank });
      setReports(data?.data || null);
    } catch (e) {
      notify('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, openingCash, openingBank, notify]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const applyPreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const { from: f, to: t } = PRESETS[key]();
    setFrom(toInputDate(f));
    setTo(toInputDate(t));
  };

  const onOpeningChange = (setter, storageKey) => (e) => {
    const v = Number(e.target.value) || 0;
    setter(v);
    localStorage.setItem(storageKey, String(v));
  };

  const summary = reports?.summary || { totalIncome: 0, totalExpense: 0, net: 0 };

  return (
    <PageLayout>
      {/* Header */}
      <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 42, color: 'var(--app-primary)' }} />
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: 'var(--app-primary)',
                letterSpacing: '-0.02em'
              }}>
              Accounting
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Income &amp; expenses, cash book, ledgers, GST, P&amp;L and balance sheet.
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchReports} sx={{ color: 'var(--app-primary)' }}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>
      {/* Period controls */}
      <Box sx={{ ...cardSx, mb: 3 }}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{
            alignItems: "center",
            flexWrap: "wrap"
          }}>
          <TextField select size="small" label="Period" value={preset} onChange={(e) => applyPreset(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="thisMonth">This month</MenuItem>
            <MenuItem value="lastMonth">Last month</MenuItem>
            <MenuItem value="thisFY">This financial year</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          <AppDatePicker size="small" fullWidth={false} sx={{ width: 160 }} label="From"
            value={from} onChange={(v) => { setFrom(v); setPreset('custom'); }} />
          <AppDatePicker size="small" fullWidth={false} sx={{ width: 160 }} label="To"
            value={to} onChange={(v) => { setTo(v); setPreset('custom'); }} />
          <Box sx={{ flexGrow: 1 }} />
          <TextField size="small" type="number" label="Opening cash" value={openingCash}
            onChange={onOpeningChange(setOpeningCash, 'acct_openingCash')} sx={{ width: 150 }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
            }} />
          <TextField size="small" type="number" label="Opening bank" value={openingBank}
            onChange={onOpeningChange(setOpeningBank, 'acct_openingBank')} sx={{ width: 150 }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
            }} />
        </Stack>
      </Box>
      {/* Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatCard label="Total income" value={fmt(summary.totalIncome)} color={INCOME_COLOR} />
        <StatCard label="Total expense" value={fmt(summary.totalExpense)} color={EXPENSE_COLOR} />
        <StatCard label="Net" value={fmt(summary.net)} color={summary.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR} />
      </Grid>
      {/* Tabs */}
      <Box sx={{ ...cardSx, p: 1, mb: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}>
          {TAB_LABELS.map((l) => <Tab key={l} label={l} />)}
        </Tabs>
      </Box>
      {/* Tab content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === 0 ? (
          <IncomeExpenseTab range={range} onChanged={fetchReports} onNotify={notify} />
        ) : tab === 6 ? (
          <BankAccountsTab onNotify={notify} />
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : tab === 1 ? (
          <CashBookTab reports={reports} />
        ) : tab === 2 ? (
          <LedgerTab reports={reports} />
        ) : tab === 3 ? (
          <GstReportTab reports={reports} />
        ) : tab === 4 ? (
          <ProfitLossTab reports={reports} />
        ) : (
          <BalanceSheetTab reports={reports} />
        )}
      </motion.div>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default Accounting;
