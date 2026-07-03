import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, TextField, MenuItem, Grid, Stack, Divider, IconButton, Chip,
  RadioGroup, FormControlLabel, Radio, FormLabel, Switch, Button, InputAdornment, Autocomplete,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import BadgeIcon from '@mui/icons-material/Badge';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentsIcon from '@mui/icons-material/Payments';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FormDialog, { FormSection } from './FormDialog';
import AppDatePicker from './AppDatePicker';
import api from '../../api';
import { freeRooms, nightsBetween } from '../../utils/roomAvailability';
import { useBilling } from '../../hooks/useBilling';
import { useBanquetBlocked } from '../../hooks/useBanquetBlocked';
import { calcGst, currencySym } from '../../utils/billing';

const todayStr = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };

const COMPANY_TYPES = ['Corporate', 'Travel Agent', 'Government', 'Local Business', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const CREDIT_DAYS = [15, 30, 45, 60];
const CREATE_STATUSES = ['Draft', 'Tentative', 'Confirmed'];

const emptyState = () => ({
  companyType: '', companyName: '', gstNumber: '', pan: '', billingAddress: '', creditLimit: '',
  pcName: '', pcDesignation: '', pcPhone: '', pcEmail: '',
  altName: '', altPhone: '',
  payBy: 'company', creditType: 'advance', creditDays: 30, poNumber: '', referenceNumber: '',
  gstInvoice: true,
  advanceAmount: '', advancePaymentMode: '', advanceTransactionId: '',
  specialRequests: '', status: 'Confirmed',
});
const emptyEmployee = () => ({ name: '', mobile: '', email: '', employeeId: '', department: '', designation: '' });

const CompanyBookingDialog = ({ open, onClose, rooms = [], onCreated, typeSelector = null, onManageCompanies }) => {
  const billing = useBilling();
  const [form, setForm] = useState(emptyState());
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(tomorrowStr());
  const [employees, setEmployees] = useState([emptyEmployee()]);
  const [requirement, setRequirement] = useState([]); // [{ roomType, qty, rate }]
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [companyRates, setCompanyRates] = useState({}); // roomType -> contract rate
  const [saveCompany, setSaveCompany] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyState());
      setCheckIn(todayStr()); setCheckOut(tomorrowStr());
      setEmployees([emptyEmployee()]); setRequirement([]); setError('');
      setCompanyId(''); setCompanyRates({}); setSaveCompany(true);
      api.companies.getAll({ active: true })
        .then((res) => setCompanies(res.data?.data || []))
        .catch(() => setCompanies([]));
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Pull an existing company's profile, contacts, credit terms + contract rates.
  const applyCompany = (c) => {
    if (!c) return;
    setCompanyId(c.id || c._id || '');
    const rates = {};
    (c.contractRates || []).forEach((r) => { if (r.roomType) rates[r.roomType] = Number(r.rate) || 0; });
    setCompanyRates(rates);
    setForm((p) => ({
      ...p,
      companyName: c.name || '',
      companyType: c.companyType || '',
      gstNumber: c.gstNumber || '',
      pan: c.pan || '',
      billingAddress: c.billingAddress || '',
      creditLimit: c.creditLimit || '',
      creditDays: c.creditDays || p.creditDays,
      pcName: c.primaryContact?.name || '',
      pcDesignation: c.primaryContact?.designation || '',
      pcPhone: c.primaryContact?.phone || '',
      pcEmail: c.primaryContact?.email || '',
      altName: c.alternateContact?.name || '',
      altPhone: c.alternateContact?.phone || '',
    }));
    // Re-rate any rooms already added using the contract rate where defined.
    setRequirement((prev) => prev.map((b) => (rates[b.roomType] != null ? { ...b, rate: rates[b.roomType] } : b)));
  };
  const nights = nightsBetween(checkIn, checkOut);
  // Exclude rooms held by a banquet/marriage event over the stay window.
  const blockedIds = useBanquetBlocked(checkIn, checkOut);

  const typeStats = useMemo(() => {
    const free = freeRooms(rooms, checkIn, checkOut).filter((r) => !blockedIds.has(String(r._id)));
    const map = {};
    for (const r of free) {
      if (!map[r.type]) map[r.type] = { type: r.type, freeCount: 0, rateSum: 0 };
      map[r.type].freeCount += 1;
      map[r.type].rateSum += (r.pricePerNight || 0);
    }
    return Object.values(map).map((t) => ({
      type: t.type, freeCount: t.freeCount, avgRate: Math.round(t.rateSum / t.freeCount),
    }));
  }, [rooms, checkIn, checkOut, blockedIds]);

  const freeForType = (type) => typeStats.find((t) => t.type === type)?.freeCount || 0;
  const rackForType = (type) => typeStats.find((t) => t.type === type)?.avgRate || 0;
  const addableTypes = typeStats.filter((t) => !requirement.some((b) => b.roomType === t.type));

  const addType = (type) => {
    const stat = typeStats.find((t) => t.type === type);
    if (!stat) return;
    // Use the company's contract rate for this type when available, else rack.
    const rate = companyRates[type] != null ? companyRates[type] : stat.avgRate;
    setRequirement((prev) => [...prev, { roomType: type, qty: 1, rate }]);
  };
  const updateReq = (i, k, v) => setRequirement((prev) => prev.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  const removeReq = (i) => setRequirement((prev) => prev.filter((_, idx) => idx !== i));

  const setEmp = (i, k, v) => setEmployees((prev) => prev.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)));
  const addEmp = () => setEmployees((prev) => [...prev, emptyEmployee()]);
  const removeEmp = (i) => setEmployees((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const rowMoney = (b) => {
    const base = (Number(b.rate) || 0) * nights;
    const gst = calcGst(base, billing);
    const total = base + gst;
    return { base, gst, total, lineTotal: total * (Number(b.qty) || 0) };
  };

  const totals = useMemo(() => requirement.reduce((acc, b) => {
    acc.rooms += Number(b.qty) || 0;
    acc.amount += rowMoney(b).lineTotal;
    return acc;
  }, { rooms: 0, amount: 0 }), [requirement, nights, billing]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCredit = form.creditType === 'credit';

  const submit = async (statusOverride) => {
    setError('');
    if (!form.companyName.trim()) return setError('Company name is required.');
    if (!form.pcName.trim() || !form.pcPhone.trim()) return setError('Primary contact name and phone are required.');
    if (requirement.length === 0 || totals.rooms === 0) return setError('Add at least one room requirement.');
    for (const b of requirement) {
      const free = freeForType(b.roomType);
      if ((Number(b.qty) || 0) > free) return setError(`Only ${free} "${b.roomType}" room(s) free — reduce the quantity.`);
    }

    setSaving(true);
    try {
      const payload = {
        companyId: companyId || undefined,
        saveCompany,
        company: {
          name: form.companyName.trim(),
          companyType: form.companyType,
          gstNumber: form.gstNumber.trim(),
          pan: form.pan.trim(),
          billingAddress: form.billingAddress.trim(),
          creditLimit: Number(form.creditLimit) || 0,
        },
        primaryContact: {
          name: form.pcName.trim(), designation: form.pcDesignation.trim(),
          phone: form.pcPhone.trim(), email: form.pcEmail.trim(),
        },
        alternateContact: { name: form.altName.trim(), phone: form.altPhone.trim() },
        employees: employees.filter((e) => e.name.trim()),
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        payBy: form.payBy,
        creditType: form.creditType,
        creditDays: isCredit ? Number(form.creditDays) || 0 : 0,
        poNumber: form.poNumber.trim(),
        referenceNumber: form.referenceNumber.trim(),
        gstInvoice: form.gstInvoice,
        advanceAmount: Number(form.advanceAmount) || 0,
        advancePaymentMode: form.advancePaymentMode || '',
        advanceTransactionId: form.advanceTransactionId.trim(),
        bookingStatus: statusOverride || form.status,
        specialRequests: form.specialRequests.trim(),
        roomRequirement: requirement.map((b) => {
          const { base, gst, total } = rowMoney(b);
          return {
            roomType: b.roomType, qty: Number(b.qty) || 0, rate: Number(b.rate) || 0,
            baseAmount: base, gstAmount: gst, totalAmount: total,
          };
        }),
      };
      const { data } = await api.bookings.createCompany(payload);
      onCreated?.(data?.message || 'Company booking created');
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create company booking');
    } finally {
      setSaving(false);
    }
  };

  const sym = currencySym();

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={(e) => { e?.preventDefault?.(); submit(); }}
      maxWidth="md"
      icon={<BusinessIcon />}
      eyebrow="Front Desk · New booking"
      title="Company booking"
      submitDisabled={saving || totals.rooms === 0}
      submitLabel={saving ? 'Saving…' : `Create (${totals.rooms} room${totals.rooms === 1 ? '' : 's'})`}
      extraActions={(
        <Button onClick={() => submit('Draft')} disabled={saving} sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>
          Save draft
        </Button>
      )}
    >
      {typeSelector}
      {/* ── Section 1: Company Details ───────────────────────────────────── */}
      <FormSection title="Company Details" icon={<BusinessIcon fontSize="small" />} iconColor="#6366f1">
        {onManageCompanies && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button size="small" startIcon={<AccountBalanceIcon fontSize="small" />}
              onClick={onManageCompanies} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Manage companies
            </Button>
          </Box>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <Autocomplete
              freeSolo
              options={companies}
              value={form.companyName}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.name || '')}
              onChange={(e, val) => { if (val && typeof val === 'object') applyCompany(val); }}
              onInputChange={(e, val, reason) => {
                if (reason === 'input') { set('companyName', val); setCompanyId(''); setCompanyRates({}); }
              }}
              renderInput={(params) => (
                <TextField {...params} required label="Company name"
                  helperText={companyId ? 'Existing company — contract rates & credit applied' : 'Search existing or type a new company'} />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="Company type" value={form.companyType}
              onChange={(e) => set('companyType', e.target.value)}>
              {COMPANY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="GSTIN" value={form.gstNumber}
              onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="PAN" value={form.pan}
              onChange={(e) => set('pan', e.target.value.toUpperCase())} placeholder="AAAAA0000A" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth type="number" label="Credit limit" value={form.creditLimit}
              onChange={(e) => set('creditLimit', e.target.value)} inputProps={{ min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Billing address" value={form.billingAddress}
              onChange={(e) => set('billingAddress', e.target.value)} multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={saveCompany} onChange={(e) => setSaveCompany(e.target.checked)} />}
              label={companyId ? 'Update this company profile (rates & credit terms)' : 'Save as a company profile (reuse rates & credit later)'}
            />
          </Grid>
        </Grid>
      </FormSection>

      {/* ── Section 2: Corporate Contact ─────────────────────────────────── */}
      <FormSection title="Corporate Contact" icon={<ContactPhoneIcon fontSize="small" />} iconColor="#06b6d4">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth required label="Contact name" value={form.pcName} onChange={(e) => set('pcName', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="Designation" value={form.pcDesignation} onChange={(e) => set('pcDesignation', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth required label="Phone" value={form.pcPhone} onChange={(e) => set('pcPhone', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="Email" value={form.pcEmail} onChange={(e) => set('pcEmail', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Alternate contact name" value={form.altName} onChange={(e) => set('altName', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Alternate contact phone" value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
          </Grid>
        </Grid>
      </FormSection>

      {/* ── Section 3: Employee / Guest List ─────────────────────────────── */}
      <FormSection title={`Employee Guests (${employees.filter((e) => e.name.trim()).length})`} icon={<BadgeIcon fontSize="small" />} iconColor="#a21caf">
        <Stack spacing={1}>
          {employees.map((e, i) => (
            <Grid container spacing={1} key={i} alignItems="center"
              sx={{ p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Grid item xs={12} sm={3}>
                <TextField size="small" fullWidth label="Name" value={e.name} onChange={(ev) => setEmp(i, 'name', ev.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField size="small" fullWidth label="Mobile" value={e.mobile} onChange={(ev) => setEmp(i, 'mobile', ev.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField size="small" fullWidth label="Emp ID" value={e.employeeId} onChange={(ev) => setEmp(i, 'employeeId', ev.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField size="small" fullWidth label="Department" value={e.department} onChange={(ev) => setEmp(i, 'department', ev.target.value)} />
              </Grid>
              <Grid item xs={5} sm={2}>
                <TextField size="small" fullWidth label="Designation" value={e.designation} onChange={(ev) => setEmp(i, 'designation', ev.target.value)} />
              </Grid>
              <Grid item xs={1} sx={{ textAlign: 'right' }}>
                <IconButton size="small" onClick={() => removeEmp(i)} disabled={employees.length === 1} sx={{ color: 'error.main' }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Box>
            <Button size="small" startIcon={<AddIcon />} onClick={addEmp} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Add guest
            </Button>
          </Box>
        </Stack>
      </FormSection>

      {/* ── Section 4: Stay & Room Requirement ───────────────────────────── */}
      <FormSection title="Stay & Room Requirement" icon={<MeetingRoomIcon fontSize="small" />} iconColor="#6366f1">
        <Grid container spacing={2} sx={{ mb: 1.5 }}>
          <Grid item xs={6} sm={3}>
            <AppDatePicker label="Check-in" value={checkIn} onChange={setCheckIn} min={todayStr()} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <AppDatePicker label="Check-out" value={checkOut} onChange={setCheckOut} min={checkIn} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Nights" value={nights} InputProps={{ readOnly: true }} />
          </Grid>
          <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: { sm: 'flex-end' }, alignItems: 'center' }}>
            <TextField select size="small" value="" onChange={(ev) => addType(ev.target.value)}
              disabled={addableTypes.length === 0} sx={{ minWidth: 200 }}
              SelectProps={{ displayEmpty: true, renderValue: () => (
                <Stack direction="row" spacing={0.5} alignItems="center"><AddIcon fontSize="small" /> Add room type</Stack>
              ) }}>
              {addableTypes.map((t) => (
                <MenuItem key={t.type} value={t.type}>{t.type} · {t.freeCount} free · rack {sym}{t.avgRate.toLocaleString('en-IN')}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        {requirement.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No rooms required yet. Use “Add room type”.
              {typeStats.length === 0 && ' (No rooms free for these dates.)'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            <Grid container spacing={1} sx={{ px: 1, color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>
              <Grid item xs={3}>Room Type</Grid>
              <Grid item xs={2}>Qty</Grid>
              <Grid item xs={2}>Rack</Grid>
              <Grid item xs={3}>Corporate Rate /n</Grid>
              <Grid item xs={2} sx={{ textAlign: 'right' }}>Amount</Grid>
            </Grid>
            {requirement.map((b, i) => {
              const free = freeForType(b.roomType);
              const over = (Number(b.qty) || 0) > free;
              const { lineTotal } = rowMoney(b);
              return (
                <Grid container spacing={1} key={i} alignItems="center"
                  sx={{ p: 1, borderRadius: 2, border: '1px solid', borderColor: over ? 'error.main' : 'divider' }}>
                  <Grid item xs={3}>
                    <Typography fontWeight={800} sx={{ color: 'var(--app-primary)' }}>{b.roomType}</Typography>
                    <Typography variant="caption" color={over ? 'error' : 'text.secondary'}>{free} free</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <TextField size="small" type="number" value={b.qty} error={over}
                      onChange={(e) => updateReq(i, 'qty', e.target.value)} inputProps={{ min: 1, max: free }} fullWidth />
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" color="text.secondary">{sym}{rackForType(b.roomType).toLocaleString('en-IN')}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <TextField size="small" type="number" value={b.rate}
                      onChange={(e) => updateReq(i, 'rate', e.target.value)} inputProps={{ min: 0 }} fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }} />
                  </Grid>
                  <Grid item xs={1} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={700}>{sym}{lineTotal.toLocaleString('en-IN')}</Typography>
                  </Grid>
                  <Grid item xs={1} sx={{ textAlign: 'right' }}>
                    <IconButton size="small" onClick={() => removeReq(i)} sx={{ color: 'error.main' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              );
            })}
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
              <Chip label={`Total rooms: ${totals.rooms}`} sx={{ fontWeight: 700 }} />
              <Chip color="primary" label={`Total: ${sym}${totals.amount.toLocaleString('en-IN')}`} sx={{ fontWeight: 800 }} />
            </Stack>
          </Stack>
        )}
      </FormSection>

      {/* ── Section 5: Billing & Credit ──────────────────────────────────── */}
      <FormSection title="Billing & Credit" icon={<AccountBalanceIcon fontSize="small" />} iconColor="#0ea5e9">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormLabel sx={{ fontSize: 13, fontWeight: 700 }}>Payment by</FormLabel>
            <RadioGroup row value={form.payBy} onChange={(e) => set('payBy', e.target.value)}>
              <FormControlLabel value="guest" control={<Radio />} label="Guest Pay" />
              <FormControlLabel value="company" control={<Radio />} label="Company Pay" />
              <FormControlLabel value="split" control={<Radio />} label="Split" />
            </RadioGroup>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormLabel sx={{ fontSize: 13, fontWeight: 700 }}>Credit type</FormLabel>
            <RadioGroup row value={form.creditType} onChange={(e) => set('creditType', e.target.value)}>
              <FormControlLabel value="advance" control={<Radio />} label="Advance" />
              <FormControlLabel value="credit" control={<Radio />} label="Credit Account" />
            </RadioGroup>
          </Grid>
          {isCredit && (
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Credit days" value={form.creditDays}
                onChange={(e) => set('creditDays', e.target.value)}>
                {CREDIT_DAYS.map((d) => <MenuItem key={d} value={d}>{d} days</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid item xs={12} sm={isCredit ? 4 : 6}>
            <TextField fullWidth label="PO number" value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={isCredit ? 4 : 6}>
            <TextField fullWidth label="Reference number" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
          </Grid>
        </Grid>
      </FormSection>

      {/* ── Section 6: Advance & Invoice ─────────────────────────────────── */}
      <FormSection title="Advance & Invoice" icon={<PaymentsIcon fontSize="small" />} iconColor="#10b981">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField fullWidth type="number" label="Advance amount" value={form.advanceAmount}
              onChange={(e) => set('advanceAmount', e.target.value)} inputProps={{ min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="Payment mode" value={form.advancePaymentMode}
              onChange={(e) => set('advancePaymentMode', e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {PAYMENT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Transaction ID" value={form.advanceTransactionId}
              onChange={(e) => set('advanceTransactionId', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={<Switch checked={form.gstInvoice} onChange={(e) => set('gstInvoice', e.target.checked)} />}
              label="GST invoice required"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {CREATE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Special instructions" value={form.specialRequests}
              onChange={(e) => set('specialRequests', e.target.value)} multiline rows={2}
              placeholder="Airport pickup · early check-in · GST invoice · floor preference…" />
          </Grid>
        </Grid>
        {error && <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{error}</Typography>}
      </FormSection>
    </FormDialog>
  );
};

export default CompanyBookingDialog;
