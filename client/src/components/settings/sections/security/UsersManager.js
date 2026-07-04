import { useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, IconButton, Tooltip, CircularProgress, TextField,
  Table, TableHead, TableRow, TableCell, TableBody,
  MenuItem, Divider, Switch, FormControlLabel, Button, InputAdornment, Alert, Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import FormDialog, { FormSection } from '../../../forms/FormDialog';
import api from '../../../../api';

const cardSx = {
  p: { xs: 2, md: 2.5 }, borderRadius: 3,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)', WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

const unwrap = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.users)) return d.users;
  if (Array.isArray(d?.departments)) return d.departments;
  return [];
};

const idOf = (x) => x?._id || x?.id || '';

// Readable but strong auto-password: Word + @ + 3 digits (has upper, symbol, digit).
const PWORDS = ['Sandhya', 'Grand', 'Lobby', 'Suite', 'Garden', 'Royal', 'Pearl', 'Lotus', 'Orchid', 'Marigold'];
const genPassword = () =>
  `${PWORDS[Math.floor(Math.random() * PWORDS.length)]}@${Math.floor(100 + Math.random() * 900)}`;

const suggestUsername = (first, last) =>
  `${(first || '').trim()}${last ? '.' + last.trim() : ''}`.toLowerCase().replace(/[^a-z0-9.]/g, '');

const emptyCreate = {
  firstName: '', lastName: '', email: '', phone: '',
  username: '', password: '', role: '', department: '', isActive: true,
};

