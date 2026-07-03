import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
  Tooltip,
  Divider,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Visibility as ViewIcon,
  CloudSync as CloudSyncIcon,
  Room as RoomIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Bolt as BoltIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';
import api from '../../api';
import {
  CHANNEL_TYPES,
  GLASS,
  typeLabel,
  statusMeta,
  channelColor,
  channelInitials,
  formatDate,
  inr,
} from './channels/channelHelpers';
import ChannelFormDialog from './channels/ChannelFormDialog';
import { ChannelDetailsDialog, RoomMappingDialog, RateCalculatorDialog } from './channels/ChannelDialogs';

// ===========================================================================
// Main component
// ===========================================================================
const ChannelManager = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [detailsChannel, setDetailsChannel] = useState(null);
  const [mappingChannel, setMappingChannel] = useState(null);
  const [rateChannel, setRateChannel] = useState(null);

  // per-channel state
  const [syncLoading, setSyncLoading] = useState({});
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [channelStats, setChannelStats] = useState({});
  const [availableRooms, setAvailableRooms] = useState([]);

  // toolbar
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // row action menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuChannel, setMenuChannel] = useState(null);

  const abortRef = useRef(null);

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const fetchChannels = async () => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await api.channels.getAll();
      setChannels(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      if (error.name !== 'AbortError') notify('Error fetching channels', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const res = await api.channels.getAvailableRooms();
      setAvailableRooms(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* non-blocking */
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchAvailableRooms();
    return () => abortRef.current && abortRef.current.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- CRUD --------------------------------------------------------------
  const handleSaveChannel = async (id, data) => {
    try {
      if (id) {
        await api.channels.update(id, data);
        notify('Channel updated successfully');
      } else {
        await api.channels.create(data);
        notify('Channel created successfully');
      }
      await fetchChannels();
    } catch {
      notify(`Error ${id ? 'updating' : 'creating'} channel`, 'error');
      throw new Error('save failed');
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (!window.confirm(`Delete channel "${channel.name}"? This cannot be undone.`)) return;
    try {
      await api.channels.delete(channel._id);
      await fetchChannels();
      notify('Channel deleted');
    } catch {
      notify('Error deleting channel', 'error');
    }
  };

  const handleSync = async (channel) => {
    setSyncLoading((p) => ({ ...p, [channel._id]: true }));
    try {
      const res = await api.channels.sync(channel._id);
      await fetchChannels();
      notify(res.data.message || 'Channel synced successfully');
    } catch (error) {
      notify(error.response?.data?.message || 'Error syncing channel', 'error');
    } finally {
      setSyncLoading((p) => ({ ...p, [channel._id]: false }));
    }
  };

  const handleBulkSync = async () => {
    setBulkSyncing(true);
    try {
      const res = await api.channels.bulkSync();
      await fetchChannels();
      notify(`Bulk sync complete: ${res.data.syncedChannels}/${res.data.totalChannels} channels synced`);
    } catch {
      notify('Error running bulk sync', 'error');
    } finally {
      setBulkSyncing(false);
    }
  };

  const openDetails = async (channel) => {
    setDetailsChannel(channel);
    try {
      const res = await api.channels.getStats(channel._id);
      setChannelStats((p) => ({ ...p, [channel._id]: res.data }));
    } catch {
      /* stats are best-effort */
    }
  };

  // ---- menu --------------------------------------------------------------
  const openMenu = (e, channel) => {
    setMenuAnchor(e.currentTarget);
    setMenuChannel(channel);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuChannel(null);
  };

  // ---- derived -----------------------------------------------------------
  const stats = useMemo(
    () => ({
      total: channels.length,
      active: channels.filter((c) => c.status === 'active').length,
      autoSync: channels.filter((c) => c.syncSettings?.autoSync).length,
      apiConnected: channels.filter((c) => c.apiConfig?.isActive).length,
      revenue: channels.reduce((s, c) => s + (c.metrics?.totalRevenue || 0), 0),
    }),
    [channels]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !`${c.name} ${typeLabel(c.type)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, search, typeFilter, statusFilter]);

  // ---- render ------------------------------------------------------------
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          p: 3,
          borderRadius: 4,
          ...GLASS,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'rgba(var(--app-primary-rgb), 0.12)',
            color: 'var(--app-primary)',
            width: 56,
            height: 56,
          }}
        >
          <CloudSyncIcon sx={{ fontSize: 30 }} />
        </Avatar>
        <Box sx={{ minWidth: 220 }}>
          <Typography variant="h4" sx={{ color: 'var(--app-primary)', fontWeight: 700, lineHeight: 1.1 }}>
            Channel Manager
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(var(--app-primary-rgb),0.75)' }}>
            Manage OTA, direct, and corporate channels with real-time sync
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={bulkSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
            onClick={handleBulkSync}
            disabled={bulkSyncing || stats.autoSync === 0}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {bulkSyncing ? 'Syncing…' : 'Bulk Sync'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingChannel(null);
              setFormOpen(true);
            }}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Add Channel
          </Button>
        </Box>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <StatCard icon={<StorefrontIcon />} value={stats.total} label="Total Channels" tint="var(--app-primary)" />
        <StatCard icon={<CheckCircleIcon />} value={stats.active} label="Active" tint="#10B981" />
        <StatCard icon={<SyncIcon />} value={stats.autoSync} label="Auto Sync" tint="#F59E0B" />
        <StatCard icon={<LinkIcon />} value={stats.apiConnected} label="API Connected" tint="#6366F1" />
        <StatCard icon={<MoneyIcon />} value={inr(stats.revenue)} label="Channel Revenue" tint="#0EA5E9" />
      </Grid>

      {/* Toolbar */}
      <Paper sx={{ p: 1.5, mb: 3, borderRadius: 3, ...GLASS, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search channels…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240, flex: '1 1 240px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={statusFilter}
          onChange={(_e, v) => v && setStatusFilter(v)}
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="all" sx={{ textTransform: 'none', px: 2 }}>
            All
          </ToggleButton>
          <ToggleButton value="active" sx={{ textTransform: 'none', px: 2 }}>
            Active
          </ToggleButton>
          <ToggleButton value="inactive" sx={{ textTransform: 'none', px: 2 }}>
            Inactive
          </ToggleButton>
          <ToggleButton value="suspended" sx={{ textTransform: 'none', px: 2 }}>
            Suspended
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All Types</MenuItem>
            {CHANNEL_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ ml: 'auto', color: 'text.secondary', fontSize: 14, pr: 1 }}>
          {filtered.length} of {channels.length}
        </Box>
      </Paper>

      {/* Channel grid / empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          hasChannels={channels.length > 0}
          onAdd={() => {
            setEditingChannel(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((channel) => (
            <Grid item xs={12} sm={6} lg={4} key={channel._id}>
              <ChannelCard
                channel={channel}
                stats={channelStats[channel._id]}
                syncing={!!syncLoading[channel._id]}
                onSync={() => handleSync(channel)}
                onMenu={(e) => openMenu(e, channel)}
                onView={() => openDetails(channel)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Row action menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            openDetails(menuChannel);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditingChannel(menuChannel);
            setFormOpen(true);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit channel</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMappingChannel(menuChannel);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <RoomIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Room mapping</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setRateChannel(menuChannel);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <MoneyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rate calculator</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleDeleteChannel(menuChannel);
            closeMenu();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <ChannelFormDialog
        open={formOpen}
        channel={editingChannel}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveChannel}
      />
      <ChannelDetailsDialog
        channel={detailsChannel}
        stats={detailsChannel ? channelStats[detailsChannel._id] : null}
        onClose={() => setDetailsChannel(null)}
      />
      <RoomMappingDialog
        channel={mappingChannel}
        availableRooms={availableRooms}
        onClose={() => setMappingChannel(null)}
        onSaved={async (id, mappings) => {
          try {
            await api.channels.updateRoomMappings(id, mappings);
            await fetchChannels();
            notify('Room mappings saved');
            setMappingChannel(null);
          } catch {
            notify('Error saving room mappings', 'error');
          }
        }}
      />
      <RateCalculatorDialog channel={rateChannel} onClose={() => setRateChannel(null)} notify={notify} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// ===========================================================================
// Sub-components
// ===========================================================================
const StatCard = ({ icon, value, label, tint }) => (
  <Grid item xs={6} sm={4} md={2.4}>
    <Box
      sx={{
        p: 2.5,
        height: '100%',
        borderRadius: 3,
        ...GLASS,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        transition: 'transform .25s ease, box-shadow .25s ease',
        '&:hover': { transform: 'translateY(-3px)' },
      }}
    >
      <Avatar sx={{ bgcolor: `${tint}1A`, color: tint, width: 48, height: 48 }}>{icon}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--app-primary)', lineHeight: 1.1 }} noWrap>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
          {label}
        </Typography>
      </Box>
    </Box>
  </Grid>
);

const ChannelCard = ({ channel, stats, syncing, onSync, onMenu, onView }) => {
  const color = channelColor(channel);
  const sm = statusMeta(channel.status);
  const apiOn = channel.apiConfig?.isActive;
  return (
    <Box
      sx={{
        height: '100%',
        borderRadius: 3,
        ...GLASS,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform .25s ease, box-shadow .25s ease',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 40px rgba(var(--app-primary-rgb),0.16)' },
      }}
    >
      {/* accent strip */}
      <Box sx={{ height: 5, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar sx={{ bgcolor: color, color: '#fff', fontWeight: 700, width: 46, height: 46 }}>
            {channelInitials(channel.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {channel.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {typeLabel(channel.type)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onMenu}>
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip size="small" label={sm.label} color={sm.color} variant={sm.color === 'default' ? 'outlined' : 'filled'} />
          <Chip
            size="small"
            icon={apiOn ? <LinkIcon /> : <LinkOffIcon />}
            label={apiOn ? 'API connected' : 'No API'}
            color={apiOn ? 'primary' : 'default'}
            variant="outlined"
          />
          {channel.syncSettings?.autoSync && (
            <Chip size="small" icon={<BoltIcon />} label="Auto sync" color="warning" variant="outlined" />
          )}
        </Box>

        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Metric label="Commission" value={`${channel.settings?.commission ?? 0}%`} />
          <Metric label="Markup" value={`${channel.settings?.markup ?? 0}%`} />
          <Metric label="Rooms mapped" value={channel.roomMappings?.length ?? 0} />
          <Metric label="Bookings" value={stats?.totalBookings ?? channel.metrics?.totalBookings ?? 0} />
        </Grid>

        <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Last sync: {formatDate(channel.syncSettings?.lastSync)}
          </Typography>
          <Box>
            <Tooltip title="View details">
              <IconButton size="small" onClick={onView}>
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={apiOn ? 'Sync now' : 'Enable API to sync'}>
              <span>
                <IconButton size="small" color="primary" onClick={onSync} disabled={syncing || !apiOn}>
                  {syncing ? <CircularProgress size={18} /> : <SyncIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const Metric = ({ label, value }) => (
  <Grid item xs={6}>
    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(var(--app-primary-rgb),0.04)' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--app-primary)', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  </Grid>
);

const EmptyState = ({ hasChannels, onAdd }) => (
  <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, ...GLASS }}>
    <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: 'rgba(var(--app-primary-rgb),0.12)', color: 'var(--app-primary)' }}>
      <StorefrontIcon sx={{ fontSize: 38 }} />
    </Avatar>
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
      {hasChannels ? 'No channels match your filters' : 'No channels yet'}
    </Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 440, mx: 'auto' }}>
      {hasChannels
        ? 'Try adjusting your search or filters to find what you are looking for.'
        : 'Connect your first distribution channel — an OTA like Booking.com or MakeMyTrip, your own website, or a corporate desk — to start managing inventory and rates.'}
    </Typography>
    {!hasChannels && (
      <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ borderRadius: 2, fontWeight: 600 }}>
        Add your first channel
      </Button>
    )}
  </Paper>
);

export default ChannelManager;
