// Per-room occupant + ID capture for a multi-room booking. The FIRST selected
// room is the primary guest — captured by the form's main Guest Information and
// Aadhaar sections. This panel handles every ADDITIONAL room: one occupant and
// one ID (front + back) per room, saved as its own booking on submit.
import { useState, useEffect } from 'react';
import {
  Box, Grid, Stack, Typography, TextField, MenuItem, IconButton, Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CloseIcon from '@mui/icons-material/Close';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { currencySym } from '../../../utils/billing';

const ID_TYPES = ['Aadhaar Card', 'Passport', 'Driving License', 'Voter ID', 'PAN Card', 'Other'];
const GENDERS = ['Male', 'Female', 'Other'];

// A single image drop tile with live preview. The object URL is created and
// revoked inside the effect so React.StrictMode's mount/unmount simulation
// can't leave the <img> pointing at a revoked blob URL (blank preview).
const ImageDrop = ({ label, file, onPick, onClear }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!(file instanceof File)) { setUrl(null); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <Box
      component="label"
      sx={{
        display: 'block', cursor: 'pointer', position: 'relative',
        borderRadius: 2, overflow: 'hidden',
        border: '1.5px dashed', borderColor: file ? 'var(--app-primary)' : 'divider',
        background: file ? 'transparent' : 'rgba(var(--app-primary-rgb),0.03)',
        minHeight: 104, transition: 'all 0.18s ease',
        '&:hover': { borderColor: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb),0.05)' },
      }}
    >
      {url ? (
        <>
          <Box component="img" src={url} alt={label}
            sx={{ width: '100%', height: 104, objectFit: 'cover', display: 'block' }} />
          <IconButton size="small"
            onClick={(e) => { e.preventDefault(); onClear(); }}
            sx={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', color: '#fff',
              '&:hover': { background: 'rgba(0,0,0,0.75)' } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
          <Chip size="small" label={label} sx={{ position: 'absolute', bottom: 4, left: 4, fontWeight: 700,
            background: 'rgba(0,0,0,0.6)', color: '#fff' }} />
        </>
      ) : (
        <Stack spacing={0.25} sx={{ alignItems: 'center', justifyContent: 'center', height: 104, color: 'text.secondary' }}>
          <CloudUploadIcon sx={{ color: 'var(--app-primary)' }} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
        </Stack>
      )}
      <input type="file" hidden accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </Box>
  );
};

const RoomGuestPanels = ({
  rooms = [], selectedIds = [], assignments = {}, onAssignmentChange, onRemoveRoom,
}) => {
  const sym = currencySym();
  // Skip the first room — it's the primary guest handled by the main form.
  const extraIds = selectedIds.slice(1);
  if (extraIds.length === 0) return null;

  const roomById = (id) => rooms.find((r) => r._id === id);
  const patch = (id, key, val) => onAssignmentChange(id, { [key]: val });

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Room 1 uses the primary guest above. Add the occupant &amp; ID for each additional room —
        every room is saved as its own booking.
      </Typography>
      {extraIds.map((id, idx) => {
        const room = roomById(id);
        if (!room) return null;
        const a = assignments[id] || {};
        return (
          <Box key={id} sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
            background: 'rgba(var(--app-primary-rgb),0.02)' }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: '999px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', background: 'var(--app-primary)' }}>
                {idx + 2}
              </Box>
              <PersonOutlineIcon fontSize="small" sx={{ color: 'var(--app-primary)' }} />
              <Typography sx={{ fontWeight: 800 }}>
                Room {room.roomNumber} · {room.type}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {sym}{(room.pricePerNight || 0).toLocaleString('en-IN')}/night
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton size="small" onClick={() => onRemoveRoom(id)} sx={{ color: 'text.secondary' }} title="Remove this room">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth size="small" required label="Guest name" value={a.guestName || ''}
                  onChange={(e) => patch(id, 'guestName', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField fullWidth size="small" type="number" label="Age" value={a.age || ''}
                  onChange={(e) => patch(id, 'age', e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField select fullWidth size="small" label="Gender" value={a.gender || ''}
                  onChange={(e) => patch(id, 'gender', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField select fullWidth size="small" label="ID type" value={a.idCardType || 'Aadhaar Card'}
                  onChange={(e) => patch(id, 'idCardType', e.target.value)}>
                  {ID_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField fullWidth size="small" label="ID number" value={a.idCardNumber || ''}
                  onChange={(e) => patch(id, 'idCardNumber', e.target.value)}
                  placeholder={(a.idCardType || 'Aadhaar Card') === 'Aadhaar Card' ? 'XXXX-XXXX-XXXX' : 'ID number'} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <ImageDrop label="ID front" file={a.frontImage instanceof File ? a.frontImage : null}
                  onPick={(f) => patch(id, 'frontImage', f)} onClear={() => patch(id, 'frontImage', null)} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <ImageDrop label="ID back" file={a.backImage instanceof File ? a.backImage : null}
                  onPick={(f) => patch(id, 'backImage', f)} onClear={() => patch(id, 'backImage', null)} />
              </Grid>
            </Grid>
          </Box>
        );
      })}
    </Stack>
  );
};

export default RoomGuestPanels;
