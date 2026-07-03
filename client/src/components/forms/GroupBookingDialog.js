import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, TextField, MenuItem, Grid, Stack, Divider, IconButton, Chip,
  RadioGroup, FormControlLabel, Radio, FormLabel, Button, InputAdornment,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import FlagIcon from '@mui/icons-material/Flag';
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

// Group type values mirror the Booking.groupDetails.groupType enum.
const GROUP_TYPES = [
  { value: 'Corporate', label: 'Corporate Group' },
  { value: 'Tour', label: 'Tour Group' },
  { value: 'Religious', label: 'Religious Group' },
  { value: 'Government', label: 'Government' },
  { value: 'School/College', label: 'School / College' },
  { value: 'Sports Team', label: 'Sports Team' },
  { value: 'Family', label: 'Family Group' },
  { value: 'Other', label: 'Other' },
];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];
const CREATE_STATUSES = ['Draft', 'Tentative', 'Confirmed'];

const emptyState = () => ({
  groupType: '', groupName: '',
  coordinatorName: '', mobile: '', email: '', address: '', notes: '',
  arrivalTime: '', departureTime: '',
  adults: 0, children: 0, male: 0, female: 0,
  billingType: 'master',
  advanceAmount: '', advancePaymentMode: '', advanceTransactionId: '',
  status: 'Tentative',
});

