import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Button,
  IconButton,
  Chip,
  Stack,
  Typography,
  CircularProgress,
  Tooltip,
  Divider,
  Avatar,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Badge as BadgeIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as DeptIcon,
  Person as PersonIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircleOutlined as CheckCircleOutlineIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';
import StaffDialog from '../../StaffDialog';
import FormDialog from '../../forms/FormDialog';
import { primaryButtonSx } from '../../forms/formStyles';

const ACCENT = 'var(--app-primary)';

const initials = (s) => `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase();
// Profile photo can live in a few places depending on how the record was created.
const photoOf = (s) => s.avatar || s.photo || s.photoUrl || s.profile?.avatar || s.profile?.photo || '';

const StaffCard = ({ member, onEdit, onDelete, onResetPassword, isDarkMode }) => {
  const active = member.isActive !== false;
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 3,
        p: 2.5,
        opacity: active ? 1 : 0.7,
        backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: ACCENT,
          boxShadow: isDarkMode ? '0 16px 36px -18px rgba(0,0,0,0.7)' : '0 16px 36px -18px rgba(var(--app-primary-rgb),0.45)',
        },
        '&:hover .staff-actions': { opacity: 1 },
      }}
    >
      <Stack
        className="staff-actions"
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 12, right: 12, opacity: { xs: 1, md: 0 }, transition: 'opacity .2s ease' }}
      >
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(member)} sx={{ bgcolor: 'rgba(var(--app-primary-rgb),0.08)', color: ACCENT }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset login password">
          <IconButton size="small" onClick={() => onResetPassword(member)} sx={{ bgcolor: 'rgba(14,165,233,0.10)', color: '#0ea5e9' }}>
            <VpnKeyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(member)} sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
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
          mb: 1.5
        }}>
        <Avatar
          src={photoOf(member) || undefined}
          alt={`${member.firstName || ''} ${member.lastName || ''}`.trim()}
          sx={{
            width: 48,
            height: 48,
            fontWeight: 700,
            // Force the text colour — the app's palette sets background.default to
            // 'transparent', which MUI otherwise uses as the Avatar text colour
            // (making initials invisible).
            color: '#fff',
            background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #EC4899))',
          }}
        >
          {initials(member) || <PersonIcon />}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              fontWeight: 700,
              lineHeight: 1.15
            }}>
            {member.firstName} {member.lastName}
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            ID: {member.profile?.employeeId || '—'}
          </Typography>
        </Box>
      </Stack>
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        sx={{
          flexWrap: "wrap",
          mb: 1.5
        }}>
        {/* Role = what the user can DO (carries permissions). */}
        <Tooltip title="Role — controls access / permissions">
          <Chip
            icon={<BadgeIcon sx={{ fontSize: 15 }} />}
            label={member.role?.name || 'No role'}
            size="small"
            sx={{ borderRadius: 999 }}
          />
        </Tooltip>
        {/* Department = which team they belong to (organisational only). Hidden
            when it duplicates the role name, to avoid the look of redundancy. */}
        {member.department?.name && member.department.name !== member.role?.name && (
          <Tooltip title="Department — organisational team (no access rights)">
            <Chip
              icon={<DeptIcon sx={{ fontSize: 15 }} />}
              label={member.department.name}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 999 }}
            />
          </Tooltip>
        )}
        <Chip
          label={active ? 'Active' : 'Inactive'}
          size="small"
          color={active ? 'success' : 'default'}
          sx={{ borderRadius: 999 }}
        />
      </Stack>
      <Divider sx={{ mb: 1.5, opacity: isDarkMode ? 0.2 : 0.6 }} />
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          <EmailIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          <Typography variant="body2" noWrap sx={{
            color: "text.secondary"
          }}>{member.email || '—'}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          <PhoneIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{member.phone || '—'}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

const StaffSection = ({ onNotify }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null);
  // light/dark inferred from body — settings sections render inside the themed app
  const isDarkMode = typeof document !== 'undefined'
    && document.body?.dataset?.theme === 'dark';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff');
      const list = res.data?.data?.docs || res.data?.data || [];
      setStaff(Array.isArray(list) ? list : []);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load staff', 'error');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingStaff(null);
    setDialogOpen(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    setDialogOpen(true);
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Delete staff member "${member.firstName} ${member.lastName}"?`)) return;
    try {
      await api.admin.deleteStaff(member._id);
      onNotify?.('Staff member deleted', 'success');
      await load();
      broadcastSettingsChange('staff');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const handleSuccess = async (data) => {
    const wasEditing = !!editingStaff;
    setDialogOpen(false);
    setEditingStaff(null);
    onNotify?.(wasEditing ? 'Staff updated' : 'Staff created', 'success');
    await load();
    broadcastSettingsChange('staff');
    // On creation the server returns the auto-generated login. Surface it now —
    // the password is hashed in the database and cannot be retrieved later.
    const creds = data?.credentials;
    if (!wasEditing && creds?.username && creds?.password) {
      setCreatedCreds({
        name: data?.user?.fullName || `${data?.user?.firstName || ''} ${data?.user?.lastName || ''}`.trim(),
        username: creds.username,
        password: creds.password,
      });
    }
  };

  const handleResetPassword = async (member) => {
    if (!window.confirm(`Generate a new login password for "${member.firstName} ${member.lastName}"? Their old password will stop working.`)) return;
    try {
      const res = await api.admin.resetStaffPassword(member._id, { generatePassword: true });
      const d = res.data?.data;
      if (d?.newPassword) {
        setCreatedCreds({
          name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
          username: d.username || member.username,
          password: d.newPassword,
          reset: true,
        });
      } else {
        onNotify?.('Password reset, but no password was returned', 'warning');
      }
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Password reset failed', 'error');
    }
  };

  const copyText = async (text, msg = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.(msg, 'success');
    } catch {
      onNotify?.('Could not copy automatically — please copy manually', 'warning');
    }
  };

  const credsBlock = createdCreds
    ? `Hotel Sandhya Grand — Staff Login\nURL: ${window.location.origin}/login\nUsername: ${createdCreds.username}\nPassword: ${createdCreds.password}\n(Please change your password after first login.)`
    : '';

  const filtered = staff.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.role?.name?.toLowerCase().includes(q) ||
      m.department?.name?.toLowerCase().includes(q) ||
      m.profile?.employeeId?.toLowerCase().includes(q)
    );
  });

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
          <BadgeIcon sx={{ color: ACCENT }} />
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {loading ? 'Loading…' : `${staff.length} ${staff.length === 1 ? 'staff member' : 'staff members'}`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload">
            <IconButton onClick={load} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
            Add staff
          </Button>
        </Stack>
      </Stack>
      <TextField
        fullWidth
        size="small"
        placeholder="Search staff by name, ID, email, role, department…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }
        }}
      />
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            py: 8
          }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
          <BadgeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            {staff.length === 0 ? 'No staff members yet.' : 'No staff match your search.'}
          </Typography>
          {staff.length === 0 && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={primaryButtonSx}>
              Add your first staff member
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((member) => (
            <Grid
              key={member._id}
              size={{
                xs: 12,
                sm: 6,
                lg: 4
              }}>
              <StaffCard member={member} onEdit={openEdit} onDelete={handleDelete} onResetPassword={handleResetPassword} isDarkMode={isDarkMode} />
            </Grid>
          ))}
        </Grid>
      )}
      <StaffDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingStaff(null); }}
        onSuccess={handleSuccess}
        editingStaff={editingStaff}
      />
      {/* Show the auto-generated login once, right after creation. */}
      <FormDialog
        open={!!createdCreds}
        onClose={() => setCreatedCreds(null)}
        maxWidth="xs"
        icon={<CheckCircleOutlineIcon />}
        eyebrow={createdCreds?.reset ? 'Password reset' : 'Staff login created'}
        title="Share these credentials"
        submitLabel="Done"
        hideCancel
        extraActions={
          <Button startIcon={<ContentCopyIcon />} onClick={() => copyText(credsBlock, 'Credentials copied')} sx={{ mr: 'auto', textTransform: 'none', fontWeight: 700 }}>
            Copy all
          </Button>
        }
      >
        {createdCreds && (
          <Stack spacing={2}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Login for <strong>{createdCreds.name || createdCreds.username}</strong> is ready. This password is shown only once — copy it now.
            </Alert>
            <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              {[['Username', createdCreds.username], ['Password', createdCreds.password]].map(([k, v]) => (
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
              Hand these to the person — they sign in at <strong>/login</strong>. If lost, you can reset the password from the staff card later.
            </Typography>
          </Stack>
        )}
      </FormDialog>
    </Box>
  );
};

export default StaffSection;
