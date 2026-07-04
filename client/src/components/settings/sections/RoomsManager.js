import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  IconButton,
  Chip,
  Stack,
  Typography,
  CircularProgress,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  KingBed as BedIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';
import { currencySym, liveRoomGstFraction } from '../../../utils/billing';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from '../../forms/formStyles';

const ACCENT = 'var(--app-primary)';
const EASE = [0.22, 1, 0.36, 1];

// Staggered entrance for the dialog fields — each row fades+rises in turn.
const fieldContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fieldItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
// Faster, springier stagger for the amenity chips.
const amenityContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.022, delayChildren: 0.04 } },
};
const amenityItem = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: EASE } },
};

const STATUS_COLORS = {
  available: 'success',
  occupied: 'error',
  maintenance: 'warning',
  cleaning: 'info',
};
const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning'];

const AMENITY_OPTIONS = [
  'Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Twin Beds',
  'Balcony', 'City View', 'Bathtub', 'Shower', 'Safe', 'Restaurant',
  'Parking', 'Mini Bar', 'Refrigerator', 'Hot Water', 'Tea/Coffee Maker', 'Bathroom',
];

const emptyForm = {
  roomNumber: '',
  categoryId: '',
  type: '',
  adults: 2,
  children: 0,
  floor: 1,
  status: 'available',
  description: '',
  amenities: [],
};

const RoomCard = ({ room, category, onEdit, onDelete, isDarkMode }) => {
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const shown = amenities.slice(0, 3);
  const overflow = amenities.length - shown.length;
  const adults = room.capacity?.adults ?? room.capacity ?? category?.maxOccupancy ?? 2;
  const children = room.capacity?.children ?? 0;

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 3,
        p: 2.5,
        backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: ACCENT,
          boxShadow: isDarkMode ? '0 16px 36px -18px rgba(0,0,0,0.7)' : '0 16px 36px -18px rgba(var(--app-primary-rgb),0.45)',
        },
        '&:hover .room-actions': { opacity: 1 },
      }}
    >
      <Stack
        className="room-actions"
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 12, right: 12, opacity: { xs: 1, md: 0 }, transition: 'opacity .2s ease' }}
      >
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(room)} sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.08)', color: ACCENT }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(room)} sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          pr: 7,
          mb: 1
        }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))', color: ACCENT,
          }}
        >
          <BedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              lineHeight: 1.1
            }}>
            {room.roomNumber}
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            {room.type || category?.name || '—'} · Floor {room.floor ?? 1}
          </Typography>
        </Box>
      </Stack>
      <Stack
        direction="row"
        sx={{
          alignItems: "flex-end",
          justifyContent: "space-between",
          mb: 1.5
        }}>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: ACCENT,
              lineHeight: 1
            }}>
            {currencySym()}{Number(room.pricePerNight || 0).toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>per night</Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Chip icon={<PeopleIcon sx={{ fontSize: 15 }} />} label={`${adults}A ${children}C`} size="small" sx={{ borderRadius: 999 }} />
          <Chip label={room.status || 'available'} size="small" color={STATUS_COLORS[room.status] || 'default'} sx={{ borderRadius: 999, textTransform: 'capitalize' }} />
        </Stack>
      </Stack>
      <Divider sx={{ mb: 1.5, opacity: isDarkMode ? 0.2 : 0.6 }} />
      {amenities.length === 0 ? (
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>No amenities</Typography>
      ) : (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{
          flexWrap: "wrap"
        }}>
          {shown.map((a) => (
            <Chip key={a} label={a} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontSize: 11, height: 24 }} />
          ))}
          {overflow > 0 && (
            <Chip label={`+${overflow}`} size="small" sx={{ borderRadius: 1.5, fontSize: 11, height: 24, bgcolor: 'rgba(var(--app-primary-rgb),0.1)', color: ACCENT, fontWeight: 600 }} />
          )}
        </Stack>
      )}
    </Box>
  );
};

