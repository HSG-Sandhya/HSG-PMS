import { Box, Typography, Skeleton, Tooltip } from '@mui/material';
import { MeetingRoom } from '@mui/icons-material';
import { ROOM_STATUS_META, glassCard, textPrimary, textSecondary } from './hkConstants';

const Legend = ({ isDark }) => (
  <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
    {Object.values(ROOM_STATUS_META).map((s) => (
      <Box key={s.label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', background: s.color }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: textSecondary(isDark) }}>{s.label}</Typography>
      </Box>
    ))}
  </Box>
);

/**
 * Hotel floor-style room grid. Each tile is coloured by its housekeeping status
 * (`room.hkStatus`), grouped by floor. Clicking a tile raises `onRoomClick`.
 */
const RoomStatusBoard = ({ rooms = [], isDark = false, loading = false, onRoomClick }) => {
  // Group by floor (fallback "1"), sorted, rooms sorted by number.
  const byFloor = rooms.reduce((acc, r) => {
    const f = r.floor || 1;
    (acc[f] = acc[f] || []).push(r);
    return acc;
  }, {});
  const floors = Object.keys(byFloor).sort((a, b) => Number(a) - Number(b));

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MeetingRoom sx={{ color: 'var(--app-primary)' }} />
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Room Status Board</Typography>
        </Box>
        <Legend isDark={isDark} />
      </Box>

      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 1 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : rooms.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 5, textAlign: 'center' }}>
          <Box>
            <MeetingRoom sx={{ fontSize: 44, color: textSecondary(isDark), opacity: 0.5 }} />
            <Typography sx={{ mt: 1, color: textSecondary(isDark), fontWeight: 600 }}>No rooms configured</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ overflowY: 'auto', pr: 0.5, maxHeight: 420, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
          {floors.map((f) => (
            <Box key={f} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: textSecondary(isDark), mb: 0.75 }}>
                Floor {f}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 1 }}>
                {byFloor[f]
                  .slice()
                  .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }))
                  .map((room) => {
                    const meta = ROOM_STATUS_META[room.hkStatus] || ROOM_STATUS_META.clean;
                    return (
                      <Tooltip key={room._id} title={`Room ${room.roomNumber} · ${meta.label}${room.occupant ? ` · ${room.occupant}` : ''}`} arrow>
                        <Box
                          onClick={() => onRoomClick?.(room)}
                          sx={{
                            p: 1, borderRadius: '12px', cursor: onRoomClick ? 'pointer' : 'default',
                            background: `${meta.color}14`,
                            border: `1px solid ${meta.color}44`,
                            borderTop: `3px solid ${meta.color}`,
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 12px 22px -12px ${meta.color}` },
                          }}
                        >
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary(isDark), lineHeight: 1.1 }}>
                            {room.roomNumber}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
                            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: meta.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {meta.label}
                            </Typography>
                          </Box>
                        </Box>
                      </Tooltip>
                    );
                  })}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RoomStatusBoard;
