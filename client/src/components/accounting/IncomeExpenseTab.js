import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, IconButton, Stack, Typography, CircularProgress, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TextField, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import api from '../../api';
import AccountingEntryDialog from './AccountingEntryDialog';
import {
  fmt, fmtDate, cardSx, INCOME_COLOR, EXPENSE_COLOR, ACCOUNTS,
} from './accountingShared';

const IncomeExpenseTab = ({ range, onChanged, onNotify }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: range.from, to: range.to };
      if (typeFilter !== 'all') params.entryType = typeFilter;
      if (accountFilter !== 'all') params.account = accountFilter;
      const { data } = await api.accounting.getEntries(params);
      setEntries(data?.data || []);
    } catch (e) {
      onNotify?.('Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, typeFilter, accountFilter, onNotify]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const refresh = () => { fetchEntries(); onChanged?.(); };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.accounting.deleteEntry(entry._id);
      onNotify?.('Entry deleted', 'info');
      refresh();
    } catch (e) {
      onNotify?.('Delete failed', 'error');
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e) => { setEditing(e); setDialogOpen(true); };

  return (
    <Box sx={cardSx}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={800}>Income &amp; Expense</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </TextField>
          <TextField select size="small" label="Account" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All accounts</MenuItem>
            {ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
            sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none',
              background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
            New entry
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : entries.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          No entries in this period. Click “New entry” to record income or an expense.
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Party</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">GST</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e._id} hover>
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={e.entryType === 'income' ? 'Income' : 'Expense'}
                      sx={{ height: 22, fontWeight: 700, color: '#fff', bgcolor: e.entryType === 'income' ? INCOME_COLOR : EXPENSE_COLOR }} />
                  </TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.party || '—'}</TableCell>
                  <TableCell>{e.account}</TableCell>
                  <TableCell align="right">{fmt(e.amount)}</TableCell>
                  <TableCell align="right">{e.gstRate ? `${e.gstRate}% · ${fmt(e.gstAmount)}` : '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: e.entryType === 'income' ? INCOME_COLOR : EXPENSE_COLOR }}>
                    {fmt(e.total)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(e)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(e)} sx={{ color: '#ef4444' }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <AccountingEntryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        entry={editing}
        onSaved={refresh}
        onNotify={onNotify}
      />
    </Box>
  );
};

export default IncomeExpenseTab;
