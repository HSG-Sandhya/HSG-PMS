import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, IconButton, Chip, Stack,
  TextField, MenuItem, CircularProgress, Divider, Tooltip, InputAdornment, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const CATEGORIES = ['Veg', 'Non-Veg', 'Mixed'];
const CATEGORY_COLOR = { 'Veg': '#10B981', 'Non-Veg': '#EF4444', 'Mixed': '#F59E0B' };

// Suggested names for the catering Package name field (freeSolo — user can
// still type anything). Common per-plate menu tiers and cuisines.
const NAME_SUGGESTIONS = [
  'Silver Veg Menu', 'Gold Veg Menu', 'Platinum Veg Menu',
  'Standard Veg Thali', 'Deluxe Non-Veg Menu', 'Royal Non-Veg Thali',
  'Premium Mixed Menu', 'North Indian Thali', 'South Indian Special',
  'Live Counter Package', 'Wedding Feast', 'Corporate Lunch',
];

// Suggested dishes for the "Dishes included" field (multi-select freeSolo —
// user can still add anything). Common Indian banquet menu items.
const DISH_SUGGESTIONS = [
  'Paneer Tikka', 'Veg Spring Roll', 'Chicken Tikka', 'Fish Fry',
  'Paneer Butter Masala', 'Dal Makhani', 'Mix Veg', 'Chana Masala',
  'Veg Pulao', 'Jeera Rice', 'Butter Naan', 'Tandoori Roti',
  'Chicken Curry', 'Mutton Rogan Josh', 'Egg Curry',
  'Green Salad', 'Raita', 'Papad', 'Pickle',
  'Gulab Jamun', 'Ice Cream', 'Rasgulla', 'Gajar Halwa',
];

const emptyPkg = {
  name: '', description: '', category: 'Veg', pricePerPlate: 0, items: [], isActive: true,
};

const CateringPackagesManager = ({ onNotify }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPkg);
  const [saving, setSaving] = useState(false);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.banquet.getCateringPackages();
      setPackages(data?.data || []);
    } catch (e) {
      onNotify?.('Failed to load catering packages', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const openNew = () => { setEditing(null); setForm(emptyPkg); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...emptyPkg, ...p, items: p.items || [] });
    setDialogOpen(true);
  };

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim()) { onNotify?.('Package name is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        pricePerPlate: Number(form.pricePerPlate) || 0,
        items: Array.isArray(form.items)
          ? form.items.map((s) => s.trim()).filter(Boolean)
          : String(form.items).split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (editing) await api.banquet.updateCateringPackage(editing._id, payload);
      else await api.banquet.createCateringPackage(payload);
      onNotify?.(`Catering package ${editing ? 'updated' : 'created'}`, 'success');
      setDialogOpen(false);
      fetchPackages();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete catering package "${p.name}"?`)) return;
    try {
      await api.banquet.deleteCateringPackage(p._id);
      onNotify?.('Catering package deleted', 'info');
      fetchPackages();
    } catch (e) {
      onNotify?.('Delete failed', 'error');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3
        }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            color: 'var(--app-primary)'
          }}>
          Catering Packages
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none',
            background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
          New Catering Package
        </Button>
      </Stack>
      {packages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <RestaurantMenuIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{
            color: "text.secondary"
          }}>No catering packages yet. Create per-plate menus to speed up bookings.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {packages.map((p) => (
            <Grid
              key={p._id}
              size={{
                xs: 12,
                sm: 6,
                md: 4
              }}>
              <Card sx={{ borderRadius: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ height: 4, background: CATEGORY_COLOR[p.category] || 'var(--app-primary)' }} />
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "flex-start"
                    }}>
                    <Typography variant="h6" sx={{
                      fontWeight: 800
                    }}>{p.name}</Typography>
                    {!p.isActive && <Chip size="small" label="Inactive" sx={{ height: 20 }} />}
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'center' }}>
                    <Chip size="small" label={p.category}
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: CATEGORY_COLOR[p.category] || 'var(--app-primary)' }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        color: 'var(--app-primary)'
                      }}>
                      {currencySym()}{(p.pricePerPlate || 0).toLocaleString('en-IN')}
                      <Typography component="span" variant="caption" sx={{
                        color: "text.secondary"
                      }}> /plate</Typography>
                    </Typography>
                  </Stack>
                  {p.description && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        mt: 1
                      }}>{p.description}</Typography>
                  )}
                  {(p.items || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Box>
                        {p.items.slice(0, 6).map((it, i) => (
                          <Typography
                            key={i}
                            variant="caption"
                            sx={{
                              display: "block",
                              color: "text.secondary"
                            }}>• {it}</Typography>
                        ))}
                        {p.items.length > 6 && (
                          <Typography variant="caption" sx={{
                            color: "text.disabled"
                          }}>+{p.items.length - 6} more…</Typography>
                        )}
                      </Box>
                    </>
                  )}
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      justifyContent: "flex-end",
                      mt: 1
                    }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(p)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <FormDialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        onSubmit={handleSave}
        maxWidth="sm"
        icon={<RestaurantMenuIcon />}
        eyebrow="Catering"
        title={editing ? 'Edit catering package' : 'New catering package'}
        submitDisabled={saving}
        submitLabel={saving ? 'Saving…' : (editing ? 'Save changes' : 'Create package')}
      >
        <FormSection title="Package Details" icon={<RestaurantMenuIcon fontSize="small" />} iconColor="#f43f5e">
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <Autocomplete
                freeSolo
                options={NAME_SUGGESTIONS}
                inputValue={form.name}
                onInputChange={(e, val) => set('name', val)}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Package name" required
                    helperText="Pick a suggestion or type your own" />
                )}
              />
            </Grid>
            <Grid size={12}><TextField fullWidth label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} multiline rows={2} /></Grid>
            <Grid size={6}>
              <TextField select fullWidth label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField fullWidth type="number" label="Price per plate" value={form.pricePerPlate}
                onChange={(e) => set('pricePerPlate', e.target.value)}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
                }} />
            </Grid>
            <Grid size={12}>
              <TextField select fullWidth label="Status" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => set('isActive', e.target.value === 'active')}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}>
              <Autocomplete
                multiple freeSolo filterSelectedOptions
                options={DISH_SUGGESTIONS}
                value={Array.isArray(form.items) ? form.items.filter(Boolean) : []}
                onChange={(e, val) => set('items', val)}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Dishes included"
                    placeholder="Pick or type, then Enter"
                    helperText="Choose from suggestions or type your own and press Enter" />
                )}
              />
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>
    </Box>
  );
};

export default CateringPackagesManager;
