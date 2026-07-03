import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, IconButton, Chip, Stack,
  TextField, MenuItem, CircularProgress, Divider, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';

const EVENT_TYPES = ['Wedding', 'Engagement', 'Reception', 'Anniversary', 'Birthday', 'Corporate', 'Conference', 'Party', 'Other'];
const DECOR = ['Standard', 'Premium', 'Custom'];

const emptyPkg = {
  name: '', description: '', eventTypes: [], hallId: '',
  basePrice: 0, pricePerPlate: 0, decorationType: 'Standard', decorationCost: 0,
  inclusions: [], isActive: true,
};

const EventPackagesManager = ({ halls = [], onNotify }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPkg);
  const [saving, setSaving] = useState(false);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.banquet.getPackages();
      setPackages(data?.data || []);
    } catch (e) {
      onNotify?.('Failed to load packages', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const openNew = () => { setEditing(null); setForm(emptyPkg); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...emptyPkg, ...p,
      hallId: p.hallId?._id || p.hallId || '',
      eventTypes: p.eventTypes || [],
      inclusions: p.inclusions || [],
    });
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
        hallId: form.hallId || null,
        basePrice: Number(form.basePrice) || 0,
        pricePerPlate: Number(form.pricePerPlate) || 0,
        decorationCost: Number(form.decorationCost) || 0,
        inclusions: Array.isArray(form.inclusions)
          ? form.inclusions
          : String(form.inclusions).split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (editing) await api.banquet.updatePackage(editing._id, payload);
      else await api.banquet.createPackage(payload);
      onNotify?.(`Package ${editing ? 'updated' : 'created'}`, 'success');
      setDialogOpen(false);
      fetchPackages();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete package "${p.name}"?`)) return;
    try {
      await api.banquet.deletePackage(p._id);
      onNotify?.('Package deleted', 'info');
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: 'var(--app-primary)' }}>
          Event Packages
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none',
            background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' }}>
          New Package
        </Button>
      </Stack>

      {packages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Inventory2OutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No packages yet. Create one to speed up event bookings.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {packages.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p._id}>
              <Card sx={{ borderRadius: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ height: 4, background: 'linear-gradient(90deg, var(--app-primary), var(--app-secondary, #EC4899))' }} />
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" fontWeight={800}>{p.name}</Typography>
                    {!p.isActive && <Chip size="small" label="Inactive" sx={{ height: 20 }} />}
                  </Stack>
                  {p.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{p.description}</Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {(p.eventTypes || []).map((t) => (
                      <Chip key={t} size="small" label={t} sx={{ height: 22, fontSize: 11 }} />
                    ))}
                  </Stack>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={0.5}>
                    <Row label="Per plate" value={`${currencySym()}${(p.pricePerPlate || 0).toLocaleString('en-IN')}`} />
                    <Row label="Base / venue" value={`${currencySym()}${(p.basePrice || 0).toLocaleString('en-IN')}`} />
                    <Row label="Decor" value={`${p.decorationType} · ${currencySym()}${(p.decorationCost || 0).toLocaleString('en-IN')}`} />
                    {p.hallId?.name && <Row label="Hall" value={p.hallId.name} />}
                  </Stack>
                  {(p.inclusions || []).length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      {p.inclusions.slice(0, 4).map((inc, i) => (
                        <Typography key={i} variant="caption" display="block" color="text.secondary">• {inc}</Typography>
                      ))}
                    </Box>
                  )}
                  <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ mt: 1 }}>
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
        icon={<Inventory2OutlinedIcon />}
        eyebrow="Banquet"
        title={editing ? 'Edit package' : 'New package'}
        submitDisabled={saving}
        submitLabel={saving ? 'Saving…' : (editing ? 'Save changes' : 'Create package')}
      >
        <FormSection title="Package Details" icon={<Inventory2OutlinedIcon fontSize="small" />} iconColor="#8b5cf6">
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}><TextField fullWidth label="Package name" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} multiline rows={2} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Applicable event types" SelectProps={{ multiple: true, renderValue: (v) => v.join(', ') }}
                value={form.eventTypes} onChange={(e) => set('eventTypes', e.target.value)}>
                {EVENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Default hall (optional)" value={form.hallId} onChange={(e) => set('hallId', e.target.value)}>
                <MenuItem value="">— None —</MenuItem>
                {halls.map((h) => <MenuItem key={h._id} value={h._id}>{h.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={4}><TextField fullWidth type="number" label={`Per plate ${currencySym()}`} value={form.pricePerPlate} onChange={(e) => set('pricePerPlate', e.target.value)} /></Grid>
            <Grid item xs={6} sm={4}><TextField fullWidth type="number" label={`Base / venue ${currencySym()}`} value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} /></Grid>
            <Grid item xs={6} sm={4}><TextField fullWidth type="number" label={`Decor cost ${currencySym()}`} value={form.decorationCost} onChange={(e) => set('decorationCost', e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Decoration type" value={form.decorationType} onChange={(e) => set('decorationType', e.target.value)}>
                {DECOR.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Status" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => set('isActive', e.target.value === 'active')}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Inclusions (one per line)" multiline rows={3}
                value={Array.isArray(form.inclusions) ? form.inclusions.join('\n') : form.inclusions}
                onChange={(e) => set('inclusions', e.target.value.split('\n'))}
                placeholder={'Welcome drinks\nStage decoration\nDJ & lighting'} />
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>
    </Box>
  );
};

const Row = ({ label, value }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" fontWeight={700}>{value}</Typography>
  </Stack>
);

export default EventPackagesManager;
