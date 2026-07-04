import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  Alert,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const formatDate = (input) => {
  if (!input) return '—';
  try {
    const date = new Date(input);
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(input);
  }
};

const BackupSection = ({ onNotify }) => {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.backup.getAll().catch(() => ({ data: { data: [] } })),
        api.backup.getStorageStats().catch(() => ({ data: { data: null } })),
      ]);
      const list =
        listRes.data?.data?.backups ||
        listRes.data?.data ||
        (Array.isArray(listRes.data) ? listRes.data : []);
      setBackups(Array.isArray(list) ? list : []);
      setStats(statsRes.data?.data || null);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load backups', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await api.backup.createManual();
      onNotify?.(data?.message || 'Backup created', 'success');
      await load();
      broadcastSettingsChange('backups');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Backup failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    setBusyId(filename);
    try {
      const response = await api.backup.download(filename);
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Download failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (filename) => {
    if (!window.confirm(`Restore from "${filename}"? This will overwrite current data.`)) return;
    setBusyId(filename);
    try {
      await api.backup.restore(filename);
      onNotify?.('Restore initiated', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Restore failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Permanently delete backup "${filename}"?`)) return;
    setBusyId(filename);
    try {
      await api.backup.delete(filename);
      onNotify?.('Backup deleted', 'success');
      await load();
      broadcastSettingsChange('backups');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Card elevation={0} sx={{
        borderRadius: 2,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backgroundColor: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backgroundImage: 'none',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: 'flex-start', sm: 'center' },
              mb: 2
            }}>
            <Box>
              <Typography variant="h6">Database backups</Typography>
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                JSON snapshots of every collection. Use restore with caution.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Reload">
                <IconButton onClick={load}><RefreshIcon /></IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <BackupIcon />}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create backup now'}
              </Button>
            </Stack>
          </Stack>

          {stats && (
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{
                mb: 2,
                flexWrap: "wrap"
              }}>
              <Chip label={`Total backups: ${stats.totalBackups ?? backups.length}`} />
              {stats.totalSize !== undefined && (
                <Chip label={`Total size: ${formatBytes(stats.totalSize)}`} />
              )}
              {stats.lastBackup && (
                <Chip label={`Last: ${formatDate(stats.lastBackup)}`} variant="outlined" />
              )}
            </Stack>
          )}

          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                py: 4
              }}>
              <CircularProgress />
            </Box>
          ) : backups.length === 0 ? (
            <Alert severity="info">No backups yet. Click “Create backup now” to make one.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Filename</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => {
                    const filename = backup.filename || backup.name;
                    const isBusy = busyId === filename;
                    return (
                      <TableRow key={filename} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              wordBreak: 'break-all'
                            }}>
                            {filename}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(backup.createdAt || backup.timestamp)}</TableCell>
                        <TableCell align="right">{formatBytes(backup.size)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Download">
                            <span>
                              <IconButton size="small" onClick={() => handleDownload(filename)} disabled={isBusy}>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Restore">
                            <span>
                              <IconButton size="small" color="warning" onClick={() => handleRestore(filename)} disabled={isBusy}>
                                <RestoreIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <span>
                              <IconButton size="small" color="error" onClick={() => handleDelete(filename)} disabled={isBusy}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export default BackupSection;
