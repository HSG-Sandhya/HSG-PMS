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
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  AdminPanelSettings as ShieldIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from '../../forms/formStyles';

const ACCENT = 'var(--app-primary)';

const emptyForm = {
  name: '',
  description: '',
  hierarchy: 5,
  permissions: new Set(),
};

const levelColor = (level) => {
  if (level >= 9) return '#ef4444';
  if (level >= 6) return '#f59e0b';
  if (level >= 3) return ACCENT;
  return '#10b981';
};

const RoleCard = ({ role, onEdit, onDelete, isDarkMode }) => {
  const level = role.hierarchy ?? 0;
  const permCount = (role.permissions || []).length;
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
        '&:hover .role-actions': { opacity: 1 },
      }}
    >
      <Stack
        className="role-actions"
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 12, right: 12, opacity: { xs: 1, md: 0 }, transition: 'opacity .2s ease' }}
      >
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(role)} sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.08)', color: ACCENT }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(role)} sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pr: 7, mb: 1 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))', color: ACCENT,
          }}
        >
          <ShieldIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.15 }}>
          {role.name}
        </Typography>
      </Stack>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minHeight: 40, mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {role.description || 'No description'}
      </Typography>

      <Divider sx={{ mb: 1.5, opacity: isDarkMode ? 0.2 : 0.6 }} />

      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={`Level ${level}`}
          size="small"
          sx={{
            borderRadius: 999,
            fontWeight: 700,
            color: '#fff',
            bgcolor: levelColor(level),
          }}
        />
        <Chip
          icon={<KeyIcon sx={{ fontSize: 14 }} />}
          label={`${permCount} ${permCount === 1 ? 'permission' : 'permissions'}`}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 999 }}
        />
      </Stack>
    </Box>
  );
};

const RolesSection = ({ onNotify }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [roles, setRoles] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const { data } = await api.admin.getRoles();
      const list = Array.isArray(data) ? data : data?.data || [];
      setRoles(list);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load roles', 'error');
    }
  }, [onNotify]);

  const loadPermissions = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/permissions');
      const groups = data?.data || data || [];
      setPermissionGroups(Array.isArray(groups) ? groups : []);
    } catch (_err) {
      setPermissionGroups([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadRoles(), loadPermissions()]);
      setLoading(false);
    })();
  }, [loadRoles, loadPermissions]);

  const totalPermissions = permissionGroups.reduce((n, g) => n + g.permissions.length, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, permissions: new Set() });
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      name: role.name || '',
      description: role.description || '',
      hierarchy: role.hierarchy ?? 5,
      permissions: new Set(Array.isArray(role.permissions) ? role.permissions : []),
    });
    setDialogOpen(true);
  };

  const togglePermission = (perm) => {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...prev, permissions: next };
    });
  };

  const toggleGroup = (group) => {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      const allSelected = group.permissions.every((p) => next.has(p));
      group.permissions.forEach((p) => {
        if (allSelected) next.delete(p);
        else next.add(p);
      });
      return { ...prev, permissions: next };
    });
  };

  const selectAll = () => {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      const all = permissionGroups.flatMap((g) => g.permissions);
      const everySelected = all.every((p) => next.has(p));
      return { ...prev, permissions: everySelected ? new Set() : new Set(all) };
    });
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
        hierarchy: Number(form.hierarchy) || 1,
        permissions: Array.from(form.permissions),
      };
      if (editing) {
        await api.admin.updateRole(editing._id || editing.id, payload);
        onNotify?.('Role updated', 'success');
      } else {
        await api.admin.createRole(payload);
        onNotify?.('Role created', 'success');
      }
      setDialogOpen(false);
      await loadRoles();
      broadcastSettingsChange('roles');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await api.admin.deleteRole(role._id || role.id);
      onNotify?.('Role deleted', 'success');
      await loadRoles();
      broadcastSettingsChange('roles');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <Box>
      {/* Toolbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ShieldIcon sx={{ color: ACCENT }} />
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading…' : `${roles.length} ${roles.length === 1 ? 'role' : 'roles'} · hierarchy ranks access (10 = highest)`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload">
            <IconButton onClick={() => Promise.all([loadRoles(), loadPermissions()])} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add role
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : roles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <ShieldIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>No roles yet.</Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add your first role
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {roles.map((role) => (
            <Grid item xs={12} sm={6} lg={4} key={role._id || role.id}>
              <RoleCard role={role} onEdit={openEdit} onDelete={handleDelete} isDarkMode={isDarkMode} />
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: dialogPaperSx(isDarkMode) }}
        BackdropProps={{ sx: dialogBackdropSx }}
      >
        <Box sx={headerWrapSx(isDarkMode)}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))', color: ACCENT,
              }}
            >
              <ShieldIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                Role
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, mt: 0.25 }}>
                {editing ? 'Edit role' : 'New role'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
              <TextField
                label="Hierarchy"
                type="number"
                inputProps={{ min: 1, max: 10 }}
                value={form.hierarchy}
                onChange={(e) => setForm({ ...form, hierarchy: e.target.value })}
                sx={{ width: { xs: '100%', sm: 160 } }}
                helperText="1–10 (10 = highest)"
              />
            </Stack>
            <TextField label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth />

            <Divider textAlign="left">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Permissions ({form.permissions.size}{totalPermissions ? ` / ${totalPermissions}` : ''} selected)
                </Typography>
                {permissionGroups.length > 0 && (
                  <Button size="small" onClick={selectAll} sx={{ textTransform: 'none', minWidth: 0, p: 0, color: ACCENT }}>
                    {permissionGroups.flatMap((g) => g.permissions).every((p) => form.permissions.has(p)) ? 'Clear all' : 'Select all'}
                  </Button>
                )}
              </Stack>
            </Divider>

            {permissionGroups.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                  Permission catalog unavailable. Restart the server and reload.
                </Typography>
              </Box>
            ) : (
              <Box>
                {permissionGroups.map((group) => {
                  const allSelected = group.permissions.every((p) => form.permissions.has(p));
                  const someSelected = group.permissions.some((p) => form.permissions.has(p));
                  const selectedCount = group.permissions.filter((p) => form.permissions.has(p)).length;
                  return (
                    <Accordion
                      key={group.name}
                      disableGutters
                      elevation={0}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        border: '1px solid',
                        borderColor: someSelected ? 'rgba(var(--app-primary-rgb),0.4)' : 'divider',
                        '&:before': { display: 'none' },
                        backgroundColor: isDarkMode ? 'rgba(30,41,59,0.4)' : 'rgba(248,250,252,0.6)',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandIcon />}>
                        <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                          <Checkbox
                            checked={allSelected}
                            indeterminate={!allSelected && someSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleGroup(group)}
                            sx={{ p: 0.5 }}
                          />
                          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 700 }}>
                            {group.name}
                          </Typography>
                          <Chip
                            label={`${selectedCount}/${group.permissions.length}`}
                            size="small"
                            variant={selectedCount > 0 ? 'filled' : 'outlined'}
                            color={selectedCount > 0 ? 'primary' : 'default'}
                            sx={{ ml: 'auto', borderRadius: 999, fontWeight: 600 }}
                          />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                          {group.permissions.map((perm) => (
                            <FormControlLabel
                              key={perm}
                              control={
                                <Checkbox
                                  checked={form.permissions.has(perm)}
                                  onChange={() => togglePermission(perm)}
                                  size="small"
                                />
                              }
                              label={<Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{perm.replace(/_/g, ' ')}</Typography>}
                            />
                          ))}
                        </FormGroup>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={actionsBarSx(isDarkMode)}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} variant="outlined" sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={primaryButtonSx}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolesSection;
