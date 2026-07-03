import { Grid, FormControl, InputLabel, Select, MenuItem, Chip, Box, Card, Typography, Button } from '@mui/material';
import {
  ShoppingCart as OrderIcon,
  Restaurant as RestaurantIcon,
  LocalFlorist as EcoIcon,
  Star as StarIcon,
  AccessTime as TimerIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../../components/forms/FormDialog';
import { currencySym } from '../../../../utils/billing';

const MENU_PAPER = {
  PaperProps: {
    sx: {
      backgroundColor: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(0,0,0,0.1)',
    },
  },
};

// Build a restaurant order: choose table/room, add menu items, review summary.
// Totals are computed by the parent and passed in as numbers; `menuFilters` is
// the search/filter toolbar rendered by the parent.
const OrderDialog = ({
  open,
  onClose,
  onSubmit,
  selectedOrder,
  orderForm,
  setOrderForm,
  rooms,
  tables,
  menuFilters,
  filteredMenuItems,
  selectedItems,
  onItemClick,
  onQuantityChange,
  menuItems,
  totalItemsCount,
  subtotal,
  gstAmount,
  totalPrice,
}) => (
  <FormDialog
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    maxWidth="md"
    icon={<OrderIcon />}
    eyebrow="Restaurant"
    title={selectedOrder ? 'Edit Order' : 'Create New Order'}
    submitDisabled={totalItemsCount === 0}
    submitLabel={totalItemsCount > 0
      ? `${selectedOrder ? 'Update Order' : 'Create Order'} (${currencySym()}${totalPrice.toFixed(2)})`
      : 'Select Items to Order'}
  >
    {/* Order Type Selection */}
    <FormSection title="Order & Table" icon={<OrderIcon fontSize="small" />} iconColor="#6366f1">
      <Grid container spacing={2}>
        <Grid item xs={12} sm={orderForm.orderType === 'room' ? 6 : 12}>
          <FormControl fullWidth>
            <InputLabel>Order Type</InputLabel>
            <Select
              value={orderForm.orderType}
              onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value, roomId: '', tableId: '' })}
              label="Order Type"
              MenuProps={MENU_PAPER}
            >
              <MenuItem value="table">Table Service</MenuItem>
              <MenuItem value="room">Room Service</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Room Selection for Room Service */}
        {orderForm.orderType === 'room' && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Select Room</InputLabel>
              <Select
                value={rooms.find(r => r._id === orderForm.roomId) ? orderForm.roomId : ''}
                onChange={(e) => setOrderForm({ ...orderForm, roomId: e.target.value })}
                label="Select Room"
                MenuProps={MENU_PAPER}
              >
                {rooms.map((room) => (
                  <MenuItem key={room._id} value={room._id}>
                    Room {room.number} - {room.type}
                    <Chip label={`Guest: ${room.guestName}`} size="small" color="primary" sx={{ ml: 1, fontSize: '0.7rem' }} />
                  </MenuItem>
                ))}
                {rooms.length === 0 && <MenuItem disabled>No checked-in rooms available</MenuItem>}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Table Selection for Table Service */}
        {orderForm.orderType === 'table' && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Select Table</InputLabel>
              <Select
                value={tables.find(t => t._id === orderForm.tableId) ? orderForm.tableId : ''}
                onChange={(e) => setOrderForm({ ...orderForm, tableId: e.target.value })}
                label="Select Table"
                MenuProps={MENU_PAPER}
              >
                {tables
                  .filter(table => table.status === 'Available' || table.status === 'Occupied')
                  .map((table) => (
                    <MenuItem key={table._id} value={table._id}>
                      Table {table.number} - {table.section} ({table.capacity} seats)
                      <Chip label={table.status} size="small" color={table.status === 'Available' ? 'success' : 'warning'} sx={{ ml: 1, fontSize: '0.7rem' }} />
                    </MenuItem>
                  ))}
                {tables.filter(table => table.status === 'Available' || table.status === 'Occupied').length === 0 && (
                  <MenuItem disabled>No tables available</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>
    </FormSection>

    {/* Menu Items with Search and Filter */}
    <FormSection title="Menu Items" icon={<RestaurantIcon fontSize="small" />} iconColor="#f43f5e">
      {menuFilters}

      <Box sx={{ maxHeight: 450, overflowY: 'auto', mt: 3 }}>
        <Grid container spacing={2}>
          {filteredMenuItems.map((item) => {
            const available = item.isAvailable !== false;
            return (
            <Grid item xs={12} sm={6} md={4} key={item._id}>
              <Card
                onClick={available ? () => onItemClick(item) : undefined}
                sx={{
                  p: 3,
                  cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.55,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': available ? {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(var(--app-primary-rgb),0.15)',
                  } : {},
                  backgroundColor: selectedItems[item._id] ? 'rgba(var(--app-primary-rgb),0.05)' : '#fff',
                  border: selectedItems[item._id] ? '2px solid var(--app-primary)' : '2px solid rgba(var(--app-primary-rgb),0.1)',
                  borderRadius: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {item.name}
                    {item.isVeg && <EcoIcon sx={{ color: 'green', fontSize: 16, ml: 0.5 }} />}
                  </Typography>
                  {item.popular && <StarIcon sx={{ color: 'orange', fontSize: 16 }} />}
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {currencySym()}{item.price} • {item.category?.name || 'No Category'}
                </Typography>

                {item.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
                    {item.description.length > 60 ? `${item.description.substring(0, 60)}...` : item.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                  <Chip
                    label={item.isAvailable !== false ? 'Available' : 'Unavailable'}
                    color={item.isAvailable !== false ? 'success' : 'error'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  {item.preparationTime && (
                    <Chip label={`${item.preparationTime} mins`} variant="outlined" size="small" icon={<TimerIcon />} />
                  )}
                </Box>

                {/* Quantity Badge */}
                {selectedItems[item._id] && (
                  <Box sx={{
                    position: 'absolute', top: -8, right: -8,
                    backgroundColor: 'var(--app-primary)', color: 'white',
                    borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.875rem',
                    boxShadow: '0 4px 12px rgba(var(--app-primary-rgb),0.3)',
                    border: '2px solid white',
                  }}>
                    {selectedItems[item._id]}
                  </Box>
                )}

                {/* Quantity Controls - Show when item is selected */}
                {selectedItems[item._id] && (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 1, mt: 2, p: 1,
                    backgroundColor: 'rgba(var(--app-primary-rgb),0.1)', borderRadius: '12px',
                  }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => { e.stopPropagation(); onQuantityChange(item._id, selectedItems[item._id] - 1); }}
                      sx={{ minWidth: 32, width: 32, height: 32, borderRadius: '8px', p: 0 }}
                    >
                      <RemoveIcon fontSize="small" />
                    </Button>

                    <Typography variant="body1" sx={{ fontWeight: 700, minWidth: 24, textAlign: 'center', color: 'var(--app-primary)' }}>
                      {selectedItems[item._id]}
                    </Typography>

                    <Button
                      size="small"
                      variant="contained"
                      onClick={(e) => { e.stopPropagation(); onQuantityChange(item._id, selectedItems[item._id] + 1); }}
                      sx={{ minWidth: 32, width: 32, height: 32, borderRadius: '8px', p: 0, backgroundColor: 'var(--app-primary)' }}
                    >
                      <AddIcon fontSize="small" />
                    </Button>
                  </Box>
                )}
              </Card>
            </Grid>
            );
          })}
        </Grid>

        {filteredMenuItems.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">No menu items found</Typography>
            <Typography variant="body2" color="text.secondary">Try adjusting your search or filter criteria</Typography>
          </Box>
        )}
      </Box>

      {/* Order Summary */}
      {totalItemsCount > 0 && (
        <Box sx={{ mt: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: '12px', border: '2px solid rgba(var(--app-primary-rgb),0.1)' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#2c3e50' }}>
            Order Summary
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Total Items: {totalItemsCount}
            </Typography>

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{currencySym()}{subtotal.toFixed(2)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">GST:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{currencySym()}{gstAmount.toFixed(2)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2c3e50' }}>Total:</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--app-primary)' }}>{currencySym()}{totalPrice.toFixed(2)}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            {Object.entries(selectedItems).map(([itemId, quantity]) => {
              const item = menuItems.find((m) => m._id === itemId);
              if (!item) return null;

              return (
                <Box key={itemId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name} × {quantity}</Typography>
                    <Typography variant="caption" color="text.secondary">{currencySym()}{item.price} each</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{currencySym()}{item.price * quantity}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </FormSection>
  </FormDialog>
);

export default OrderDialog;
