import { Box, Button, Grid, Card, CardContent, Typography } from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  TableRestaurant as TableRestaurantIcon,
  People as PeopleIcon,
  Layers as LayersIcon,
  GridView as SectionIcon,
  ShoppingCart as OrderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import OccupancyPanel from '../OccupancyPanel';

// Status palette (drives the card accent, pill and segmented control).
const STATUS = {
  Available: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', ring: 'rgba(16,185,129,0.35)', glow: 'rgba(16,185,129,0.28)' },
  Occupied: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', ring: 'rgba(239,68,68,0.35)', glow: 'rgba(239,68,68,0.28)' },
  Reserved: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.28)' },
};

// "Tables" tab: floor-plan cards with live occupancy timer and status control.
// `onTableDialog` opens the table dialog (pass a table to edit, or no arg to add).
const TablesTab = ({
  tables,
  orders,
  onTableDialog,
  onRefresh,
  onStatusChange,
  onGuestsChange,
  onSettle,
  onDeleteTable,
}) => (
  <Box>
    <Box sx={{ mb: 3, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => onTableDialog()}
        sx={{
          borderRadius: '999px',
          px: 3,
          py: 1.2,
          textTransform: 'none',
          fontWeight: 700,
          boxShadow: '0 8px 20px rgba(var(--app-primary-rgb),0.25)',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 26px rgba(var(--app-primary-rgb),0.35)' },
        }}
      >
        Add Table
      </Button>
      <Button
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={onRefresh}
        sx={{
          borderRadius: '999px',
          px: 3,
          py: 1.2,
          textTransform: 'none',
          fontWeight: 700,
          borderColor: 'rgba(var(--app-primary-rgb),0.4)',
          color: 'var(--app-primary)',
          '&:hover': { borderColor: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb),0.06)', transform: 'translateY(-2px)' },
        }}
      >
        Refresh Data
      </Button>
    </Box>

    <Grid container spacing={3} alignItems="flex-start">
      {tables.map((table, index) => {
        let occupiedStart = null;
        if (table.status === 'Occupied' && table.occupiedAt) {
          const start = new Date(table.occupiedAt).getTime();
          if (!Number.isNaN(start)) occupiedStart = start;
        }

        // Resolve a table id whether `tableId` is a raw id or a populated doc.
        const orderTableId = (order) => (
          order.tableId && typeof order.tableId === 'object' ? order.tableId._id : order.tableId
        );
        const belongsToTable = (order) => {
          const tid = orderTableId(order);
          return tid === table._id || tid === table.number;
        };

        // Active orders (for the "N active orders" chip).
        const tableOrders = orders.filter(order => (
          belongsToTable(order) &&
          (order.status === 'Pending' || order.status === 'In Progress' || order.status === 'Preparing')
        ));

        // Bill orders: everything non-cancelled placed during the current sitting.
        const orderTotal = orders.reduce((sum, order) => {
          if (!belongsToTable(order) || order.status === 'Cancelled') return sum;
          if (occupiedStart) {
            const created = new Date(order.createdAt).getTime();
            if (!Number.isNaN(created) && created < occupiedStart - 120000) return sum;
          }
          return sum + (Number(order.totalAmount) || 0);
        }, 0);

        const sm = STATUS[table.status] || STATUS.Available;

        return (
          <Grid item xs={12} sm={6} md={3} key={table._id}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.45), ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
            >
              <Card
                sx={{
                  borderRadius: '22px',
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2.4))',
                  backdropFilter: 'var(--app-blur)',
                  WebkitBackdropFilter: 'var(--app-blur)',
                  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.1))',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.25)',
                  transition: 'box-shadow .35s ease, border-color .35s ease, transform .35s ease',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 5,
                    background: `linear-gradient(90deg, ${sm.color}, ${sm.color}66)`,
                  },
                  '&:hover': {
                    boxShadow: `0 20px 50px ${sm.glow}`,
                    borderColor: sm.ring,
                  },
                }}
              >
                <CardContent sx={{ p: 2.75 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      width: 46, height: 46, flexShrink: 0,
                      borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: sm.bg, color: sm.color,
                      boxShadow: `inset 0 0 0 1px ${sm.ring}`,
                    }}>
                      <TableRestaurantIcon />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, color: 'text.primary' }}>
                        Table {table.number}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {table.section} · {table.floor}
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75,
                      px: 1.25, py: 0.5, borderRadius: '999px',
                      background: sm.bg, color: sm.color, fontWeight: 700, fontSize: '0.72rem',
                    }}>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%', background: sm.color,
                        ...(table.status === 'Occupied' && {
                          '@keyframes tblDot': {
                            '0%': { boxShadow: `0 0 0 0 ${sm.color}99` },
                            '70%': { boxShadow: `0 0 0 6px ${sm.color}00` },
                            '100%': { boxShadow: `0 0 0 0 ${sm.color}00` },
                          },
                          animation: 'tblDot 1.6s infinite',
                        }),
                      }} />
                      {table.status}
                    </Box>
                  </Box>

                  {/* Info rows */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {[
                      { icon: <PeopleIcon sx={{ fontSize: 18 }} />, c: '#6366F1', label: `Capacity: ${table.capacity} people` },
                      { icon: <LayersIcon sx={{ fontSize: 18 }} />, c: '#F59E0B', label: `Floor: ${table.floor}` },
                      { icon: <SectionIcon sx={{ fontSize: 18 }} />, c: '#10B981', label: `Section: ${table.section}` },
                    ].map((r) => (
                      <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{
                          width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${r.c}1A`, color: r.c,
                        }}>
                          {r.icon}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {r.label}
                        </Typography>
                      </Box>
                    ))}
                    {table.notes && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                        <Box sx={{
                          width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(139,92,246,0.12)',
                        }}>
                          <span style={{ fontSize: '15px' }}>📝</span>
                        </Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          {table.notes}
                        </Typography>
                      </Box>
                    )}
                    {tableOrders.length > 0 && (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.75, alignSelf: 'flex-start',
                        px: 1.25, py: 0.5, borderRadius: '999px',
                        background: 'rgba(var(--app-primary-rgb),0.1)', color: 'var(--app-primary)',
                        fontWeight: 700, fontSize: '0.72rem',
                      }}>
                        <OrderIcon sx={{ fontSize: 15 }} />
                        {tableOrders.length} active order{tableOrders.length > 1 ? 's' : ''}
                      </Box>
                    )}
                    {table.status === 'Occupied' && occupiedStart && (
                      <OccupancyPanel
                        startMs={occupiedStart}
                        guests={table.guests || 2}
                        orderCount={tableOrders.length}
                        orderTotal={orderTotal}
                        onGuestsChange={onGuestsChange ? (g) => onGuestsChange(table._id, g) : undefined}
                        onSettle={onSettle ? (amount) => onSettle(table, amount) : undefined}
                      />
                    )}
                  </Box>
                </CardContent>
                <Box sx={{ px: 2.75, pb: 2.5, pt: 0 }}>
                  <Box sx={{ height: '1px', background: 'rgba(var(--app-primary-rgb),0.12)', mb: 1.75 }} />

                  {/* Segmented status control */}
                  <Box sx={{
                    display: 'flex', gap: 0.5, p: 0.5, mb: 1.5,
                    borderRadius: '999px',
                    background: 'rgba(var(--app-primary-rgb),0.05)',
                  }}>
                    {['Available', 'Reserved', 'Occupied'].map((st) => {
                      const active = table.status === st;
                      const m = STATUS[st];
                      return (
                        <Box
                          key={st}
                          role="button"
                          tabIndex={0}
                          onClick={() => onStatusChange(table._id, st)}
                          sx={{
                            flex: 1,
                            textAlign: 'center',
                            cursor: 'pointer',
                            py: 0.65,
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: active ? '#fff' : 'text.secondary',
                            background: active ? m.color : 'transparent',
                            boxShadow: active ? `0 4px 12px ${m.glow}` : 'none',
                            transition: 'all 0.25s ease',
                            '&:hover': { color: active ? '#fff' : m.color, background: active ? m.color : `${m.color}1A` },
                          }}
                        >
                          {st}
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Edit / Delete */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => onTableDialog(table)}
                      sx={{
                        width: 36, height: 36, borderRadius: '11px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--app-primary)',
                        background: 'rgba(var(--app-primary-rgb),0.08)',
                        transition: 'all 0.2s ease',
                        '&:hover': { background: 'rgba(var(--app-primary-rgb),0.18)', transform: 'translateY(-2px)' },
                      }}
                    >
                      <EditIcon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => onDeleteTable(table._id)}
                      sx={{
                        width: 36, height: 36, borderRadius: '11px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#EF4444',
                        background: 'rgba(239,68,68,0.08)',
                        transition: 'all 0.2s ease',
                        '&:hover': { background: 'rgba(239,68,68,0.18)', transform: 'translateY(-2px)' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 19 }} />
                    </Box>
                  </Box>
                </Box>
              </Card>
            </motion.div>
          </Grid>
        );
      })}
    </Grid>
  </Box>
);

export default TablesTab;