const RoomsManager = ({ categories = [], onNotify, isDarkMode }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.rooms.getAll();
      setRooms(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load rooms', 'error');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const findCategory = (room) =>
    categories.find(
      (c) => (c.id || c._id) === room.categoryId || (c.id || c._id) === room.type || c.name === room.type,
    ) || null;

  const selectedCategory = categories.find((c) => (c.id || c._id) === form.categoryId) || null;
  const amenityOptions = Array.from(new Set([...AMENITY_OPTIONS, ...(form.amenities || [])]));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (room) => {
    const cat = findCategory(room);
    setEditing(room);
    setForm({
      roomNumber: room.roomNumber || '',
      categoryId: room.categoryId || cat?.id || cat?._id || '',
      type: room.type || cat?.name || '',
      adults: room.capacity?.adults ?? room.capacity ?? cat?.maxOccupancy ?? 2,
      children: room.capacity?.children ?? 0,
      floor: room.floor ?? 1,
      status: room.status || 'available',
      description: room.description || '',
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
    });
    setDialogOpen(true);
  };

  // Selecting a category sets the room's type and default occupancy. Price still
  // comes from the category; amenities are now owned per-room, but we seed them
  // from the category (legacy data) when none are set yet, as a starting point.
  const handleSelectCategory = (categoryId) => {
    const cat = categories.find((c) => (c.id || c._id) === categoryId);
    setForm((prev) => ({
      ...prev,
      categoryId,
      type: cat?.name || '',
      adults: cat?.maxOccupancy ?? prev.adults,
      amenities:
        prev.amenities && prev.amenities.length
          ? prev.amenities
          : (Array.isArray(cat?.amenities) ? cat.amenities : []),
    }));
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleSave = async () => {
    if (!form.roomNumber.trim()) {
      onNotify?.('Room number is required', 'error');
      return;
    }
    if (!form.categoryId) {
      onNotify?.('Please select a category', 'error');
      return;
    }
    setSaving(true);
    try {
      // Price still comes from the category; amenities are now owned per-room.
      const cat = categories.find((c) => (c.id || c._id) === form.categoryId);
      const payload = {
        roomNumber: form.roomNumber.trim(),
        categoryId: form.categoryId,
        type: form.type || cat?.name || '',
        pricePerNight: Number(cat?.basePrice) || 0,
        capacity: { adults: Number(form.adults) || 1, children: Number(form.children) || 0 },
        floor: Number(form.floor) || 1,
        status: form.status,
        amenities: Array.isArray(form.amenities) ? form.amenities : [],
        description: form.description.trim(),
      };
      if (editing) {
        await api.rooms.update(editing._id, payload);
        onNotify?.('Room updated', 'success');
      } else {
        await api.rooms.create(payload);
        onNotify?.('Room created', 'success');
      }
      setDialogOpen(false);
      await load();
      broadcastSettingsChange('rooms');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to save room', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (room) => {
    if (!window.confirm(`Delete room ${room.roomNumber}?`)) return;
    try {
      await api.rooms.delete(room._id);
      onNotify?.('Room deleted', 'success');
      await load();
      broadcastSettingsChange('rooms');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to delete room', 'error');
    }
  };

  const noCategories = categories.length === 0;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: 'flex-start', sm: 'center' },
          mb: 3
        }}>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          <BedIcon sx={{ color: ACCENT }} />
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {loading ? 'Loading…' : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} · created from categories`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload">
            <IconButton onClick={load} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={noCategories ? 'Create a category first' : ''}>
            <span>
              <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx} disabled={noCategories}>
                Add room
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            py: 8
          }}>
          <CircularProgress />
        </Box>
      ) : rooms.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <BedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            {noCategories ? 'Create a room category first, then add rooms.' : 'No rooms yet.'}
          </Typography>
          {!noCategories && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
              Add your first room
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {rooms.map((room) => (
            <Grid
              key={room._id}
              size={{
                xs: 12,
                sm: 6,
                lg: 4
              }}>
              <RoomCard
                room={room}
                category={findCategory(room)}
                onEdit={openEdit}
                onDelete={handleDelete}
                isDarkMode={isDarkMode}
              />
            </Grid>
          ))}
        </Grid>
      )}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        transitionDuration={{ enter: 420, exit: 200 }}
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}
        slots={{
          transition: Grow
        }}>
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={1.5} sx={{
            alignItems: "center"
          }}>
            <Box
              component={motion.div}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 15, delay: 0.08 }}
              whileHover={{ rotate: [0, -10, 8, 0], transition: { duration: 0.55 } }}
              sx={{
                width: 44, height: 44, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))', color: ACCENT,
                cursor: 'default',
              }}
            >
              <BedIcon />
            </Box>
            <Box
              component={motion.div}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.16, ease: EASE }}
            >
              <Typography sx={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                Room
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, mt: 0.25 }}>
                {editing ? `Edit Room ${editing.roomNumber || ''}` : 'New room'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
          <Box
            component={motion.div}
            variants={fieldContainer}
            initial="hidden"
            animate="visible"
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <motion.div variants={fieldItem}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Room number" required fullWidth value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
                <TextField label="Floor" type="number" fullWidth value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} slotProps={{
                  htmlInput: { min: 1 }
                }} />
              </Stack>
            </motion.div>

            <motion.div variants={fieldItem}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={form.categoryId} onChange={(e) => handleSelectCategory(e.target.value)}>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id || cat._id} value={cat.id || cat._id}>
                      {cat.name} — {currencySym()}{Number(cat.basePrice || 0).toLocaleString('en-IN')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </motion.div>

            {/* Price is inherited from the selected category — pops in / re-animates on change. */}
            <AnimatePresence initial={false}>
              {selectedCategory && (
                <Box
                  component={motion.div}
                  key={selectedCategory.id || selectedCategory._id || selectedCategory.name}
                  initial={{ opacity: 0, height: 0, scale: 0.97 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                  sx={{
                    borderRadius: 2,
                    p: 2,
                    border: '1px dashed',
                    borderColor: 'rgba(var(--app-primary-rgb),0.4)',
                    background: 'rgba(var(--app-primary-rgb),0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    From category “{selectedCategory.name}”
                  </Typography>
                  <Stack direction="row" spacing={3} sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
                    <Typography variant="body2">
                      Price: <b style={{ color: ACCENT }}>{currencySym()}{Number(selectedCategory.basePrice || 0).toLocaleString('en-IN')}</b>
                      {' '}+GST = <b>{currencySym()}{(Number(selectedCategory.basePrice || 0) * (1 + liveRoomGstFraction())).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b>
                    </Typography>
                  </Stack>
                </Box>
              )}
            </AnimatePresence>

            <motion.div variants={fieldItem}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {ROOM_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </motion.div>

            <motion.div variants={fieldItem}>
              <Stack direction="row" spacing={2}>
                <TextField label="Adults" type="number" fullWidth value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} slotProps={{
                  htmlInput: { min: 1 }
                }} />
                <TextField label="Children" type="number" fullWidth value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} slotProps={{
                  htmlInput: { min: 0 }
                }} />
              </Stack>
            </motion.div>

            <motion.div variants={fieldItem}>
              <TextField label="Description" multiline rows={2} fullWidth value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </motion.div>

            <motion.div variants={fieldItem}>
              <Divider textAlign="left">
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}>
                  Amenities (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <Box
                      component={motion.span}
                      key={form.amenities.length}
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      sx={{ display: 'inline-block', fontWeight: 700, color: ACCENT }}
                    >
                      {form.amenities.length}
                    </Box>
                  </AnimatePresence>
                  {' '}selected)
                </Typography>
              </Divider>
              <Box
                component={motion.div}
                variants={amenityContainer}
                initial="hidden"
                animate="visible"
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, mt: 1 }}
              >
                {amenityOptions.map((amenity) => {
                  const checked = form.amenities.includes(amenity);
                  return (
                    <motion.div key={amenity} variants={amenityItem} whileHover={{ x: 3 }} whileTap={{ scale: 0.95 }}>
                      <FormControlLabel
                        sx={{
                          m: 0, width: '100%', borderRadius: 2, px: 0.5,
                          transition: 'background-color .2s ease',
                          bgcolor: checked ? 'rgba(var(--app-primary-rgb),0.08)' : 'transparent',
                        }}
                        control={
                          <Checkbox
                            size="small"
                            checked={checked}
                            onChange={() => toggleAmenity(amenity)}
                            sx={{ '& .MuiSvgIcon-root': { transition: 'transform .2s ease' }, '&.Mui-checked .MuiSvgIcon-root': { transform: 'scale(1.15)' } }}
                          />
                        }
                        label={<Typography variant="body2">{amenity}</Typography>}
                      />
                    </motion.div>
                  );
                })}
              </Box>
            </motion.div>
          </Box>
        </DialogContent>
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          <Box component={motion.div} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} sx={{ display: 'inline-flex' }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
              Cancel
            </Button>
          </Box>
          <Box component={motion.div} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} sx={{ display: 'inline-flex' }}>
            <Button variant="contained" onClick={handleSave} disabled={saving} sx={primaryButtonSx}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create room'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoomsManager;
