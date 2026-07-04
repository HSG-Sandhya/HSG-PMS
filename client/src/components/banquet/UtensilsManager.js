import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, IconButton, Chip, Stack,
  TextField, MenuItem, CircularProgress, LinearProgress, Tooltip, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlenderIcon from '@mui/icons-material/Blender';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const CATEGORIES = ['Cookware', 'Serving', 'Water', 'Gas', 'Furniture', 'Other'];
const CATEGORY_COLOR = {
  Cookware: '#6366F1', Serving: '#10B981', Water: '#0EA5E9', Gas: '#EF4444', Furniture: '#F59E0B', Other: '#8B5CF6',
};

const emptyItem = {
  name: '', description: '', category: 'Cookware', unit: 'piece', cost: 0, quantityTotal: 0, isActive: true,
};

// Manages the utensil / cookware inventory the hall rents to self-cooking guests.
// Each item shows live availability (owned − reserved by active bookings).
const UtensilsManager = ({ onNotify }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.banquet.getUtensilItems();
      setItems(data?.data || []);
    } catch (e) {
      onNotify?.('Failed to load utensils', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setEditing(null); setForm(emptyItem); setDialogOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...emptyItem, ...it }); setDialogOpen(true); };
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim()) { onNotify?.('Utensil name is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost: Number(form.cost) || 0,
        quantityTotal: Math.max(0, parseInt(form.quantityTotal, 10) || 0),
      };
      if (editing) await api.banquet.updateUtensilItem(editing._id, payload);
      else await api.banquet.createUtensilItem(payload);
      onNotify?.(`Utensil ${editing ? 'updated' : 'added'}`, 'success');
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Delete utensil "${it.name}"?`)) return;
    try {
      await api.banquet.deleteUtensilItem(it._id);
      onNotify?.('Utensil deleted', 'info');
      fetchItems();
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
          Utensils & Cookware
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none',
            background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
          New Utensil
        </Button>
      </Stack>
      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <BlenderIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{
            color: "text.secondary"
          }}>
            No utensils yet. Add cookware, water jars, gas cylinders etc. to rent to self-cooking guests.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {items.map((it) => {
            const total = Number(it.quantityTotal) || 0;
            const available = Number(it.available ?? total);
            const used = Number(it.reserved ?? Math.max(0, total - available));
            const pct = total > 0 ? Math.round((available / total) * 100) : 0;
            return (
              <Grid
                key={it._id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Card sx={{ borderRadius: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <Box sx={{ height: 4, background: CATEGORY_COLOR[it.category] || 'var(--app-primary)' }} />
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "flex-start"
                      }}>
                      <Typography variant="h6" sx={{
                        fontWeight: 800
                      }}>{it.name}</Typography>
                      {!it.isActive && <Chip size="small" label="Inactive" sx={{ height: 20 }} />}
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'center' }}>
                      <Chip size="small" label={it.category}
                        sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: CATEGORY_COLOR[it.category] || 'var(--app-primary)' }} />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 800,
                          color: 'var(--app-primary)'
                        }}>
                        {currencySym()}{(it.cost || 0).toLocaleString('en-IN')}
                        <Typography component="span" variant="caption" sx={{
                          color: "text.secondary"
                        }}> /{it.unit || 'unit'}</Typography>
                      </Typography>
                    </Stack>
                    {it.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          mt: 1
                        }}>{it.description}</Typography>
                    )}
                    <Box sx={{ mt: 1.5 }}>
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: "space-between",
                          mb: 0.5
                        }}>
                        <Typography variant="caption" sx={{
                          color: "text.secondary"
                        }}>
                          {available} of {total} available
                        </Typography>
                        {used > 0 && <Typography variant="caption" sx={{
                          color: "text.secondary"
                        }}>{used} out</Typography>}
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{ height: 6, borderRadius: 3,
                          '& .MuiLinearProgress-bar': { background: pct < 20 ? '#EF4444' : CATEGORY_COLOR[it.category] || 'var(--app-primary)' } }}
                      />
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{
                        justifyContent: "flex-end",
                        mt: 1
                      }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(it)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(it)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      <FormDialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        onSubmit={handleSave}
        maxWidth="sm"
        icon={<BlenderIcon />}
        eyebrow="Utensils"
        title={editing ? 'Edit utensil' : 'New utensil'}
        submitDisabled={saving}
        submitLabel={saving ? 'Saving…' : (editing ? 'Save changes' : 'Add utensil')}
      >
        <FormSection title="Utensil Details" icon={<BlenderIcon fontSize="small" />} iconColor="#6366F1">
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}><TextField fullWidth label="Utensil name" placeholder="Cooking Pot (big) / Water Jar / Gas Cylinder" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Grid>
            <Grid size={12}><TextField fullWidth label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} multiline rows={2} /></Grid>
            <Grid size={6}>
              <TextField select fullWidth label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Unit" placeholder="piece / set / litre" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth type="number" label="Rental cost (per unit)" value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
                }} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth type="number" label="Total quantity owned" value={form.quantityTotal}
                onChange={(e) => set('quantityTotal', e.target.value)}
                helperText="Stock ceiling" slotProps={{
                htmlInput: { min: 0 }
              }} />
            </Grid>
            <Grid size={12}>
              <TextField select fullWidth label="Status" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => set('isActive', e.target.value === 'active')}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>
    </Box>
  );
};

export default UtensilsManager;
