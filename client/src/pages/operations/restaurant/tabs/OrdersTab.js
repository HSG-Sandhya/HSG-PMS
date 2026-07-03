import { useState } from 'react';
import { Box, Button, Chip, Card, Collapse, IconButton, Typography, Avatar, Divider, CircularProgress } from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Kitchen as KitchenIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Hotel as HotelIcon,
  TableRestaurant as TableRestaurantIcon,
  PlayArrow as PlayArrowIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { currencySym, livePosGstFraction } from '../../../../utils/billing';

const STATUS_FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

// How long ago the order's status last changed, as a short label.
const timeAgoLabel = (order) => {
  try {
    const statusTime = order.statusUpdatedAt || order.updatedAt || order.createdAt;
    if (!statusTime) { return 'No timestamp'; }
    const statusDate = new Date(statusTime);
    if (isNaN(statusDate.getTime())) { return 'Invalid date'; }
    const diff = Date.now() - statusDate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) { return `${hours}h ${minutes % 60}m ago`; }
    return minutes > 0 ? `${minutes}m ago` : 'Just now';
  } catch (error) {
    return 'Timer error';
  }
};

// Resolve the table/room label shown for an order.
const seatLabel = (order, rooms, tables) => {
  if (order.roomId) {
    if (order.roomId && typeof order.roomId === 'object') {
      if (order.roomId.roomId && typeof order.roomId.roomId === 'object') {
        return `Room: ${order.roomId.roomId.roomNumber || 'N/A'}`;
      }
      return `Room: ${order.roomId.roomNumber || order.roomId.number || 'N/A'}`;
    }
    const room = rooms.find(r => r._id === order.roomId || r.bookingId === order.roomId);
    return `Room: ${room?.number || 'N/A'}`;
  }
  return `Table: ${order.tableId && typeof order.tableId === 'object'
    ? `${order.tableId.number || 'N/A'}`
    : tables.find(t => t._id === order.tableId)?.number || 'N/A'}`;
};

const statusColor = (status) =>
  status === 'Completed' ? 'success' : status === 'In Progress' ? 'warning' : status === 'Cancelled' ? 'error' : 'primary';

const statusIcon = (status) =>
  status === 'Completed' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> :
    status === 'In Progress' ? <KitchenIcon sx={{ fontSize: 16 }} /> :
      status === 'Cancelled' ? <CancelIcon sx={{ fontSize: 16 }} /> :
        <ScheduleIcon sx={{ fontSize: 16 }} />;

