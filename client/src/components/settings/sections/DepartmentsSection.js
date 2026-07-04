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
  Switch,
  Tooltip,
  Divider,
  InputAdornment,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Groups as DeptIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';
import { currencySym } from '../../../utils/billing';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from '../../forms/formStyles';

const ACCENT = 'var(--app-primary)';

// <input type="color"> only accepts a literal #rrggbb — never a CSS var. Coerce
// anything else (a stale 'var(--app-primary)', empty, etc.) to a safe hex so the
// swatch never trips the "does not conform to #rrggbb" DOM warning.
const DEFAULT_DEPT_COLOR = '#6366F1';
const toHexColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_DEPT_COLOR);

const emptyForm = {
  name: '',
  description: '',
  color: DEFAULT_DEPT_COLOR,
  budget: 0,
  isActive: true,
};

const DepartmentCard = ({ dept, onEdit, onDelete, onToggle, isDarkMode }) => {
  const color = dept.color || '#6B7280';
  const active = dept.isActive !== false;
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 3,
        p: 2.5,
        opacity: active ? 1 : 0.7,
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
        '&:hover .dept-actions': { opacity: 1 },
      }}
    >
      {/* Color accent bar */}
      <Box sx={{ position: 'absolute', top: 0, left: 16, right: 16, height: 3, borderRadius: 2, background: color }} />
      <Stack
        className="dept-actions"
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 12, right: 12, opacity: { xs: 1, md: 0 }, transition: 'opacity .2s ease' }}
      >
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(dept)} sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.08)', color: ACCENT }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(dept)} sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
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
          mb: 1,
          mt: 0.5
        }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}22`, color,
          }}
        >
          <DeptIcon fontSize="small" />
        </Box>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            lineHeight: 1.15
          }}>
          {dept.name}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          minHeight: 40,
          mb: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
        {dept.description || 'No description'}
      </Typography>
      <Divider sx={{ mb: 1.5, opacity: isDarkMode ? 0.2 : 0.6 }} />
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between"
        }}>
        <Stack direction="row" spacing={0.75}>
          <Chip
            icon={<PeopleIcon sx={{ fontSize: 15 }} />}
            label={`${dept.staffCount ?? 0} staff`}
            size="small"
            sx={{ borderRadius: 999 }}
          />
          {Number(dept.budget) > 0 && (
            <Chip
              label={`${currencySym()}${Number(dept.budget).toLocaleString('en-IN')}`}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 999 }}
            />
          )}
        </Stack>
        <Tooltip title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
          <Switch size="small" checked={active} onChange={() => onToggle(dept)} />
        </Tooltip>
      </Stack>
    </Box>
  );
};

const DepartmentsSection = ({ onNotify }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.departments.getAll();
      const list = Array.isArray(data) ? data : data?.data || [];
      setDepartments(list);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load departments', 'error');
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

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({
      name: dept.name || '',
      description: dept.description || '',
      color: dept.color || 'var(--app-primary)',
      budget: dept.budget || 0,
      isActive: dept.isActive !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      onNotify?.('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        budget: Number(form.budget) || 0,
        isActive: form.isActive,
      };
      if (editing) {
        await api.departments.update(editing._id, payload);
        onNotify?.('Department updated', 'success');
      } else {
        await api.departments.create(payload);
        onNotify?.('Department created', 'success');
      }
      setDialogOpen(false);
      await load();
      broadcastSettingsChange('departments');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (dept) => {
    try {
      await api.departments.toggleStatus(dept._id);
      await load();
      broadcastSettingsChange('departments');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Status toggle failed', 'error');
    }
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete the "${dept.name}" department?`)) return;
    try {
      await api.departments.delete(dept._id);
      onNotify?.('Department deleted', 'success');
      await load();
      broadcastSettingsChange('departments');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <Box>
      {/* Toolbar */}
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
          <DeptIcon sx={{ color: ACCENT }} />
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {loading ? 'Loading…' : `${departments.length} ${departments.length === 1 ? 'department' : 'departments'} · organisational units staff belong to`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload">
            <IconButton onClick={load} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add department
          </Button>
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
      ) : departments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <DeptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography
            sx={{
              color: "text.secondary",
              mb: 2
            }}>No departments yet.</Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add your first department
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {departments.map((dept) => (
            <Grid
              key={dept._id}
              size={{
                xs: 12,
                sm: 6,
                lg: 4
              }}>
              <DepartmentCard
                dept={dept}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggle={handleToggleStatus}
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
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={1.5} sx={{
            alignItems: "center"
          }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${form.color}22`, color: form.color,
              }}
            >
              <DeptIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                Department
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, mt: 0.25 }}>
                {editing ? 'Edit department' : 'New department'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
          <Stack spacing={2.5}>
            <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{
              alignItems: { sm: 'center' }
            }}>
              <TextField
                label="Colour"
                type="color"
                value={toHexColor(form.color)}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                sx={{ width: { xs: '100%', sm: 120 }, '& input': { height: 40, cursor: 'pointer' } }}
              />
              <TextField
                label="Monthly budget"
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                fullWidth
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
                }}
              />
            </Stack>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 2,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider'
              }}>
              <Box>
                <Typography variant="body2" sx={{
                  fontWeight: 600
                }}>Active</Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  Inactive departments stay on record but are hidden from assignment.
                </Typography>
              </Box>
              <Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={primaryButtonSx}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentsSection;