const UsersManager = ({ onNotify }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit existing user
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ role: '', isActive: true });
  const [saving, setSaving] = useState(false);

  // Create new login
  const [creating, setCreating] = useState(false);
  const [cForm, setCForm] = useState(emptyCreate);
  const [cUserTouched, setCUserTouched] = useState(false);
  const [cSaving, setCSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(true);

  // Credential handover (shown after a login is created)
  const [handover, setHandover] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r, d] = await Promise.all([
        api.userManagement.getAllUsers(),
        api.admin.getRoles(),
        api.departments.getAll(),
      ]);
      setUsers(unwrap(u));
      setRoles(unwrap(r));
      setDepartments(unwrap(d));
    } catch (e) {
      onNotify?.('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const roleName = (role) => (typeof role === 'object' ? role?.name : roles.find((r) => idOf(r) === role)?.name) || '—';

  const copyText = async (text, msg = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.(msg, 'success');
    } catch {
      onNotify?.('Could not copy automatically — please copy manually', 'warning');
    }
  };

  // ---- Edit existing user ----
  const openEdit = (u) => {
    setEditing(u);
    setForm({ role: (typeof u.role === 'object' ? idOf(u.role) : u.role) || '', isActive: u.isActive !== false });
    setSaving(false);
  };

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const id = idOf(editing);
      await api.userManagement.updateUser(id, { role: form.role });
      if (form.isActive !== (editing.isActive !== false)) {
        if (form.isActive) await api.userManagement.activateUser(id);
        else await api.userManagement.deactivateUser(id);
      }
      onNotify?.('User updated', 'success');
      setEditing(null);
      load();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    const id = idOf(u);
    const active = u.isActive !== false;
    try {
      if (active) await api.userManagement.deactivateUser(id);
      else await api.userManagement.activateUser(id);
      onNotify?.(active ? 'User deactivated' : 'User activated', 'info');
      load();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Action failed', 'error');
    }
  };

  // Permanently remove a login credential. Distinct from deactivate (which is
  // reversible) — this deletes the account so they can never sign in again.
  const deleteLogin = async (u) => {
    const label = u.username || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
    if (!window.confirm(`Permanently delete the login "${label}"? They will no longer be able to sign in. This cannot be undone.`)) return;
    try {
      await api.userManagement.deleteUser(idOf(u));
      onNotify?.('Login credential deleted', 'success');
      load();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Delete failed', 'error');
    }
  };

  // ---- Create new login ----
  const openCreate = () => {
    const defRole = roles.find((r) => r.name === 'Front Office') || roles[0];
    const defDept = departments.find((d) => d.name === 'Front Office') || departments[0];
    setCForm({ ...emptyCreate, password: genPassword(), role: idOf(defRole), department: idOf(defDept) });
    setCUserTouched(false);
    setShowPwd(true);
    setCSaving(false);
    setCreating(true);
  };

  const setC = (patch) => setCForm((f) => ({ ...f, ...patch }));

  const onNameChange = (key, value) => {
    setCForm((f) => {
      const next = { ...f, [key]: value };
      if (!cUserTouched) {
        next.username = suggestUsername(key === 'firstName' ? value : f.firstName, key === 'lastName' ? value : f.lastName);
      }
      return next;
    });
  };

  const createValidationError = () => {
    const f = cForm;
    if (!f.firstName.trim() || !f.lastName.trim()) return 'First and last name are required.';
    if (!f.username.trim()) return 'Username is required.';
    if (!f.password || f.password.length < 6) return 'Password must be at least 6 characters.';
    if (!/^\d{10}$/.test(f.phone.trim())) return 'Phone must be exactly 10 digits.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'A valid email is required.';
    if (!f.role) return 'Please choose a role.';
    if (!f.department) return 'Please choose a department.';
    return null;
  };

  const handleCreate = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const err = createValidationError();
    if (err) { onNotify?.(err, 'warning'); return; }
    setCSaving(true);
    try {
      await api.userManagement.createUser({
        firstName: cForm.firstName.trim(),
        lastName: cForm.lastName.trim(),
        username: cForm.username.trim(),
        email: cForm.email.trim(),
        phone: cForm.phone.trim(),
        password: cForm.password,
        role: cForm.role,
        department: cForm.department,
        isActive: cForm.isActive,
      });
      const creds = {
        name: `${cForm.firstName} ${cForm.lastName}`.trim(),
        roleName: roles.find((r) => idOf(r) === cForm.role)?.name || '',
        username: cForm.username.trim(),
        password: cForm.password,
        active: cForm.isActive,
      };
      setCreating(false);
      setHandover(creds);
      load();
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Could not create login', 'error');
    } finally {
      setCSaving(false);
    }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return [u.username, u.email, u.firstName, u.lastName, roleName(u.role)]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
  });

  const editingPerms = editing
    ? (roles.find((r) => idOf(r) === form.role)?.permissions || [])
    : [];
  const createPerms = roles.find((r) => idOf(r) === cForm.role)?.permissions || [];

  const handoverBlock = handover
    ? `Hotel Sandhya Grand — Staff Login\nURL: ${window.location.origin}/login\nUsername: ${handover.username}\nPassword: ${handover.password}\n(Please change your password after first login.)`
    : '';

  return (
    <Box sx={cardSx}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: 'center' },
          mb: 2
        }}>
        <Box>
          <Typography variant="h6" sx={{
            fontWeight: 800
          }}>Staff Logins</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>Create logins, assign roles, and enable/disable accounts</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          <TextField size="small" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
          <Button
            variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={openCreate}
            sx={{
              borderRadius: '999px', px: 2.5, fontWeight: 700, whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary, #8B5CF6) 100%)',
              '&:hover': { background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' },
            }}
          >
            Add login
          </Button>
        </Stack>
      </Stack>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>No users found.</Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u) => {
                const active = u.isActive !== false;
                const perms = (typeof u.role === 'object' ? u.role?.permissions : null) || u.permissions || [];
                return (
                  <TableRow key={idOf(u)} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                      }}>
                        <PersonIcon fontSize="small" sx={{ color: 'var(--app-primary)' }} />
                        <Box>
                          <Typography
                            component="div"
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username}
                            {u.isSystemAdmin && <Chip label="System admin" size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                          </Typography>
                          <Typography variant="caption" sx={{
                            color: "text.secondary"
                          }}>@{u.username}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Chip size="small" label={roleName(u.role)} sx={{ height: 22, bgcolor: 'rgba(var(--app-primary-rgb),0.12)', color: 'var(--app-primary)', fontWeight: 700 }} /></TableCell>
                    <TableCell>{perms.length}</TableCell>
                    <TableCell>
                      <Chip size="small" label={active ? 'Active' : 'Disabled'}
                        sx={{ height: 22, fontWeight: 700, color: '#fff', bgcolor: active ? '#10B981' : '#9CA3AF' }} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit role"><IconButton size="small" onClick={() => openEdit(u)} sx={{ color: 'var(--app-primary)' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      {!u.isSystemAdmin && (
                        <Tooltip title={active ? 'Deactivate' : 'Activate'}>
                          <IconButton size="small" onClick={() => toggleActive(u)} sx={{ color: active ? '#ef4444' : '#10B981' }}>
                            {active ? <BlockIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {!u.isSystemAdmin && (
                        <Tooltip title="Delete login">
                          <IconButton size="small" onClick={() => deleteLogin(u)} sx={{ color: '#ef4444' }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {/* ---- Create login dialog ---- */}
      <FormDialog
        open={creating}
        onClose={cSaving ? undefined : () => setCreating(false)}
        onSubmit={handleCreate}
        formId="create-login-form"
        maxWidth="sm"
        icon={<PersonAddAlt1Icon />}
        eyebrow="Security"
        title="Create a staff login"
        submitDisabled={cSaving}
        submitLabel={cSaving ? 'Creating…' : 'Create login'}
      >
        <FormSection title="Person" icon={<PersonIcon fontSize="small" />} iconColor="#6366f1">
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="First name" value={cForm.firstName} onChange={(e) => onNameChange('firstName', e.target.value)} required />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Last name" value={cForm.lastName} onChange={(e) => onNameChange('lastName', e.target.value)} required />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Phone (10 digits)" value={cForm.phone}
                onChange={(e) => setC({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Email" type="email" value={cForm.email} onChange={(e) => setC({ email: e.target.value })} required />
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Credentials" icon={<VpnKeyIcon fontSize="small" />} iconColor="#0ea5e9">
          <Stack spacing={2}>
            <TextField
              fullWidth label="Username" value={cForm.username}
              onChange={(e) => { setCUserTouched(true); setC({ username: e.target.value.trim() }); }}
              helperText="What they type to sign in." required
            />
            <TextField
              fullWidth label="Password" type={showPwd ? 'text' : 'password'} value={cForm.password}
              onChange={(e) => setC({ password: e.target.value })} required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showPwd ? 'Hide' : 'Show'}>
                        <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end">
                          {showPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Generate new password">
                        <IconButton size="small" onClick={() => setC({ password: genPassword() })}><AutorenewIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Copy password">
                        <IconButton size="small" onClick={() => copyText(cForm.password, 'Password copied')}><ContentCopyIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Stack>
        </FormSection>

        <FormSection title="Access" icon={<VpnKeyIcon fontSize="small" />} iconColor="#10b981">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField select fullWidth label="Role" value={cForm.role} onChange={(e) => setC({ role: e.target.value })} required>
                  {roles.map((r) => <MenuItem key={idOf(r)} value={idOf(r)}>{r.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <TextField select fullWidth label="Department" value={cForm.department} onChange={(e) => setC({ department: e.target.value })} required>
                  {departments.map((d) => <MenuItem key={idOf(d)} value={idOf(d)}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
            {cForm.role && (
              <Box>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>This role can access ({createPerms.length}):</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, maxHeight: 120, overflowY: 'auto' }}>
                  {createPerms.length === 0
                    ? <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>Full access (administrator).</Typography>
                    : createPerms.map((p) => <Chip key={p} size="small" label={p.replace(/_/g, ' ').replace(/^manage |^view /, '')} sx={{ textTransform: 'capitalize' }} />)}
                </Box>
              </Box>
            )}
            <FormControlLabel
              control={<Switch checked={cForm.isActive} onChange={(e) => setC({ isActive: e.target.checked })} />}
              label={cForm.isActive ? 'Account active (can log in now)' : 'Account disabled'}
            />
          </Stack>
        </FormSection>
      </FormDialog>
      {/* ---- Credential handover dialog ---- */}
      <FormDialog
        open={!!handover}
        onClose={() => setHandover(null)}
        maxWidth="xs"
        icon={<CheckCircleOutlineIcon />}
        eyebrow="Login created"
        title="Share these credentials"
        submitLabel="Done"
        hideCancel
        extraActions={
          <Button startIcon={<ContentCopyIcon />} onClick={() => copyText(handoverBlock, 'Credentials copied')} sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>
            Copy all
          </Button>
        }
      >
        {handover && (
          <Stack spacing={2}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Login for <strong>{handover.name || handover.username}</strong>
              {handover.roleName ? <> · {handover.roleName}</> : null} is ready.
            </Alert>
            <Box sx={{ ...cardSx, p: 2 }}>
              {[['Username', handover.username], ['Password', handover.password]].map(([k, v]) => (
                <Stack
                  key={k}
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.75
                  }}>
                  <Box>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>{k}</Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 700,
                        fontFamily: 'monospace'
                      }}>{v}</Typography>
                  </Box>
                  <Tooltip title={`Copy ${k.toLowerCase()}`}>
                    <IconButton size="small" onClick={() => copyText(v, `${k} copied`)}><ContentCopyIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Box>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Hand these to the person. They sign in at <strong>/login</strong>. Ask them to change the password after first use. {!handover.active && 'Note: this account is currently disabled — activate it before they sign in.'}
            </Typography>
          </Stack>
        )}
      </FormDialog>
      {/* ---- Edit user dialog ---- */}
      <FormDialog
        open={!!editing}
        onClose={saving ? undefined : () => setEditing(null)}
        onSubmit={handleSave}
        formId="edit-user-form"
        maxWidth="sm"
        icon={<PersonIcon />}
        eyebrow="Security"
        title="Edit user access"
        submitDisabled={saving}
        submitLabel={saving ? 'Saving…' : 'Save'}
      >
        {editing && (
          <FormSection title="Role & Access" icon={<PersonIcon fontSize="small" />} iconColor="#6366f1">
            <Stack spacing={2}>
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                {[editing.firstName, editing.lastName].filter(Boolean).join(' ') || editing.username} · {editing.email}
              </Typography>
              <TextField select fullWidth label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {roles.map((r) => <MenuItem key={idOf(r)} value={idOf(r)}>{r.name}</MenuItem>)}
              </TextField>
              <FormControlLabel
                control={<Switch checked={form.isActive} disabled={editing.isSystemAdmin}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
                label={form.isActive ? 'Account active' : 'Account disabled'}
              />
              <Divider textAlign="left"><Typography variant="caption" sx={{
                color: "text.secondary"
              }}>Permissions granted by this role ({editingPerms.length})</Typography></Divider>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 160, overflowY: 'auto' }}>
                {editingPerms.length === 0
                  ? <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>No permissions on this role.</Typography>
                  : editingPerms.map((p) => <Chip key={p} size="small" label={p.replace(/_/g, ' ')} sx={{ textTransform: 'capitalize' }} />)}
              </Box>
            </Stack>
          </FormSection>
        )}
      </FormDialog>
    </Box>
  );
};

export default UsersManager;
