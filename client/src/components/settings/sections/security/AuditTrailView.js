import { useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, CircularProgress, TextField, MenuItem,
  IconButton, Tooltip, Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import api from '../../../../api';
import { CATEGORY_COLOR, fmtDateTime } from './ActivityLogsView';

const cardSx = {
  p: { xs: 2, md: 2.5 }, borderRadius: 3,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)', WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};
const SEVERITY_COLOR = { info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444' };

// Diff two permission arrays into added / removed.
const permDiff = (before = [], after = []) => {
  const b = new Set(before || []);
  const a = new Set(after || []);
  return {
    added: [...a].filter((p) => !b.has(p)),
    removed: [...b].filter((p) => !a.has(p)),
  };
};

const ChangeDetail = ({ changes }) => {
  if (!changes) return null;
  const before = changes.before || {};
  const after = changes.after || {};
  const { added, removed } = permDiff(before.permissions, after.permissions);
  const nameChanged = after.name && before.name && after.name !== before.name;
  const hierChanged = after.hierarchy !== undefined && before.hierarchy !== undefined && after.hierarchy !== before.hierarchy;

  if (!added.length && !removed.length && !nameChanged && !hierChanged && !changes.before && !changes.after) return null;

  return (
    <Box sx={{ mt: 1, pl: 1.5, borderLeft: '2px solid', borderColor: 'divider' }}>
      {nameChanged && <Typography variant="caption" sx={{
        display: "block"
      }}>Name: <s>{before.name}</s> → <strong>{after.name}</strong></Typography>}
      {hierChanged && <Typography variant="caption" sx={{
        display: "block"
      }}>Level: {before.hierarchy} → <strong>{after.hierarchy}</strong></Typography>}
      {added.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700 }}>+ Granted ({added.length})</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
            {added.map((p) => <Chip key={p} size="small" label={p.replace(/_/g, ' ')} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(16,185,129,0.12)', color: '#059669', textTransform: 'capitalize' }} />)}
          </Box>
        </Box>
      )}
      {removed.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 700 }}>− Revoked ({removed.length})</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
            {removed.map((p) => <Chip key={p} size="small" label={p.replace(/_/g, ' ')} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.12)', color: '#dc2626', textTransform: 'capitalize' }} />)}
          </Box>
        </Box>
      )}
      {!added.length && !removed.length && !nameChanged && !hierChanged && (after.permissions || before.permissions) && (
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          {(after.permissions || before.permissions || []).length} permission(s)
        </Typography>
      )}
    </Box>
  );
};

const AuditTrailView = ({ onNotify }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.activityLog.getLogs({ audit: true, category, limit: 300 });
      setLogs(data?.data || []);
    } catch (e) {
      onNotify?.('Failed to load audit trail', 'error');
    } finally {
      setLoading(false);
    }
  }, [category, onNotify]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={cardSx}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
          alignItems: { md: 'center' },
          mb: 2
        }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            flexGrow: 1
          }}>
          <SecurityIcon sx={{ color: '#EF4444' }} />
          <Box>
            <Typography variant="h6" sx={{
              fontWeight: 800
            }}>Audit Trail</Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>Security-sensitive changes: roles, permissions, users, access</Typography>
          </Box>
        </Stack>
        <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 140 }}>
          {['all', 'auth', 'role', 'user', 'security'].map((c) => (
            <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c === 'all' ? 'All' : c}</MenuItem>
          ))}
        </TextField>
        <Tooltip title="Refresh"><IconButton onClick={load} sx={{ color: 'var(--app-primary)' }}><RefreshIcon /></IconButton></Tooltip>
      </Stack>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : logs.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          No audit events yet. Role edits, permission changes, user management and logins are recorded here.
        </Box>
      ) : (
        <Stack divider={<Divider />} spacing={0}>
          {logs.map((l) => (
            <Box key={l._id} sx={{ py: 1.5 }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap"
                }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}>
                    <Chip size="small" label={l.category}
                      sx={{ height: 20, fontWeight: 700, color: '#fff', textTransform: 'capitalize', bgcolor: CATEGORY_COLOR[l.category] || '#6B7280' }} />
                    <Typography variant="body2" sx={{
                      fontWeight: 700
                    }}>{l.description || l.action}</Typography>
                    {l.severity === 'critical' && <Chip size="small" label="critical" sx={{ height: 18, fontSize: 10, color: '#fff', bgcolor: SEVERITY_COLOR.critical }} />}
                  </Stack>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    by {l.userName || 'System'} · {fmtDateTime(l.createdAt)}{l.ip ? ` · ${l.ip}` : ''}
                  </Typography>
                  <ChangeDetail changes={l.changes} />
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default AuditTrailView;