// "Orders" tab: status filter bar + a collapsible row per order. Each row shows
// a compact summary (status, table/room, total) and expands to reveal the full
// item breakdown, totals and status-update actions.
const OrdersTab = ({
  onOrderDialog,
  statusFilter,
  setStatusFilter,
  orders,
  filteredOrders,
  onRefreshOrders,
  onStatusUpdate,
  onDeleteOrder,
  orderStatusUpdating,
  rooms,
  tables,
  fontFamily,
  fontSize,
}) => {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onOrderDialog()}
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
          Create Order
        </Button>
      </Box>

      {/* Status Filter Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 3,
        p: 2,
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
      }}>
        <FilterListIcon sx={{ color: '#667eea', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2c3e50' }}>Filter by Status:</Typography>
        {STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setStatusFilter(status)}
            sx={{
              borderRadius: '12px',
              px: 2,
              py: 0.5,
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              ...(statusFilter === status ? {
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                '&:hover': { background: 'linear-gradient(90deg, #5a6fd8 0%, #6a4190 100%)' },
              } : {
                color: '#667eea',
                borderColor: 'rgba(102, 126, 234, 0.3)',
                '&:hover': { borderColor: '#667eea', background: 'rgba(102, 126, 234, 0.1)' },
              }),
            }}
          >
            {status}
            {status !== 'All' && (
              <Chip
                label={orders.filter(o => o.status === status).length}
                size="small"
                sx={{
                  ml: 1,
                  height: 16,
                  fontSize: '0.7rem',
                  backgroundColor: statusFilter === status ? 'rgba(255,255,255,0.2)' : 'rgba(102, 126, 234, 0.2)',
                }}
              />
            )}
          </Button>
        ))}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: '#64748b' }}>Total Orders: {filteredOrders.length}</Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefreshOrders}
            sx={{ borderRadius: '8px', color: '#667eea', '&:hover': { background: 'rgba(102, 126, 234, 0.1)' } }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredOrders.map((order) => {
          const isOpen = !!expanded[order._id];

          // Totals — POS prices are GST-INCLUSIVE (the POS screen already
          // charges tax inside the item price), so never add 5% on top again;
          // table/room orders keep GST added on top.
          const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const isInclusive = order.gstIncluded === true;
          const posFrac = livePosGstFraction();
          const gst = isInclusive
            ? (order.gst || subtotal - subtotal / (1 + posFrac))
            : (order.gst > 0 ? order.gst : subtotal * posFrac);
          const total = isInclusive ? subtotal : Math.round(subtotal + gst);
          const itemCount = order.items.reduce((n, item) => n + item.quantity, 0);

          return (
            <Card key={order._id} sx={{
              borderRadius: '20px',
              background: 'var(--app-glass-sheen), rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
              backdropFilter: 'var(--app-blur)',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              overflow: 'hidden',
              fontFamily,
              fontSize,
              transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { boxShadow: '0 12px 40px rgba(var(--app-primary-rgb),0.18)' },
            }}>
              {/* ── Summary header (click to expand) ── */}
              <Box
                onClick={() => toggle(order._id)}
                role="button"
                aria-expanded={isOpen}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  p: 2.5,
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  transition: 'background 0.2s ease',
                  '&:hover': { background: 'rgba(102, 126, 234, 0.05)' },
                }}
              >
                {/* Left: status + id + seat + date */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flexWrap: 'wrap' }}>
                  <Chip
                    label={order.status || 'Pending'}
                    icon={statusIcon(order.status)}
                    color={statusColor(order.status)}
                    size="small"
                    sx={{ fontWeight: 600, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', '& .MuiChip-icon': { ml: 0.5 } }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2c3e50', lineHeight: 1.2 }} noWrap>
                      Order #{order.orderNumber || order._id.slice(-6)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.72rem' }}>
                      {timeAgoLabel(order)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: order.roomId ? 'rgba(255, 152, 0, 0.1)' : 'rgba(102, 126, 234, 0.1)' }}>
                      {order.roomId
                        ? <HotelIcon sx={{ fontSize: 15, color: '#ff9800' }} />
                        : <TableRestaurantIcon sx={{ fontSize: 15, color: '#667eea' }} />}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#2c3e50' }}>
                      {seatLabel(order, rooms, tables)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
                    {format(parseISO(order.createdAt), 'dd/MM/yyyy HH:mm')}
                  </Typography>
                </Box>

                {/* Right: count + total + chevron */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: '#667eea', fontSize: '1.05rem' }}>
                    {currencySym()}{total}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={isOpen ? 'Collapse order' : 'Expand order'}
                    sx={{ color: '#667eea', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* ── Expanded details ── */}
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch' }}>
                  {/* Items */}
                  <Box sx={{
                    p: 2.5,
                    flex: 1,
                    minWidth: 0,
                    borderBottom: { xs: '1px solid rgba(0,0,0,0.08)', md: 'none' },
                    borderRight: { md: '1px solid rgba(0,0,0,0.08)' },
                  }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#2c3e50' }}>
                      Items:
                    </Typography>
                    <Box>
                      {order.items.map((item, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1, p: 1, borderRadius: '8px', bgcolor: 'rgba(102, 126, 234, 0.05)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.quantity}x {item.name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#667eea', flexShrink: 0 }}>
                            {currencySym()}{item.price * item.quantity}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {order.specialInstructions && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: '12px' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f57c00', mb: 0.5 }}>
                          Special Instructions:
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          {order.specialInstructions}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Totals + actions */}
                  <Box sx={{
                    p: 2.5,
                    width: { xs: '100%', md: 300 },
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}>
                    <Box sx={{ p: 2, bgcolor: 'rgba(102, 126, 234, 0.08)', borderRadius: '12px', border: '1px solid rgba(102, 126, 234, 0.1)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {isInclusive ? 'Subtotal (incl. GST):' : 'Subtotal:'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{currencySym()}{subtotal}</Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {isInclusive ? 'GST included:' : 'GST:'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{currencySym()}{Number(gst).toFixed(2)}</Typography>
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2c3e50' }}>Total:</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#667eea' }}>{currencySym()}{total}</Typography>
                      </Box>
                    </Box>

                    {/* Status Update Buttons */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {order.status !== 'In Progress' && order.status !== 'Completed' && order.status !== 'Cancelled' && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={orderStatusUpdating[order._id] ? <CircularProgress size={12} /> : <PlayArrowIcon />}
                          onClick={() => onStatusUpdate(order._id, 'In Progress')}
                          disabled={orderStatusUpdating[order._id]}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            background: 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)',
                            '&:hover': { background: 'linear-gradient(90deg, #f57c00 0%, #ef6c00 100%)' },
                          }}
                        >
                          Start Cooking
                        </Button>
                      )}
                      {order.status === 'In Progress' && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={orderStatusUpdating[order._id] ? <CircularProgress size={12} /> : <CheckCircleIcon />}
                          onClick={() => onStatusUpdate(order._id, 'Completed')}
                          disabled={orderStatusUpdating[order._id]}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            background: 'linear-gradient(90deg, #4caf50 0%, #388e3c 100%)',
                            '&:hover': { background: 'linear-gradient(90deg, #388e3c 0%, #2e7d32 100%)' },
                          }}
                        >
                          Mark Complete
                        </Button>
                      )}
                      {(order.status === 'Pending' || order.status === 'In Progress') && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={orderStatusUpdating[order._id] ? <CircularProgress size={12} /> : <CancelIcon />}
                          onClick={() => onStatusUpdate(order._id, 'Cancelled')}
                          disabled={orderStatusUpdating[order._id]}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            color: '#f44336',
                            borderColor: '#f44336',
                            '&:hover': { borderColor: '#d32f2f', background: 'rgba(244, 67, 54, 0.1)' },
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </Box>

                    {/* Edit / Delete + priority */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          onClick={() => onOrderDialog(order)}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            minWidth: 'auto',
                            p: 1,
                            color: '#667eea',
                            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </Button>
                        {order.status === 'Pending' && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => onDeleteOrder(order._id)}
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 600,
                              minWidth: 'auto',
                              p: 1,
                              '&:hover': { background: 'rgba(244, 67, 54, 0.1)' },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </Button>
                        )}
                      </Box>

                      {order.status === 'In Progress' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                            <Typography sx={{ fontSize: '0.8rem' }}>🔥</Typography>
                          </motion.div>
                          <Typography variant="caption" sx={{ color: '#ff9800', fontWeight: 600 }}>
                            Priority
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Collapse>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default OrdersTab;
