import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, TextField, MenuItem, Chip, Stack, Divider, InputAdornment,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import FormDialog, { FormSection } from './FormDialog';
import api from '../../api';
import { freeRooms, nightsBetween } from '../../utils/roomAvailability';
import { useBanquetBlocked } from '../../hooks/useBanquetBlocked';
import { currencySym, liveRoomGstFraction } from '../../utils/billing';

const fmt = (d) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const RoomTransferDialog = ({ open, onClose, booking, rooms = [], onTransferred }) => {
  const [toRoomId, setToRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [priceAdjustment, setPriceAdjustment] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentRoom = booking?.roomId && typeof booking.roomId === 'object' ? booking.roomId : null;
  const currentRoomId = currentRoom?._id || booking?.roomId;
  const nights = booking ? nightsBetween(booking.checkIn, booking.checkOut) : 1;
  // Don't offer rooms held by a banquet/marriage event over the guest's stay.
  const blockedIds = useBanquetBlocked(booking?.checkIn, booking?.checkOut);

  const available = useMemo(
    () => freeRooms(rooms, booking?.checkIn, booking?.checkOut, booking?._id)
      .filter((r) => r._id !== currentRoomId && !blockedIds.has(String(r._id))),
    [rooms, booking, currentRoomId, blockedIds],
  );

  // Suggest a price delta from the per-night difference × nights when the
  // operator picks a new room, so the folio can reflect an upgrade/downgrade.
  useEffect(() => {
    if (!toRoomId) { setPriceAdjustment(0); return; }
    const dest = rooms.find((r) => r._id === toRoomId);
    const from = rooms.find((r) => r._id === currentRoomId);
    if (dest && from && dest.pricePerNight != null && from.pricePerNight != null) {
      const delta = Math.round((dest.pricePerNight - from.pricePerNight) * (1 + liveRoomGstFraction()) * nights);
      setPriceAdjustment(delta);
    }
  }, [toRoomId, rooms, currentRoomId, nights]);

  useEffect(() => {
    if (open) { setToRoomId(''); setReason(''); setPriceAdjustment(0); setError(''); }
  }, [open]);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!toRoomId) { setError('Choose a room to move the guest to'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.bookings.transfer(booking._id, {
        toRoomId,
        reason: reason.trim(),
        priceAdjustment: Number(priceAdjustment) || 0,
      });
      onTransferred?.(data?.message || 'Room transferred');
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  if (!booking) return null;
  const destRoom = rooms.find((r) => r._id === toRoomId);

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={handleSubmit}
      maxWidth="sm"
      icon={<SwapHorizIcon />}
      eyebrow="Front Desk"
      title="Transfer room"
      submitDisabled={saving || !toRoomId}
      submitLabel={saving ? 'Moving…' : 'Confirm transfer'}
    >
      <FormSection>
        {/* From → To visual */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            mb: 1.5
          }}>
          <Box sx={{ flex: 1, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>From</Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: 'var(--app-primary)'
              }}>
              {currentRoom?.roomNumber || '—'}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>{currentRoom?.type || ''}</Typography>
          </Box>
          <ArrowRightAltIcon sx={{ color: 'var(--app-primary)', fontSize: 32 }} />
          <Box sx={{ flex: 1, p: 2, borderRadius: 2, border: '1px dashed', borderColor: destRoom ? 'var(--app-primary)' : 'divider', textAlign: 'center', background: destRoom ? 'rgba(var(--app-primary-rgb,99,102,241),0.06)' : 'transparent' }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>To</Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: destRoom ? 'var(--app-primary)' : 'text.disabled'
              }}>
              {destRoom?.roomNumber || '—'}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>{destRoom?.type || 'Pick a room'}</Typography>
          </Box>
        </Stack>

        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {booking.guestName} · {fmt(booking.checkIn)} – {fmt(booking.checkOut)} · {nights} night{nights > 1 ? 's' : ''}
        </Typography>
      </FormSection>
      <FormSection title="Transfer Details">
        <TextField
          select fullWidth label="Move to room" value={toRoomId}
          onChange={(e) => setToRoomId(e.target.value)} sx={{ mb: 2 }}
          helperText={available.length === 0 ? 'No other rooms are free for these dates' : `${available.length} room(s) free`}
        >
          {available.map((r) => (
            <MenuItem key={r._id} value={r._id}>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  width: '100%'
                }}>
                <span>Room {r.roomNumber} · {r.type}</span>
                <span style={{ color: 'var(--app-primary)', fontWeight: 700 }}>{currencySym()}{r.pricePerNight?.toLocaleString('en-IN')}/n</span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth label="Reason for transfer" value={reason}
          onChange={(e) => setReason(e.target.value)} sx={{ mb: 2 }}
          placeholder="AC fault, guest request, upgrade…"
        />

        <TextField
          fullWidth type="number" label="Folio adjustment"
          value={priceAdjustment}
          onChange={(e) => setPriceAdjustment(e.target.value)}
          helperText="Auto-suggested from the room rate difference. Positive = charge more, negative = refund."
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
          }}
        />

        {error && (
          <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{error}</Typography>
        )}
        {booking.transferHistory?.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>
              Previous transfers
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {booking.transferHistory.map((t, i) => (
                <Chip key={i} size="small" variant="outlined"
                  label={`${t.fromRoomNumber} → ${t.toRoomNumber}${t.reason ? ` · ${t.reason}` : ''}`}
                  sx={{ alignSelf: 'flex-start' }} />
              ))}
            </Stack>
          </>
        )}
      </FormSection>
    </FormDialog>
  );
};

export default RoomTransferDialog;
