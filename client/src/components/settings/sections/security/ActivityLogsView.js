import { useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, CircularProgress, TextField, MenuItem, Grid,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../../../api';

const cardSx = {
  p: { xs: 2, md: 2.5 }, borderRadius: 3,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)', WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

export const CATEGORY_COLOR = {
  auth: '#3B82F6', role: '#8B5CF6', user: '#0EA5E9', data: '#10B981', security: '#EF4444', system: '#6B7280',
};
const SEVERITY_COLOR = { info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444' };

export const fmtDateTime = (d) => {
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const Stat = ({ label, value, color }) => (
  <Grid item xs={6} md={3}>
    <Box sx={{ ...cardSx, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h5" fontWeight={800} sx={{ color: color || 'text.primary' }}>{value}</Typography>
    </Box>
  </Grid>
);

const ActivityLogsView = ({ onNotify }) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.activityLog.getLogs({ category, severity, search: search.trim() || undefined, limit: 300 }),
        api.activityLog.getStats(),
      ]);
      setLogs(logsRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } catch (e) {
      onNotify?.('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [category, severity, search, onNotify]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Stat label="Total events" value={stats?.total ?? '—'} />
        <Stat label="Today" value={stats?.today ?? '—'} color="var(--app-primary)" />
        <Stat label="Audit events" value={stats?.auditCount ?? '—'} color="#8B5CF6" />
        <Stat label="Critical" value={stats?.bySeverity?.find((s) => s.severity === 'critical')?.count ?? 0} color="#EF4444" />
      </Grid>

      <Box sx={cardSx}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>Activity Logs</Typography>
          <TextField size="small" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
          <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 130 }}>
            {['all', 'auth', 'role', 'user', 'data', 'security', 'system'].map((c) => (
              <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c === 'all' ? 'All categories' : c}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} sx={{ minWidth: 120 }}>
            {['all', 'info', 'warning', 'critical'].map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s === 'all' ? 'All' : s}</MenuItem>
            ))}
          </TextField>
          <Tooltip title="Refresh"><IconButton onClick={load} sx={{ color: 'var(--app-primary)' }}><RefreshIcon /></IconButton></Tooltip>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : logs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            No activity recorded yet. Logins and role/user changes appear here.
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Severity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.createdAt)}</TableCell>
                    <TableCell>{l.userName || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={l.category}
                        sx={{ height: 20, fontWeight: 700, color: '#fff', textTransform: 'capitalize', bgcolor: CATEGORY_COLOR[l.category] || '#6B7280' }} />
                    </TableCell>
                    <TableCell><code style={{ fontSize: 12 }}>{l.action}</code></TableCell>
                    <TableCell>{l.description || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={l.severity} variant="outlined"
                        sx={{ height: 20, textTransform: 'capitalize', borderColor: SEVERITY_COLOR[l.severity], color: SEVERITY_COLOR[l.severity] }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ActivityLogsView;
