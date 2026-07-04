// Interactive room-availability selector. Each room is a tappable card that is
// colour-coded for the chosen stay window; picking one drives the same
// handleRoomChange the old dropdown used, so pricing/availability stay in sync.
import { useMemo, useState, useEffect } from 'react';
import { Box, Grid, Stack, Typography, Chip, TextField, InputAdornment, ToggleButton, ToggleButtonGroup } from '@mui/material';
import KingBedIcon from '@mui/icons-material/KingBed';
import LayersIcon from '@mui/icons-material/Layers';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import { isRoomFree } from '../../../utils/roomAvailability';
import { currencySym } from '../../../utils/billing';
import { useBanquetBlocked } from '../../../hooks/useBanquetBlocked';

const statusMeta = (free, room, banquetBlocked) => {
  if (banquetBlocked) return { label: 'Event hold', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' };
  if (!free) return { label: 'Booked', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' };
  const s = String(room.status || '').toLowerCase();
  if (s.includes('clean') || s.includes('maint') || s.includes('block') || s.includes('out')) {
    return { label: room.status, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  }
  return { label: 'Available', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
};

const RoomSelectionGrid = ({ rooms = [], value, onSelect, checkInDate, checkOutDate }) => {
  const sym = currencySym();
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  // Rooms held by a banquet/marriage event for the chosen window (not bookable).
  const blockedIds = useBanquetBlocked(checkInDate, checkOutDate);

  // If the room currently picked becomes event-held (e.g. dates changed), drop
  // the selection so the operator can't submit it into a 409.
  useEffect(() => {
    if (value && blockedIds.has(String(value))) onSelect('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedIds, value]);

  const types = useMemo(() => ['all', ...Array.from(new Set(rooms.map((r) => r.type).filter(Boolean)))], [rooms]);

  const decorated = useMemo(() => rooms.map((r) => {
    const banquetBlocked = blockedIds.has(String(r._id));
    return { room: r, banquetBlocked, free: !banquetBlocked && isRoomFree(r, checkInDate, checkOutDate) };
  }), [rooms, checkInDate, checkOutDate, blockedIds]);

  const filtered = useMemo(() => decorated.filter(({ room }) => {
    if (typeFilter !== 'all' && room.type !== typeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!String(room.roomNumber).toLowerCase().includes(q) && !String(room.type).toLowerCase().includes(q)) return false;
    }
    return true;
  // available first, then by room number
  }).sort((a, b) => (b.free - a.free)), [decorated, typeFilter, query]);

  const availableCount = decorated.filter((d) => d.free).length;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          alignItems: { sm: 'center' },
          mb: 2
        }}>
        <ToggleButtonGroup
          exclusive size="small" value={typeFilter}
          onChange={(e, v) => v && setTypeFilter(v)}
          sx={{ flexWrap: 'wrap', gap: 0.75,
            '& .MuiToggleButton-root': { border: '1px solid', borderColor: 'divider', borderRadius: '999px !important',
              px: 1.5, py: 0.4, textTransform: 'none', fontWeight: 700, fontSize: 12.5 },
            '& .Mui-selected': { color: 'var(--app-primary)', borderColor: 'var(--app-primary)',
              background: 'rgba(var(--app-primary-rgb),0.10)' } }}
        >
          {types.map((t) => <ToggleButton key={t} value={t}>{t === 'all' ? 'All rooms' : t}</ToggleButton>)}
        </ToggleButtonGroup>
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" label={`${availableCount} available`} sx={{ fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#16a34a' }} />
        <TextField
          size="small" placeholder="Find room…" value={query} onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 200 } }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }
          }}
        />
      </Stack>
      {filtered.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>No rooms match these filters.</Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5}>
          {filtered.map(({ room, free, banquetBlocked }) => {
            const selected = value === room._id;
            const meta = statusMeta(free, room, banquetBlocked);
            const cap = (room.capacity?.adults || 0) + (room.capacity?.children || 0);
            const selectable = free;
            return (
              <Grid
                key={room._id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Box
                  role="button"
                  onClick={() => selectable && onSelect(room._id)}
                  sx={{
                    cursor: selectable ? 'pointer' : 'not-allowed',
                    opacity: selectable ? 1 : 0.55,
                    height: '100%',
                    p: 1.75,
                    borderRadius: 2.5,
                    position: 'relative',
                    transition: 'all 0.18s ease',
                    border: '1.5px solid',
                    borderColor: selected ? 'var(--app-primary)' : 'divider',
                    background: selected ? 'rgba(var(--app-primary-rgb),0.06)' : 'background.paper',
                    boxShadow: selected ? '0 0 0 3px rgba(var(--app-primary-rgb),0.14)' : 'none',
                    '&:hover': selectable ? { borderColor: 'var(--app-primary)', transform: 'translateY(-2px)',
                      boxShadow: '0 12px 24px -16px rgba(15,31,61,0.4)' } : {},
                  }}
                >
                  {selected && (
                    <CheckCircleIcon sx={{ position: 'absolute', top: 10, right: 10, fontSize: 20, color: 'var(--app-primary)' }} />
                  )}
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "flex-start"
                    }}>
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {room.roomNumber}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{room.type}</Typography>
                    </Box>
                    <Chip size="small" label={meta.label}
                      sx={{ height: 22, fontWeight: 800, fontSize: 11, color: meta.color, background: meta.bg }} />
                  </Stack>

                  <Stack direction="row" spacing={1.5} sx={{ mt: 1.25, color: 'text.secondary', flexWrap: 'wrap', gap: 0.5 }}>
                    <Stack direction="row" spacing={0.4} sx={{
                      alignItems: "center"
                    }}><LayersIcon sx={{ fontSize: 15 }} /><Typography variant="caption" sx={{
                      fontWeight: 600
                    }}>Floor {room.floor ?? '—'}</Typography></Stack>
                    <Stack direction="row" spacing={0.4} sx={{
                      alignItems: "center"
                    }}><PeopleAltIcon sx={{ fontSize: 15 }} /><Typography variant="caption" sx={{
                      fontWeight: 600
                    }}>Sleeps {cap || '—'}</Typography></Stack>
                    <Stack direction="row" spacing={0.4} sx={{
                      alignItems: "center"
                    }}><KingBedIcon sx={{ fontSize: 15 }} /><Typography variant="caption" sx={{
                      fontWeight: 600
                    }}>{room.capacity?.adults > 1 ? 'Double' : 'Single'}</Typography></Stack>
                  </Stack>

                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      mt: 1.25,
                      pt: 1.25,
                      borderTop: '1px dashed',
                      borderColor: 'divider'
                    }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color: 'var(--app-primary)' }}>
                      {sym}{(room.pricePerNight || 0).toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>/ night</Typography>
                  </Stack>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default RoomSelectionGrid;
