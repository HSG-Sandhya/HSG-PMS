import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, TextField, MenuItem, Grid, Stack, Chip, Alert, CircularProgress,
  IconButton, Tooltip, Button, Divider, InputAdornment,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PaymentsIcon from '@mui/icons-material/Payments';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HistoryIcon from '@mui/icons-material/History';
import InsightsIcon from '@mui/icons-material/Insights';
import FormDialog, { FormSection } from './FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const COMPANY_TYPES = ['Corporate', 'Travel Agent', 'Government', 'Local Business', 'Other'];

const emptyForm = () => ({
  name: '', companyType: '', gstNumber: '', pan: '', billingAddress: '',
  creditLimit: '', creditDays: 30,
  pcName: '', pcDesignation: '', pcPhone: '', pcEmail: '',
  altName: '', altPhone: '',
  contractRates: [],
});

const toForm = (c) => ({
  name: c.name || '', companyType: c.companyType || '', gstNumber: c.gstNumber || '',
  pan: c.pan || '', billingAddress: c.billingAddress || '',
  creditLimit: c.creditLimit ?? '', creditDays: c.creditDays ?? 30,
  pcName: c.primaryContact?.name || '', pcDesignation: c.primaryContact?.designation || '',
  pcPhone: c.primaryContact?.phone || '', pcEmail: c.primaryContact?.email || '',
  altName: c.alternateContact?.name || '', altPhone: c.alternateContact?.phone || '',
  contractRates: (c.contractRates || []).map((r) => ({ roomType: r.roomType, rate: r.rate })),
});

