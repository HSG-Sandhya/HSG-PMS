import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Skeleton, Avatar,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, Done as DoneIcon, PlaylistAddCheckCircle,
} from '@mui/icons-material';
import {
  STATUS_META, PRIORITY_META, glassCard, textPrimary, textSecondary, initials,
} from './hkConstants';

const Pill = ({ label, color }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.5,
    px: 1, py: 0.35, borderRadius: '999px',
    background: `${color}1f`, color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  }}>
    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
    {label}
  </Box>
);

const headCellSx = (isDark) => ({
  fontSize: 11.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
  color: textSecondary(isDark), border: 'none', py: 1,
});

/**
 * Today's housekeeping tasks. Rows are pre-normalised by the parent:
 * { _id, room, guest, task, staff, priority, status, canComplete }.
 */
const TasksTable = ({ rows = [], isDark = false, loading = false, onEdit, onDelete, onComplete }) => {
  const cellSx = { border: 'none', py: 1.25, color: textPrimary(isDark) };

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <PlaylistAddCheckCircle sx={{ color: 'var(--app-primary)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Today&apos;s Housekeeping Tasks</Typography>
        <Box sx={{ ml: 'auto', px: 1, py: 0.25, borderRadius: '999px', background: 'rgba(22,143,229,0.14)', color: 'var(--app-primary)', fontSize: 12.5, fontWeight: 800 }}>
          {rows.length}
        </Box>
      </Box>

      {loading ? (
        <Box>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1, borderRadius: 2 }} />
          ))}
        </Box>
      ) : rows.length === 0 ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Box>
            <PlaylistAddCheckCircle sx={{ fontSize: 52, color: 'var(--app-primary)', opacity: 0.35 }} />
            <Typography sx={{ mt: 1, fontWeight: 700, color: textPrimary(isDark) }}>All caught up</Typography>
            <Typography sx={{ fontSize: 13, color: textSecondary(isDark) }}>No housekeeping tasks scheduled. Create one to get started.</Typography>
          </Box>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 420, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ '& th': { background: isDark ? '#1e293b' : '#fff' } }}>
                <TableCell sx={headCellSx(isDark)}>Room</TableCell>
                <TableCell sx={headCellSx(isDark)}>Guest</TableCell>
                <TableCell sx={headCellSx(isDark)}>Task</TableCell>
                <TableCell sx={headCellSx(isDark)}>Assigned</TableCell>
                <TableCell sx={headCellSx(isDark)}>Priority</TableCell>
                <TableCell sx={headCellSx(isDark)}>Status</TableCell>
                <TableCell sx={{ ...headCellSx(isDark), textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r._id}
                  sx={{
                    transition: 'background 0.2s ease',
                    '&:hover': { background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(22,143,229,0.06)' },
                    '& td': { borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'}` },
                  }}
                >
                  <TableCell sx={{ ...cellSx, fontWeight: 800 }}>{r.room}</TableCell>
                  <TableCell sx={{ ...cellSx, color: textSecondary(isDark) }}>{r.guest || '—'}</TableCell>
                  <TableCell sx={cellSx}>{r.task}</TableCell>
                  <TableCell sx={cellSx}>
                    {r.staff ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, bgcolor: 'var(--app-primary)' }}>
                          {initials(r.staff)}
                        </Avatar>
                        <span>{r.staff}</span>
                      </Box>
                    ) : <Box sx={{ color: textSecondary(isDark) }}>Unassigned</Box>}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Pill label={r.priority} color={(PRIORITY_META[r.priority] || {}).color || '#64748b'} />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Pill label={r.status} color={(STATUS_META[r.status] || {}).color || '#64748b'} />
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.canComplete && (
                      <Tooltip title="Mark completed" arrow>
                        <IconButton size="small" onClick={() => onComplete?.(r)} sx={{ color: '#10b981' }}>
                          <DoneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit" arrow>
                      <IconButton size="small" onClick={() => onEdit?.(r)} sx={{ color: 'var(--app-primary)' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete" arrow>
                      <IconButton size="small" onClick={() => onDelete?.(r)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TasksTable;
