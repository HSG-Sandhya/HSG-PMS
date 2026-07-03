import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, MenuItem, Grid, Stack, Chip, Alert, CircularProgress, Button,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FormDialog, { FormSection } from './FormDialog';
import api from '../../api';
import { freeRooms, nightsBetween } from '../../utils/roomAvailability';
import { useBilling } from '../../hooks/useBilling';
import { useSettings } from '../../contexts/SettingsContext';
import { calcGst, currencySym } from '../../utils/billing';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lifecycle transitions — mirrors the server STATUS_TRANSITIONS state machine.
const TRANSITIONS = {
  Draft: ['Tentative', 'Confirmed', 'Cancelled'],
  Tentative: ['Confirmed', 'Cancelled'],
  Pending: ['Confirmed', 'Tentative', 'Cancelled'],
  Confirmed: ['Checked-In', 'Completed', 'Cancelled'],
  'Checked-In': ['Completed', 'Cancelled'],
};
const STATUS_LABEL = { Tentative: 'Mark tentative', Confirmed: 'Confirm', 'Checked-In': 'Check in', Completed: 'Complete', Cancelled: 'Cancel' };
const STATUS_COLOR = { Draft: 'default', Tentative: 'warning', Pending: 'warning', Confirmed: 'info', 'Checked-In': 'primary', Completed: 'success', Cancelled: 'error', Rejected: 'error' };
const btnColor = (s) => (s === 'Cancelled' ? 'error' : s === 'Completed' ? 'success' : 'primary');

const SHARING = ['Single', 'Double', 'Twin', 'Triple', 'Dormitory', 'Other'];
// Subset of the Booking.idCardType enum that the front desk actually uses.
const ID_TYPES = ['Aadhaar', 'Passport', 'Driving License', 'Voter ID', 'PAN Card', 'Other'];

// Map a fetched booking into the dialog's editable row shape.
const toRow = (b) => ({
  _id: b._id,
  guestName: b.guestName || '',
  roomType: b.roomType || (b.roomId?.type) || '',
  roomId: (b.roomId?._id || b.roomId || '') || '',
  roomNumber: b.roomId?.roomNumber || '',
  sharing: b.sharing || '',
  idCardType: b.idCardType || '',
  idCardNumber: b.idCardNumber || '',
  isGroupMaster: !!b.isGroupMaster,
  checkIn: b.checkIn,
  checkOut: b.checkOut,
});