const GroupBookingDialog = ({ open, onClose, rooms = [], onCreated, typeSelector = null }) => {
  const billing = useBilling();
  const [form, setForm] = useState(emptyState());
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(tomorrowStr());
  const [block, setBlock] = useState([]); // [{ roomType, qty, rate, pax }]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyState());
      setCheckIn(todayStr()); setCheckOut(tomorrowStr());
      setBlock([]); setError('');
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const nights = nightsBetween(checkIn, checkOut);
  // Rooms held by a banquet/marriage event over the stay are excluded from the
  // block so the room-block quantities can't exceed what the server will accept.
  const blockedIds = useBanquetBlocked(checkIn, checkOut);

  // Free rooms grouped by type → available count + a default (avg) rate.
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
  const addableTypes = typeStats.filter((t) => !block.some((b) => b.roomType === t.type));

  const addType = (type) => {
    const stat = typeStats.find((t) => t.type === type);
    if (!stat) return;
    setBlock((prev) => [...prev, { roomType: type, qty: 1, rate: stat.avgRate, pax: 2 }]);
  };
  const updateRow = (i, k, v) => setBlock((prev) => prev.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  const removeRow = (i) => setBlock((prev) => prev.filter((_, idx) => idx !== i));

  // Per-row money: base = rate × nights, + GST.
  const rowMoney = (b) => {
    const base = (Number(b.rate) || 0) * nights;
    const gst = calcGst(base, billing);
    const total = base + gst;
    return { base, gst, total, lineTotal: total * (Number(b.qty) || 0) };
  };

  const totals = useMemo(() => block.reduce((acc, b) => {
    const { lineTotal } = rowMoney(b);
    acc.rooms += Number(b.qty) || 0;
    acc.guests += Number(b.pax) || 0;
    acc.amount += lineTotal;
    return acc;
  }, { rooms: 0, guests: 0, amount: 0 }), [block, nights, billing]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPax = (Number(form.adults) || 0) + (Number(form.children) || 0);

  const submit = async (statusOverride) => {
    setError('');
    if (!form.groupType) return setError('Select a group type.');
    if (!form.coordinatorName.trim() || !form.mobile.trim()) return setError('Coordinator name and mobile are required.');
    if (block.length === 0 || totals.rooms === 0) return setError('Add at least one room type to the block.');
    for (const b of block) {
      const free = freeForType(b.roomType);
      if ((Number(b.qty) || 0) > free) return setError(`Only ${free} "${b.roomType}" room(s) free — reduce the quantity.`);
    }

    setSaving(true);
    try {
      const payload = {
        coordinator: {
          guestName: form.coordinatorName.trim(),
          phone: form.mobile.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
        },
        groupName: form.groupName.trim() || `${form.coordinatorName.trim()}'s group`,
        groupType: form.groupType,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        arrivalTime: form.arrivalTime || undefined,
        departureTime: form.departureTime || undefined,
        adults: Number(form.adults) || 0,
        children: Number(form.children) || 0,
        male: Number(form.male) || 0,
        female: Number(form.female) || 0,
        address: form.address.trim(),
        notes: form.notes.trim(),
        billingType: form.billingType,
        advanceAmount: Number(form.advanceAmount) || 0,
        advancePaymentMode: form.advancePaymentMode || '',
        advanceTransactionId: form.advanceTransactionId.trim(),
        bookingStatus: statusOverride || form.status,
        roomBlock: block.map((b) => {
          const { base, gst, total } = rowMoney(b);
          return {
            roomType: b.roomType,
            qty: Number(b.qty) || 0,
            rate: Number(b.rate) || 0,
            pax: Number(b.pax) || 0,
            baseAmount: base,
            gstAmount: gst,
            totalAmount: total,
          };
        }),
      };
      const { data } = await api.bookings.createGroup(payload);
      onCreated?.(data?.message || 'Group booking created');
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create group booking');
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
      icon={<GroupsIcon />}
      eyebrow="Front Desk · New booking"
      title="Group booking"
      submitDisabled={saving || totals.rooms === 0}
      submitLabel={saving ? 'Saving…' : `Create group (${totals.rooms} room${totals.rooms === 1 ? '' : 's'})`}
      extraActions={(
        <Button
          onClick={() => submit('Draft')}
          disabled={saving}
          sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}
        >
          Save draft
        </Button>
      )}
    >
      {typeSelector}
      {/* ── Section 1: Group Information ─────────────────────────────────── */}
      <FormSection title="Group Information" icon={<GroupsIcon fontSize="small" />} iconColor="#a21caf">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth required label="Group type" value={form.groupType}
              onChange={(e) => set('groupType', e.target.value)}>
              {GROUP_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField fullWidth label="Group name" value={form.groupName}
              onChange={(e) => set('groupName', e.target.value)} placeholder="Sharma Wedding Party" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth required label="Coordinator name" value={form.coordinatorName}
              onChange={(e) => set('coordinatorName', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth required label="Mobile number" value={form.mobile}
              onChange={(e) => set('mobile', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Email address" value={form.email}
              onChange={(e) => set('email', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Address" value={form.address}
              onChange={(e) => set('address', e.target.value)} multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Special notes" value={form.notes}
              onChange={(e) => set('notes', e.target.value)} multiline rows={2} />
          </Grid>
        </Grid>
      </FormSection>

      {/* ── Section 2: Stay Information ──────────────────────────────────── */}
      <FormSection title="Stay Information" icon={<EventIcon fontSize="small" />} iconColor="#06b6d4">
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <AppDatePicker label="Arrival date" value={checkIn} onChange={setCheckIn} min={todayStr()} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <AppDatePicker label="Departure date" value={checkOut} onChange={setCheckOut} min={checkIn} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Nights" value={nights} InputProps={{ readOnly: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth type="time" label="Arrival time" value={form.arrivalTime}
              onChange={(e) => set('arrivalTime', e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth type="time" label="Departure time" value={form.departureTime}
              onChange={(e) => set('departureTime', e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField fullWidth type="number" label="Adults" value={form.adults}
              onChange={(e) => set('adults', e.target.value)} inputProps={{ min: 0 }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth type="number" label="Children" value={form.children}
              onChange={(e) => set('children', e.target.value)} inputProps={{ min: 0 }} />
          </Grid>
          <Grid item xs={4} sm={2}>
            <TextField fullWidth type="number" label="Male" value={form.male}
              onChange={(e) => set('male', e.target.value)} inputProps={{ min: 0 }} />
          </Grid>
          <Grid item xs={4} sm={2}>
            <TextField fullWidth type="number" label="Female" value={form.female}
              onChange={(e) => set('female', e.target.value)} inputProps={{ min: 0 }} />
          </Grid>
          <Grid item xs={4} sm={2}>
            <TextField fullWidth label="Total pax" value={totalPax} InputProps={{ readOnly: true }} />
          </Grid>
        </Grid>
      </FormSection>

      {/* ── Section 3: Room Block ────────────────────────────────────────── */}
      <FormSection title="Room Block" icon={<MeetingRoomIcon fontSize="small" />} iconColor="#6366f1">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <TextField select size="small" value="" onChange={(e) => addType(e.target.value)}
            disabled={addableTypes.length === 0} sx={{ minWidth: 220 }}
            SelectProps={{ displayEmpty: true, renderValue: () => (
              <Stack direction="row" spacing={0.5} alignItems="center"><AddIcon fontSize="small" /> Add room type</Stack>
            ) }}>
            {addableTypes.map((t) => (
              <MenuItem key={t.type} value={t.type}>{t.type} · {t.freeCount} free · {sym}{t.avgRate.toLocaleString('en-IN')}/n</MenuItem>
            ))}
          </TextField>
        </Box>

        {block.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No room types blocked yet. Use “Add room type” to build the block.
              {typeStats.length === 0 && ' (No rooms are free for these dates.)'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            <Grid container spacing={1} sx={{ px: 1, color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>
              <Grid item xs={3}>Room Type</Grid>
              <Grid item xs={2}>Qty</Grid>
              <Grid item xs={3}>Group Rate /n</Grid>
              <Grid item xs={2}>Pax</Grid>
              <Grid item xs={2} sx={{ textAlign: 'right' }}>Amount</Grid>
            </Grid>
            {block.map((b, i) => {
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
                      onChange={(e) => updateRow(i, 'qty', e.target.value)} inputProps={{ min: 1, max: free }} fullWidth />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField size="small" type="number" value={b.rate}
                      onChange={(e) => updateRow(i, 'rate', e.target.value)} inputProps={{ min: 0 }} fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }} />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField size="small" type="number" value={b.pax}
                      onChange={(e) => updateRow(i, 'pax', e.target.value)} inputProps={{ min: 0 }} fullWidth />
                  </Grid>
                  <Grid item xs={1} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={700}>{sym}{lineTotal.toLocaleString('en-IN')}</Typography>
                  </Grid>
                  <Grid item xs={1} sx={{ textAlign: 'right' }}>
                    <IconButton size="small" onClick={() => removeRow(i)} sx={{ color: 'error.main' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              );
            })}

            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" alignItems="center">
              <Chip label={`Total rooms: ${totals.rooms}`} sx={{ fontWeight: 700 }} />
              <Chip label={`Total guests: ${totals.guests}`} sx={{ fontWeight: 700 }} />
              <Chip color="primary" label={`Total: ${sym}${totals.amount.toLocaleString('en-IN')}`} sx={{ fontWeight: 800 }} />
            </Stack>
          </Stack>
        )}
      </FormSection>

      {/* ── Section 4: Billing ───────────────────────────────────────────── */}
      <FormSection title="Billing" icon={<ReceiptLongIcon fontSize="small" />} iconColor="#0ea5e9">
        <FormLabel sx={{ fontSize: 13, fontWeight: 700 }}>Billing type</FormLabel>
        <RadioGroup row value={form.billingType} onChange={(e) => set('billingType', e.target.value)}>
          <FormControlLabel value="master" control={<Radio />} label="Master Folio" />
          <FormControlLabel value="individual" control={<Radio />} label="Individual Billing" />
          <FormControlLabel value="split" control={<Radio />} label="Split Billing" />
        </RadioGroup>
      </FormSection>

      {/* ── Section 5: Advance Payment ───────────────────────────────────── */}
      <FormSection title="Advance Payment" icon={<PaymentsIcon fontSize="small" />} iconColor="#10b981">
        <Grid container spacing={2}>
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
        </Grid>
      </FormSection>

      {/* ── Section 6: Booking Status ────────────────────────────────────── */}
      <FormSection title="Booking Status" icon={<FlagIcon fontSize="small" />} iconColor="#f59e0b">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="Status" value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              {CREATE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Typography variant="caption" color="text.secondary">
              Draft → Tentative → Confirmed → Checked-In → Completed → Cancelled.
              Use “Save draft” to hold an enquiry without confirming.
            </Typography>
          </Grid>
        </Grid>
        {error && <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{error}</Typography>}
      </FormSection>
    </FormDialog>
  );
};

export default GroupBookingDialog;
