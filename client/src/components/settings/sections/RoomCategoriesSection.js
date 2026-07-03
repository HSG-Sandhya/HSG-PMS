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
  useTheme,
  Tabs,
  Tab,
  InputAdornment,
  Grow,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  MeetingRoom as RoomIcon,
  KingBed as BedIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';
import { currencySym, liveRoomGstFraction } from '../../../utils/billing';
import RoomsManager from './RoomsManager';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from '../../forms/formStyles';

const GST_RATE = 0.05;

const emptyForm = {
  name: '',
  description: '',
  basePrice: 0,
  maxOccupancy: 2,
};

const toForm = (category) => ({
  name: category?.name || '',
  description: category?.description || '',
  basePrice: category?.basePrice ?? 0,
  maxOccupancy: category?.maxOccupancy ?? 2,
});

const fromForm = (form) => ({
  name: form.name.trim(),
  description: form.description.trim(),
  basePrice: Number(form.basePrice) || 0,
  maxOccupancy: Number(form.maxOccupancy) || 1,
});

const ACCENT = 'var(--app-primary)';
const EASE = [0.22, 1, 0.36, 1];

// Staggered entrance for the dialog fields — each row fades+rises in turn.
const fieldContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const fieldItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const CategoryCard = ({ category, onEdit, onDelete, isDarkMode }) => {
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
          boxShadow: isDarkMode
            ? '0 16px 36px -18px rgba(0,0,0,0.7)'
            : '0 16px 36px -18px rgba(var(--app-primary-rgb),0.45)',
        },
        '&:hover .cat-actions': { opacity: 1, transform: 'translateY(0)' },
      }}
    >
      {/* Actions */}
      <Stack
        className="cat-actions"
        direction="row"
        spacing={0.5}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          opacity: { xs: 1, md: 0 },
          transform: { xs: 'none', md: 'translateY(-4px)' },
          transition: 'opacity .2s ease, transform .2s ease',
        }}
      >
        <Tooltip title="Edit">
          <IconButton
            size="small"
            onClick={() => onEdit(category)}
            sx={{ bgcolor: isDarkMode ? 'rgba(var(--app-primary-rgb),0.15)' : 'rgba(var(--app-primary-rgb),0.08)', color: ACCENT }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => onDelete(category)}
            sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Title */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pr: 7, mb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))',
            color: ACCENT,
            flexShrink: 0,
          }}
        >
          <BedIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
          {category.name}
        </Typography>
      </Stack>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minHeight: 40, mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {category.description || 'No description'}
      </Typography>

      {/* Price + occupancy */}
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {currencySym()}{Number(category.basePrice || 0).toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            base · {currencySym()}{(Number(category.basePrice || 0) * (1 + liveRoomGstFraction())).toLocaleString('en-IN', { maximumFractionDigits: 0 })} incl. GST
          </Typography>
        </Box>
        <Chip
          icon={<PeopleIcon sx={{ fontSize: 16 }} />}
          label={`${category.maxOccupancy || 2} guests`}
          size="small"
          sx={{ borderRadius: 999, fontWeight: 600 }}
        />
      </Stack>
    </Box>
  );
};

const RoomCategoriesSection = ({ onNotify }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.settings.getRoomCategories();
      const list = Array.isArray(data) ? data : data?.data?.categories || data?.data || data?.categories || [];
      setCategories(list);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load room categories', 'error');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setForm(toForm(category));
    setDialogOpen(true);
  };

  const basePriceNum = Number(form.basePrice) || 0;
  const gstAmount = basePriceNum * GST_RATE;
  const totalPrice = basePriceNum + gstAmount;

  const handleSave = async () => {
    if (!form.name.trim()) {
      onNotify?.('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = fromForm(form);
      if (editing) {
        await api.settings.updateRoomCategory(editing._id || editing.id, payload);
        onNotify?.('Category updated', 'success');
      } else {
        await api.settings.addRoomCategory(payload);
        onNotify?.('Category created', 'success');
      }
      setDialogOpen(false);
      await load();
      broadcastSettingsChange('roomCategories');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    try {
      await api.settings.deleteRoomCategory(category._id || category.id);
      onNotify?.('Category deleted', 'success');
      await load();
      broadcastSettingsChange('roomCategories');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab icon={<RoomIcon fontSize="small" />} iconPosition="start" label="Categories" />
        <Tab icon={<BedIcon fontSize="small" />} iconPosition="start" label="Rooms" />
      </Tabs>

      {tab === 1 ? (
        <RoomsManager categories={categories} onNotify={onNotify} isDarkMode={isDarkMode} />
      ) : (
      <>
      {/* Toolbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <RoomIcon sx={{ color: ACCENT }} />
          <Typography variant="body2" color="text.secondary">
            {loading
              ? 'Loading…'
              : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} · templates for room creation`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload">
            <IconButton onClick={load} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add category
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : categories.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 3,
            borderRadius: 3,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <BedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No room categories yet.
          </Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add your first category
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {categories.map((cat) => (
            <Grid item xs={12} sm={6} lg={4} key={cat._id || cat.id}>
              <CategoryCard
                category={cat}
                onEdit={openEdit}
                onDelete={handleDelete}
                isDarkMode={isDarkMode}
              />
            </Grid>
          ))}
        </Grid>
      )}
      </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Grow}
        transitionDuration={{ enter: 420, exit: 200 }}
        PaperProps={{ sx: dialogPaperSx(isDarkMode) }}
        BackdropProps={{ sx: dialogBackdropSx }}
      >
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component={motion.div}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 15, delay: 0.08 }}
              whileHover={{ rotate: [0, -10, 8, 0], transition: { duration: 0.55 } }}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))',
                color: ACCENT,
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
                Room category
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, mt: 0.25 }}>
                {editing ? 'Edit category' : 'New category'}
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
              <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            </motion.div>
            <motion.div variants={fieldItem}>
              <TextField label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth />
            </motion.div>
            <motion.div variants={fieldItem}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Base price"
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  fullWidth
                  InputProps={{ startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }}
                />
                <TextField label="Max occupancy" type="number" inputProps={{ min: 1 }} value={form.maxOccupancy} onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })} fullWidth />
              </Stack>
            </motion.div>

            {/* GST + total (auto-calculated from base price) */}
            <motion.div variants={fieldItem}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="GST (5%)"
                  value={gstAmount.toFixed(2)}
                  fullWidth
                  disabled
                  InputProps={{ startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }}
                />
                <TextField
                  label="Total price (base + GST)"
                  value={totalPrice.toFixed(2)}
                  fullWidth
                  disabled
                  InputProps={{ startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      WebkitTextFillColor: ACCENT,
                      fontWeight: 700,
                    },
                  }}
                />
              </Stack>
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
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoomCategoriesSection;