const RoomingListDialog = ({ open, onClose, groupId, rooms = [], onUpdated }) => {
  const billing = useBilling();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [cluster, setCluster] = useState([]); // raw bookings (with amounts + company)
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState({ groupName: '', bookingType: '' });
  const [addType, setAddType] = useState('');
  const [addGuest, setAddGuest] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true); setError(''); setOkMsg('');
    try {
      const { data } = await api.bookings.getGroup(groupId);
      const list = data?.data || [];
      setRows(list.map(toRow));
      setCluster(list);
      const master = list.find((b) => b.isGroupMaster) || list[0];
      setStatus(master?.bookingStatus || '');
      setMeta({ groupName: master?.groupName || '', bookingType: master?.bookingType || '' });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load rooming list');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const changeStatus = async (next) => {
    setStatusBusy(true); setError(''); setOkMsg('');
    try {
      await api.bookings.updateGroupStatus(groupId, next);
      setOkMsg(`Moved to ${next}.`);
      onUpdated?.();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  useEffect(() => {
    if (open) load();
    else { setRows([]); setCluster([]); setStatus(''); setMeta({ groupName: '', bookingType: '' }); setAddType(''); setAddGuest(''); setError(''); setOkMsg(''); }
  }, [open, load]);

  const window0 = rows[0] || {};
  const nights = nightsBetween(window0.checkIn, window0.checkOut);
  // Rooms free for the group's stay window (snapshot from the page's room list).
  const freeSet = useMemo(() => {
    const f = freeRooms(rooms, window0.checkIn, window0.checkOut);
    return new Set(f.map((r) => r._id));
  }, [rooms, window0.checkIn, window0.checkOut]);

  // Room types (with a default rate) available to add another guest.
  const typeStats = useMemo(() => {
    const f = freeRooms(rooms, window0.checkIn, window0.checkOut);
    const map = {};
    for (const r of f) {
      if (!map[r.type]) map[r.type] = { type: r.type, rateSum: 0, count: 0 };
      map[r.type].rateSum += (r.pricePerNight || 0);
      map[r.type].count += 1;
    }
    return Object.values(map).map((t) => ({ type: t.type, avgRate: Math.round(t.rateSum / t.count) }));
  }, [rooms, window0.checkIn, window0.checkOut]);

  const addGuestRoom = async () => {
    if (!addType) return;
    const stat = typeStats.find((t) => t.type === addType);
    const rate = stat?.avgRate || 0;
    const base = rate * nights;
    const gst = calcGst(base, billing);
    setAdding(true); setError(''); setOkMsg('');
    try {
      await api.bookings.addRoomToGroup(groupId, {
        roomType: addType,
        rate,
        guestName: addGuest.trim() || undefined,
        baseAmount: base,
        gstAmount: gst,
        totalAmount: base + gst,
      });
      setAddType(''); setAddGuest('');
      setOkMsg('Guest added.');
      onUpdated?.();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add guest');
    } finally {
      setAdding(false);
    }
  };

  const exportPdf = () => {
    const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
    if (!win) { setError('Allow pop-ups to export the rooming list.'); return; }
    const title = `${meta.groupName || 'Group'} — Rooming List`;
    const rowsHtml = rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(r.roomNumber) || '—'}</td>
        <td>${esc(r.guestName) || '—'}</td>
        <td>${esc(r.sharing) || '—'}</td>
        <td>${esc(r.idCardType) || '—'}${r.idCardNumber ? ` · ${esc(r.idCardNumber)}` : ''}</td>
      </tr>`).join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;padding:32px}
        h1{font-size:20px;margin:0 0 4px} .sub{color:#64748b;font-size:13px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
        th{background:#f8fafc;font-weight:700}
      </style></head><body>
      <h1>${esc(title)}</h1>
      <div class="sub">${esc(meta.bookingType || '')} · ${rows.length} room(s) · status ${esc(status)} · ${esc(groupId)}</div>
      <table><thead><tr><th>#</th><th>Room No</th><th>Guest Name</th><th>Sharing</th><th>ID Proof</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    win.document.close(); win.focus();
    win.onload = () => { win.print(); };
  };

  // ── GST tax invoice (company clusters) ──────────────────────────────────────
  // Built client-side from the cluster's amounts + the hotel's settings. Hotel
  // accommodation is intra-state, so GST is split CGST + SGST (half each).
  const exportGstInvoice = () => {
    const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
    if (!win) { setError('Allow pop-ups to print the invoice.'); return; }
    const master = cluster.find((b) => b.isGroupMaster) || cluster[0] || {};
    const billed = cluster; // every room is a line item
    const nightsN = nightsBetween(master.checkIn, master.checkOut);

    const hotel = {
      name: settings?.hotelProfile?.hotelName || settings?.hotelName || 'Hotel',
      gstin: settings?.tax?.gstNumber || settings?.hotelProfile?.businessRegistration?.gstNumber || '',
      address: [settings?.hotelProfile?.address?.line1, settings?.hotelProfile?.address?.city || settings?.address?.city]
        .filter(Boolean).join(', '),
    };
    const buyer = {
      name: master.company?.name || master.groupName || master.guestName || '',
      gstin: master.company?.gstNumber || '',
      address: master.company?.billingAddress || master.companyDetails?.primaryContact?.name || '',
    };

    const taxable = billed.reduce((s, b) => s + (Number(b.baseAmount) || 0), 0);
    const gst = billed.reduce((s, b) => s + (Number(b.gstAmount) || 0), 0);
    const grand = billed.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
    const cgst = gst / 2, sgst = gst / 2;
    const gstPct = taxable > 0 ? Math.round((gst / taxable) * 100) : 0;

    const lineHtml = billed.map((b, i) => {
      const base = Number(b.baseAmount) || 0;
      const rate = nightsN > 0 ? Math.round(base / nightsN) : base;
      const roomNo = b.roomId?.roomNumber ? ` (Room ${esc(b.roomId.roomNumber)})` : '';
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(b.roomType || 'Room')}${roomNo}<div class="muted">996311 · ${esc(b.guestName) || ''}</div></td>
        <td class="r">${nightsN}</td>
        <td class="r">${currencySym()}${rate.toLocaleString('en-IN')}</td>
        <td class="r">${currencySym()}${base.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');

    const money = (n) => `${currencySym()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ${esc(master.invoiceNumber || '')}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;padding:32px;font-size:13px}
        .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
        h1{font-size:18px;margin:0} h2{font-size:15px;margin:0 0 2px}
        .muted{color:#64748b;font-size:11px}
        .parties{display:flex;gap:24px;margin:14px 0}
        .parties>div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left} th{background:#f8fafc}
        td.r,th.r{text-align:right}
        .totals{margin-top:10px;margin-left:auto;width:320px}
        .totals td{border:none;padding:4px 9px} .totals tr.grand td{border-top:2px solid #0f172a;font-weight:800;font-size:15px}
      </style></head><body>
      <div class="top">
        <div><h2>${esc(hotel.name)}</h2><div class="muted">${esc(hotel.address)}</div><div class="muted">GSTIN: ${esc(hotel.gstin) || '—'}</div></div>
        <div style="text-align:right"><h1>TAX INVOICE</h1>
          <div class="muted">No: ${esc(master.invoiceNumber || groupId)}</div>
          <div class="muted">Date: ${new Date().toLocaleDateString('en-IN')}</div></div>
      </div>
      <div class="parties">
        <div><div class="muted">BILL TO</div><strong>${esc(buyer.name) || '—'}</strong>
          <div class="muted">${esc(buyer.address)}</div><div class="muted">GSTIN: ${esc(buyer.gstin) || '—'}</div></div>
        <div><div class="muted">STAY</div>${new Date(master.checkIn).toLocaleDateString('en-IN')} → ${new Date(master.checkOut).toLocaleDateString('en-IN')}
          <div class="muted">${nightsN} night(s) · ${billed.length} room(s)</div></div>
      </div>
      <table><thead><tr><th>#</th><th>Description (HSN/SAC)</th><th class="r">Nights</th><th class="r">Rate</th><th class="r">Taxable</th></tr></thead>
        <tbody>${lineHtml}</tbody></table>
      <table class="totals">
        <tr><td>Taxable value</td><td class="r">${money(taxable)}</td></tr>
        <tr><td>CGST @ ${gstPct / 2}%</td><td class="r">${money(cgst)}</td></tr>
        <tr><td>SGST @ ${gstPct / 2}%</td><td class="r">${money(sgst)}</td></tr>
        <tr class="grand"><td>Grand total</td><td class="r">${money(grand)}</td></tr>
      </table>
      <p class="muted" style="margin-top:24px">This is a computer-generated tax invoice. Place of supply: ${esc(hotel.address) || 'hotel premises'}.</p>
      </body></html>`);
    win.document.close(); win.focus();
    win.onload = () => { win.print(); };
  };

  const setRow = (i, k, v) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  // Rooms a given row may pick: matching type, free (or already this row's), and
  // not claimed by another row in the same cluster.
  const optionsFor = (i) => {
    const row = rows[i];
    const claimed = new Set(rows.filter((r, idx) => idx !== i && r.roomId).map((r) => r.roomId));
    return rooms.filter((room) =>
      (!row.roomType || room.type === row.roomType)
      && !claimed.has(room._id)
      && (freeSet.has(room._id) || room._id === row.roomId));
  };

  const assignedCount = rows.filter((r) => r.roomId).length;

  const saveAll = async () => {
    setSaving(true); setError(''); setOkMsg('');
    try {
      for (const row of rows) {
        await api.bookings.assignRoom(row._id, {
          roomId: row.roomId || null,
          guestName: row.guestName,
          sharing: row.sharing,
          idCardType: row.idCardType || undefined,
          idCardNumber: row.idCardNumber,
        });
      }
      setOkMsg('Rooming list saved.');
      onUpdated?.();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save rooming list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={(e) => { e?.preventDefault?.(); saveAll(); }}
      maxWidth="md"
      icon={<ListAltIcon />}
      eyebrow="Front Desk · Group / Company"
      title="Rooming list"
      submitDisabled={saving || loading || rows.length === 0}
      submitLabel={saving ? 'Saving…' : 'Save rooming list'}
      extraActions={(
        <Stack direction="row" spacing={1} sx={{ mr: 'auto' }}>
          <Button onClick={exportPdf} disabled={loading || rows.length === 0}
            startIcon={<PictureAsPdfIcon />} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Export PDF
          </Button>
          {meta.bookingType === 'company' && (
            <Button onClick={exportGstInvoice} disabled={loading || rows.length === 0}
              startIcon={<ReceiptLongIcon />} sx={{ textTransform: 'none', fontWeight: 700 }}>
              GST Invoice
            </Button>
          )}
        </Stack>
      )}
    >
      <FormSection title="Booking Status" icon={<FlagIcon fontSize="small" />} iconColor="#f59e0b">
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">Current:</Typography>
          <Chip label={status || '—'} color={STATUS_COLOR[status] || 'default'} sx={{ fontWeight: 800 }} />
          {(TRANSITIONS[status] || []).length > 0 && <Typography variant="body2" color="text.secondary">→</Typography>}
          {(TRANSITIONS[status] || []).map((next) => (
            <Button key={next} size="small" variant={next === 'Cancelled' ? 'outlined' : 'contained'}
              color={btnColor(next)} disabled={statusBusy || loading}
              onClick={() => changeStatus(next)} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {STATUS_LABEL[next] || next}
            </Button>
          ))}
          {(TRANSITIONS[status] || []).length === 0 && status && (
            <Typography variant="caption" color="text.secondary">No further transitions.</Typography>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Applies to the whole cluster. “Check in” marks the lifecycle stage — occupy each room from the booking row's check-in action.
        </Typography>
      </FormSection>

      <FormSection title="Assign rooms & occupants" icon={<ListAltIcon fontSize="small" />} iconColor="#6366f1">
        {loading ? (
          <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress size={30} /></Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No rooms in this booking.
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
              <Chip size="small" label={`${rows.length} room${rows.length === 1 ? '' : 's'}`} sx={{ fontWeight: 700 }} />
              <Chip size="small" color={assignedCount === rows.length ? 'success' : 'default'}
                label={`${assignedCount}/${rows.length} assigned`} sx={{ fontWeight: 700 }} />
            </Stack>
            <Grid container spacing={1} sx={{ px: 1, color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>
              <Grid item xs={3}>Room No</Grid>
              <Grid item xs={3}>Guest Name</Grid>
              <Grid item xs={2}>Sharing</Grid>
              <Grid item xs={2}>ID Proof</Grid>
              <Grid item xs={2}>ID Number</Grid>
            </Grid>
            {rows.map((row, i) => (
              <Grid container spacing={1} key={row._id} alignItems="center"
                sx={{ p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Grid item xs={12} sm={3}>
                  <TextField select size="small" fullWidth label={row.roomType || 'Room'}
                    value={row.roomId} onChange={(e) => setRow(i, 'roomId', e.target.value)}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {optionsFor(i).map((room) => (
                      <MenuItem key={room._id} value={room._id}>
                        Room {room.roomNumber} · {room.type}
                      </MenuItem>
                    ))}
                  </TextField>
                  {row.isGroupMaster && <Chip size="small" label="Master" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />}
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField size="small" fullWidth value={row.guestName}
                    onChange={(e) => setRow(i, 'guestName', e.target.value)} placeholder="Occupant name" />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField select size="small" fullWidth value={row.sharing}
                    onChange={(e) => setRow(i, 'sharing', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {SHARING.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField select size="small" fullWidth value={row.idCardType}
                    onChange={(e) => setRow(i, 'idCardType', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {ID_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField size="small" fullWidth value={row.idCardNumber}
                    onChange={(e) => setRow(i, 'idCardNumber', e.target.value)} placeholder="ID number" />
                </Grid>
              </Grid>
            ))}

            {/* + Add guest — appends another room slot to the cluster */}
            <Grid container spacing={1} alignItems="center"
              sx={{ p: 1, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
              <Grid item xs={12} sm={4}>
                <TextField select size="small" fullWidth label="Add room type" value={addType}
                  onChange={(e) => setAddType(e.target.value)} disabled={typeStats.length === 0}>
                  {typeStats.map((t) => (
                    <MenuItem key={t.type} value={t.type}>{t.type} · {currencySym()}{t.avgRate.toLocaleString('en-IN')}/n</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField size="small" fullWidth label="Guest name (optional)" value={addGuest}
                  onChange={(e) => setAddGuest(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button fullWidth size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={addGuestRoom} disabled={!addType || adding}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  {adding ? 'Adding…' : 'Add guest'}
                </Button>
              </Grid>
            </Grid>

            {error && <Alert severity="error">{error}</Alert>}
            {okMsg && <Alert severity="success">{okMsg}</Alert>}
            <Typography variant="caption" color="text.secondary">
              Only free rooms of each slot's type are listed. Assign a room before check-in.
            </Typography>
          </Stack>
        )}
      </FormSection>
    </FormDialog>
  );
};

export default RoomingListDialog;