const CompaniesManager = ({ open, onClose, rooms = [], onChanged }) => {
  const [companies, setCompanies] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyName, setHistoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('list'); // 'list' | 'edit' | 'history'
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const roomTypes = useMemo(() => [...new Set((rooms || []).map((r) => r.type).filter(Boolean))], [rooms]);
  const sym = currencySym();
  const money = (n) => `${sym}${Number(n || 0).toLocaleString('en-IN')}`;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [list, an] = await Promise.all([
        api.companies.getAll(),
        api.companies.getAnalytics().catch(() => ({ data: { data: null } })),
      ]);
      setCompanies(list.data?.data || []);
      setAnalytics(an.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  const openHistory = async (c) => {
    setHistoryName(c.name); setHistory(null); setMode('history'); setError('');
    try {
      const res = await api.companies.getHistory(c.id || c._id);
      setHistory(res.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load history');
    }
  };

  useEffect(() => {
    if (open) { setMode('list'); setOkMsg(''); setError(''); load(); }
  }, [open, load]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const openNew = () => { setForm(emptyForm()); setEditId(''); setError(''); setMode('edit'); };
  const openEdit = (c) => { setForm(toForm(c)); setEditId(c.id || c._id); setError(''); setMode('edit'); };

  const setRate = (i, k, v) => setForm((p) => ({ ...p, contractRates: p.contractRates.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)) }));
  const addRate = () => setForm((p) => ({ ...p, contractRates: [...p.contractRates, { roomType: '', rate: '' }] }));
  const removeRate = (i) => setForm((p) => ({ ...p, contractRates: p.contractRates.filter((_, idx) => idx !== i) }));

  const save = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(), companyType: form.companyType,
      gstNumber: form.gstNumber.trim(), pan: form.pan.trim(), billingAddress: form.billingAddress.trim(),
      creditLimit: Number(form.creditLimit) || 0, creditDays: Number(form.creditDays) || 0,
      primaryContact: { name: form.pcName.trim(), designation: form.pcDesignation.trim(), phone: form.pcPhone.trim(), email: form.pcEmail.trim() },
      alternateContact: { name: form.altName.trim(), phone: form.altPhone.trim() },
      contractRates: form.contractRates.filter((r) => r.roomType).map((r) => ({ roomType: r.roomType, rate: Number(r.rate) || 0 })),
    };
    try {
      if (editId) await api.companies.update(editId, payload);
      else await api.companies.create(payload);
      setOkMsg(editId ? 'Company updated.' : 'Company created.');
      onChanged?.();
      setMode('list');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete company "${c.name}"? This does not delete its past bookings.`)) return;
    try { await api.companies.delete(c.id || c._id); onChanged?.(); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Failed to delete company'); }
  };

  const recordPayment = async (c) => {
    const raw = window.prompt(`Record a credit payment for "${c.name}" (outstanding ${sym}${(c.creditUsed || 0).toLocaleString('en-IN')}):`, '');
    const amount = Number(raw);
    if (!raw || !(amount > 0)) return;
    try { await api.companies.recordCreditPayment(c.id || c._id, amount); onChanged?.(); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Failed to record payment'); }
  };

  const isEdit = mode === 'edit';
  const isHistory = mode === 'history';

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={isEdit ? save : null}
      maxWidth="md"
      icon={<BusinessIcon />}
      eyebrow="Corporate accounts"
      title={isEdit ? (editId ? 'Edit company' : 'New company') : isHistory ? `History — ${historyName}` : 'Companies'}
      submitLabel={isEdit ? (saving ? 'Saving…' : 'Save company') : 'Done'}
      submitDisabled={saving}
      hideCancel={!isEdit}
      cancelLabel="Back"
      extraActions={isEdit
        ? <Button onClick={() => setMode('list')} startIcon={<ArrowBackIcon />} sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>Back</Button>
        : isHistory
          ? <Button onClick={() => setMode('list')} startIcon={<ArrowBackIcon />} sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>Back</Button>
          : <Button onClick={openNew} startIcon={<AddIcon />} variant="contained" sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>Add company</Button>}
    >
      {isHistory ? (
        <FormSection title="Booking history" icon={<HistoryIcon fontSize="small" />} iconColor="#6366f1">
          {!history ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{
                flexWrap: "wrap"
              }}>
                <Chip label={`${history.summary.clusters} booking(s)`} sx={{ fontWeight: 700 }} />
                <Chip color="primary" label={`Revenue ${money(history.summary.revenue)}`} sx={{ fontWeight: 700 }} />
                <Chip color="success" label={`Paid ${money(history.summary.paid)}`} sx={{ fontWeight: 700 }} />
                <Chip color="warning" label={`Outstanding ${money(history.summary.outstanding)}`} sx={{ fontWeight: 700 }} />
                <Chip label={`Credit used ${money(history.summary.creditUsed)}`} />
              </Stack>
              {history.clusters.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    py: 2,
                    textAlign: 'center'
                  }}>No bookings yet.</Typography>
              ) : history.clusters.map((c) => (
                <Grid
                  container
                  key={c.groupId}
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 5
                    }}>
                    <Typography sx={{
                      fontWeight: 700
                    }}>{c.name}</Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      {new Date(c.checkIn).toLocaleDateString('en-IN')} → {new Date(c.checkOut).toLocaleDateString('en-IN')} · {c.rooms} room(s)
                    </Typography>
                  </Grid>
                  <Grid
                    size={{
                      xs: 6,
                      sm: 4
                    }}>
                    <Chip size="small" label={c.status} color={c.status === 'Cancelled' ? 'error' : c.status === 'Completed' ? 'success' : 'info'} />
                  </Grid>
                  <Grid
                    sx={{ textAlign: 'right' }}
                    size={{
                      xs: 6,
                      sm: 3
                    }}>
                    <Typography sx={{
                      fontWeight: 800
                    }}>{money(c.revenue)}</Typography>
                  </Grid>
                </Grid>
              ))}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          )}
        </FormSection>
      ) : !isEdit ? (
        <FormSection title="Accounts & credit" icon={<BusinessIcon fontSize="small" />} iconColor="#6366f1">
          {loading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
          ) : (
            <Stack spacing={1}>
              {error && <Alert severity="error">{error}</Alert>}
              {okMsg && <Alert severity="success">{okMsg}</Alert>}

              {analytics && (
                <Box sx={{ p: 1.5, mb: 0.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(var(--app-primary-rgb),0.04)' }}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      alignItems: "center",
                      mb: 1
                    }}>
                    <InsightsIcon fontSize="small" sx={{ color: 'var(--app-primary)' }} />
                    <Typography variant="subtitle2" sx={{
                      fontWeight: 800
                    }}>Corporate revenue</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{
                    flexWrap: "wrap"
                  }}>
                    <Chip size="small" color="primary" label={`Revenue ${money(analytics.corporateRevenue)}`} sx={{ fontWeight: 700 }} />
                    <Chip size="small" label={`${analytics.corporateBookings} booking(s)`} />
                    <Chip size="small" label={`${analytics.totalCompanies} compan${analytics.totalCompanies === 1 ? 'y' : 'ies'}`} />
                    <Chip size="small" color="warning" label={`Outstanding credit ${money(analytics.totalCreditUsed)}`} />
                  </Stack>
                  {analytics.topCompanies?.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: 'block',
                        mt: 1
                      }}>
                      Top: {analytics.topCompanies.slice(0, 3).map((t) => `${t.name} (${money(t.revenue)})`).join(' · ')}
                    </Typography>
                  )}
                </Box>
              )}

              {companies.length === 0 && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    py: 3,
                    textAlign: 'center'
                  }}>
                  No companies yet. Use “Add company”.
                </Typography>
              )}
              {companies.map((c) => (
                <Grid
                  container
                  key={c.id || c._id}
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 4
                    }}>
                    <Typography sx={{
                      fontWeight: 800
                    }}>{c.name}</Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>{c.companyType || '—'} · {(c.contractRates || []).length} rate(s)</Typography>
                  </Grid>
                  <Grid
                    size={{
                      xs: 8,
                      sm: 5
                    }}>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{
                      flexWrap: "wrap"
                    }}>
                      <Chip size="small" label={`Limit ${sym}${(c.creditLimit || 0).toLocaleString('en-IN')}`} />
                      <Chip size="small" color={c.creditUsed > 0 ? 'warning' : 'default'} label={`Used ${sym}${(c.creditUsed || 0).toLocaleString('en-IN')}`} />
                      <Chip size="small" color="success" label={`Free ${sym}${(c.creditAvailable ?? Math.max(0, (c.creditLimit || 0) - (c.creditUsed || 0))).toLocaleString('en-IN')}`} />
                    </Stack>
                  </Grid>
                  <Grid
                    sx={{ textAlign: 'right' }}
                    size={{
                      xs: 4,
                      sm: 3
                    }}>
                    <Tooltip title="Booking history"><IconButton size="small" onClick={() => openHistory(c)} sx={{ color: '#6366f1' }}><HistoryIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Record credit payment"><span>
                      <IconButton size="small" onClick={() => recordPayment(c)} disabled={!(c.creditUsed > 0)} sx={{ color: '#10b981' }}><PaymentsIcon fontSize="small" /></IconButton>
                    </span></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => remove(c)} sx={{ color: '#ef4444' }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </Grid>
                </Grid>
              ))}
            </Stack>
          )}
        </FormSection>
      ) : (
        <>
          <FormSection title="Company" icon={<BusinessIcon fontSize="small" />} iconColor="#6366f1">
            <Grid container spacing={2}>
              <Grid
                size={{
                  xs: 12,
                  sm: 8
                }}><TextField fullWidth required label="Company name" value={form.name} onChange={(e) => set('name', e.target.value)} /></Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 4
                }}>
                <TextField select fullWidth label="Type" value={form.companyType} onChange={(e) => set('companyType', e.target.value)}>
                  {COMPANY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 4
                }}><TextField fullWidth label="GSTIN" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} /></Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 4
                }}><TextField fullWidth label="PAN" value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} /></Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 4
                }}><TextField fullWidth label="Billing address" value={form.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} /></Grid>
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}><TextField fullWidth label="Contact name" value={form.pcName} onChange={(e) => set('pcName', e.target.value)} /></Grid>
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}><TextField fullWidth label="Designation" value={form.pcDesignation} onChange={(e) => set('pcDesignation', e.target.value)} /></Grid>
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}><TextField fullWidth label="Contact phone" value={form.pcPhone} onChange={(e) => set('pcPhone', e.target.value)} /></Grid>
              <Grid
                size={{
                  xs: 6,
                  sm: 3
                }}><TextField fullWidth label="Contact email" value={form.pcEmail} onChange={(e) => set('pcEmail', e.target.value)} /></Grid>
            </Grid>
          </FormSection>

          <FormSection title="Credit account" icon={<PaymentsIcon fontSize="small" />} iconColor="#0ea5e9">
            <Grid container spacing={2}>
              <Grid
                size={{
                  xs: 6,
                  sm: 4
                }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Credit limit"
                  value={form.creditLimit}
                  onChange={(e) => set('creditLimit', e.target.value)}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">{sym}</InputAdornment> },
                    htmlInput: { min: 0 }
                  }} />
              </Grid>
              <Grid
                size={{
                  xs: 6,
                  sm: 4
                }}>
                <TextField select fullWidth label="Credit days" value={form.creditDays} onChange={(e) => set('creditDays', e.target.value)}>
                  {[0, 15, 30, 45, 60].map((d) => <MenuItem key={d} value={d}>{d === 0 ? 'None' : `${d} days`}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </FormSection>

          <FormSection title="Contract rate plan" icon={<BusinessIcon fontSize="small" />} iconColor="#a21caf">
            <Stack spacing={1}>
              {form.contractRates.map((r, i) => (
                <Grid container spacing={1} key={i} sx={{
                  alignItems: "center"
                }}>
                  <Grid size={6}>
                    <TextField select={roomTypes.length > 0} size="small" fullWidth label="Room type" value={r.roomType}
                      onChange={(e) => setRate(i, 'roomType', e.target.value)}>
                      {roomTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={5}>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      label="Rate / night"
                      value={r.rate}
                      onChange={(e) => setRate(i, 'rate', e.target.value)}
                      slotProps={{
                        input: { startAdornment: <InputAdornment position="start">{sym}</InputAdornment> },
                        htmlInput: { min: 0 }
                      }} />
                  </Grid>
                  <Grid sx={{ textAlign: 'right' }} size={1}>
                    <IconButton size="small" onClick={() => removeRate(i)} sx={{ color: '#ef4444' }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Grid>
                </Grid>
              ))}
              <Box><Button size="small" startIcon={<AddIcon />} onClick={addRate} sx={{ textTransform: 'none', fontWeight: 700 }}>Add rate</Button></Box>
              <Divider />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </FormSection>
        </>
      )}
    </FormDialog>
  );
};

export default CompaniesManager;
