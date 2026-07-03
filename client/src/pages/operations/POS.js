import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, IconButton,
  List, ListItem, ListItemText, TextField, Card, CardContent,
  Stack,
  Snackbar, Alert, Chip, FormControl, InputLabel, Select, MenuItem,
  Paper
} from '@mui/material';
import { 
  Add, Remove, Delete, Receipt, ArrowBack, ShoppingCart,
  Restaurant, Category, Payment, LocalDining,
} from '@mui/icons-material';
import api from '../../api';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '../../components/layout/PageLayout';
import FormDialog, { FormSection } from '../../components/forms/FormDialog';
import { useBilling } from '../../hooks/useBilling';
import { currencySym } from '../../utils/billing';
import { hotelIdentity } from '../../utils/hotelProfile';

const POS = () => {
  const navigate = useNavigate();
  const billing = useBilling();
  const posGstFrac = billing.posGstRate / 100;
  
  // State variables
  const [menuItems, setMenuItems] = useState([]);
  const [allMenuItems, setAllMenuItems] = useState([]); // Cache all items
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
    
  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });
  
  // Show snackbar message - wrapped in useCallback
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  }, []);
  
  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  // Load categories and menu items on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch categories
        const categoryResponse = await api.restaurant.getCategories();
        const categoriesData = categoryResponse.data || [];
        setCategories(categoriesData);
        
        // Fetch tables
        const tablesResponse = await api.restaurant.getTables();
        const tablesData = tablesResponse.data || [];
        setTables(tablesData);
        
        // Fetch all menu items
        const menuResponse = await api.restaurant.getMenuItems();
        const allMenuItems = menuResponse.data || [];
        
        // Set "all" as default selected category and show all menu items
        setSelectedCategory('all');
        
        // Cache all menu items
        setAllMenuItems(allMenuItems);
        
        // Sort all menu items alphabetically by name
        const sortedItems = [...allMenuItems].sort((a, b) => 
          a.name.localeCompare(b.name),
        );
        
        setMenuItems(sortedItems);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        showSnackbar('Failed to load data', 'error');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [showSnackbar]);
  
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    
    // Use cached menu items for instant filtering
    let filteredItems;
    
    if (categoryId === 'all') {
      // Show all menu items
      filteredItems = allMenuItems;
    } else {
      // Filter menu items for the selected category
      filteredItems = allMenuItems.filter(item => 
        item.category === categoryId || 
        item.categoryId === categoryId ||
        (item.category && item.category._id === categoryId),
      );
    }
    
    // Sort menu items alphabetically by name
    const sortedItems = [...filteredItems].sort((a, b) => 
      a.name.localeCompare(b.name),
    );
    
    setMenuItems(sortedItems);
  };
      
  // Handle opening receipt dialog
  const handleOpenReceiptDialog = (orderData) => {
    setCurrentReceipt(orderData);
    setOpenReceiptDialog(true);
  };
      
  // Handle closing receipt dialog
  const handleCloseReceiptDialog = () => {
    setOpenReceiptDialog(false);
  };
      
  // Build a standalone 80mm document for the thermal printer. Printing the
  // app page itself (window.print + visibility tricks) dragged the glass
  // background and the full page height along — dozens of blank pages.
  const buildReceiptHtml = (r) => {
    const id = hotelIdentity();
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const row = (left, right, cls = '') =>
      `<div class="row ${cls}"><span>${left}</span><span>${right}</span></div>`;

    const itemsHtml = (r.items || [])
      .map(
        (item) => `
      ${row(esc(item.name), `${currencySym()}${(item.price * item.quantity).toFixed(2)}`, 'bold')}
      <div class="row sub"><span>${item.quantity} x ${currencySym()}${item.price.toFixed(2)}</span><span></span></div>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(r.receiptNumber || r.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 80mm; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.3; }
  .receipt { width: 80mm; padding: 4mm 3mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sub { font-size: 10px; color: #444; padding-left: 8px; }
  .row { display: flex; justify-content: space-between; }
  .sep { border-top: 1px dashed #333; margin: 6px 0; }
  .total { border-top: 1px solid #333; margin-top: 4px; padding-top: 4px; font-size: 12px; font-weight: bold; }
  h1 { font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
  .small { font-size: 10px; }
  .tiny { font-size: 9px; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <h1>${esc(id.restaurantName)}</h1>
      <div class="small">${esc(id.restaurantTagline)}</div>
      <div class="tiny">Ph: ${esc(id.phone)}</div>
      <div class="tiny">GST: ${esc(id.restaurantGstin)}</div>
    </div>
    <div class="sep"></div>
    ${row(`Receipt: ${esc(r.receiptNumber || r.orderNumber)}`, new Date(r.orderDate).toLocaleDateString())}
    ${row(`Order: ${esc(r.orderNumber)}`, '')}
    ${row(`Time: ${new Date(r.orderDate).toLocaleTimeString()}`, 'POS')}
    <div>Customer: ${esc(r.customerName)}</div>
    ${r.customerPhone && r.customerPhone !== 'N/A' ? `<div>Phone: ${esc(r.customerPhone)}</div>` : ''}
    ${r.tableInfo
      ? `<div>Table: ${esc(r.tableInfo.number)} (${esc(r.tableInfo.capacity)} seats)</div>`
      : r.orderType === 'pos' ? '<div>Order Type: Takeaway/Counter</div>' : ''}
    <div class="sep"></div>
    ${itemsHtml}
    <div class="sep"></div>
    ${row('Subtotal:', `${currencySym()}${(r.subtotal ?? (r.totalAmount - (r.gst || 0)))?.toFixed(2)}`)}
    <div class="row sub"><span>GST (${billing.posGstRate}%):</span><span>${currencySym()}${r.gst?.toFixed(2)}</span></div>
    ${row('TOTAL:', `${currencySym()}${r.totalAmount?.toFixed(2)}`, 'total')}
    <div class="sep"></div>
    ${row('Payment:', esc((r.paymentMethod || '').toUpperCase()))}
    ${r.paymentMethod === 'cash' ? row('Cash Received:', `${currencySym()}${r.cashReceived?.toFixed(2)}`) : ''}
    ${r.paymentMethod === 'cash' && r.changeAmount > 0 ? row('Change:', `${currencySym()}${r.changeAmount?.toFixed(2)}`) : ''}
    <div class="sep"></div>
    <div class="center">
      <div class="bold">THANK YOU FOR VISITING!</div>
      <div class="small">Please visit again</div>
      <div class="tiny">Powered by Hotel Management System</div>
    </div>
  </div>
</body>
</html>`;
  };

  // Print through a hidden iframe so ONLY the receipt document is printed —
  // no app styles, no background underlay, exactly one 80mm-wide page.
  const handlePrintReceipt = () => {
    if (!currentReceipt) {
      showSnackbar('Receipt not ready for printing', 'error');
      return;
    }
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(buildReceiptHtml(currentReceipt));
    doc.close();

    // Let the iframe lay out, print it, then clean up after the dialog closes.
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => document.body.removeChild(frame), 1000);
    }, 150);
  };
  
  // Add item to cart
  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem._id === item._id);
    
    if (existingItem) {
      // Update quantity if item already in cart
      setCart(cart.map(cartItem => 
        cartItem._id === item._id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 } 
          : cartItem,
      ));
    } else {
      // Add new item to cart
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };
  
  // Update item quantity in cart
  const updateQuantity = (itemId, change) => {
    const updatedCart = cart.map(item => {
      if (item._id === itemId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean); // Remove items with quantity 0
    
    setCart(updatedCart);
  };
  
  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item._id !== itemId));
  };
  
  // Calculate subtotal
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };
  
  // Calculate GST using the configured POS rate — menu prices are BASE prices, tax added on top
  const calculateGST = () => {
    return calculateSubtotal() * posGstFrac;
  };

  // Total payable = base subtotal + GST
  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST();
  };
  
  // Calculate change amount
  const calculateChange = () => {
    const cashAmount = parseFloat(cashReceived) || 0;
    const totalAmount = calculateTotal();
    return cashAmount > totalAmount ? cashAmount - totalAmount : 0;
  };
  
  // Handle payment dialog open
  const handleOpenPaymentDialog = () => {
    if (cart.length === 0) {
      showSnackbar('Please add items to cart first', 'error');
      return;
    }
    setOpenPaymentDialog(true);
  };
  
  // Handle payment dialog close
  const handleClosePaymentDialog = () => {
    setOpenPaymentDialog(false);
    // Reset form fields
    setCashReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedTable('');
  };
  
  // Process payment and create order
  const handleProcessPayment = async () => {
    if (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < calculateTotal())) {
      showSnackbar('Cash received must be greater than or equal to total amount', 'error');
      return;
    }
        
    try {
      setLoading(true);
          
      // Format items for the order
      const orderItems = cart.map(item => ({
        itemId: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));
          
      // Create order data
      const orderData = {
        orderType: selectedTable ? 'table' : 'pos',
        tableId: selectedTable || null,
        items: orderItems,
        subtotal: calculateSubtotal(),
        totalAmount: calculateTotal(),
        gst: calculateGST(),
        gstIncluded: false, // base prices — 5% GST added on top
        status: 'Completed',
        paymentMethod: paymentMethod,
        cashReceived: parseFloat(cashReceived) || 0,
        changeAmount: calculateChange(),
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || 'N/A',
        orderDate: new Date().toISOString(),
      };
          
      // Close payment dialog first to prevent message channel issues
      handleClosePaymentDialog();
          
      // Create order
      const response = await api.restaurant.createOrder(orderData);

      // Only a server-confirmed order gets a receipt — never fabricate one.
      const savedOrder = response?.data;
      if (!savedOrder?._id || !savedOrder?.orderNumber) {
        throw new Error('Order was not confirmed by the server');
      }

      const selectedTableInfo = selectedTable ? tables.find(t => t._id === selectedTable) : null;
      const receiptData = {
        ...orderData,
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        // Dedicated receipt record issued by the server (RCPT-YYMMDD-###)
        receiptNumber: savedOrder.receipt?.receiptNumber || null,
        tableInfo: selectedTableInfo,
      };
          
      // Reset cart and form
      setCart([]);
      setCashReceived('');
      setCustomerName('');
      setCustomerPhone('');
      setSelectedTable('');
      setPaymentMethod('cash');
          
      setLoading(false);
          
      // Show success message
      showSnackbar('Order completed successfully', 'success');
          
      // Show receipt dialog after a small delay to ensure UI updates
      setTimeout(() => {
        handleOpenReceiptDialog(receiptData);
      }, 100);
          
    } catch (error) {
      console.error('Error processing payment:', error);
      showSnackbar('Failed to process payment', 'error');
      setLoading(false);
    }
  };
  
  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{
          mb: 3,
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
          backdropFilter: 'var(--app-blur)',
          WebkitBackdropFilter: 'var(--app-blur)',
          border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Restaurant sx={{ fontSize: 40, color: 'var(--app-primary)' }} />
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: 'var(--app-primary)' }}>
                Point of Sale
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(var(--app-primary-rgb),0.8)' }}>
                Quick billing and order management
              </Typography>
            </Box>
          </Stack>
        </Box>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Grid container spacing={3}>
          {/* Left Panel - Categories */}
          <Grid item xs={12} md={2.5}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              style={{ height: '100%' }}
            >
              <Paper sx={{
                background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)',
                borderRadius: '24px',
                p: 3,
                height: { xs: 'auto', md: '70vh' },
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              }}>
                <Typography variant="h6" gutterBottom sx={{
                  fontWeight: 700,
                  color: '#23272f',
                  mb: 3,
                  textAlign: 'center',
                  letterSpacing: 1,
                }}>
                  <Category sx={{ mr: 1, verticalAlign: 'middle', color: 'var(--app-primary)' }} />
                  Categories
                </Typography>
                <Stack spacing={2}>
                  <Button
                    variant={selectedCategory === 'all' ? 'contained' : 'outlined'}
                    onClick={() => handleCategorySelect('all')}
                    sx={{
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5,
                      background: selectedCategory === 'all' 
                        ? 'rgba(var(--app-primary-rgb),0.12)' 
                        : 'transparent',
                      color: selectedCategory === 'all' ? 'var(--app-primary)' : '#23272f',
                      border: '1px solid rgba(var(--app-primary-rgb),0.2)',
                      '&:hover': {
                        background: 'rgba(var(--app-primary-rgb),0.08)',
                        border: '1px solid rgba(var(--app-primary-rgb),0.3)',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    All Items
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category._id}
                      variant={selectedCategory === category._id ? 'contained' : 'outlined'}
                      onClick={() => handleCategorySelect(category._id)}
                      sx={{
                        borderRadius: '16px',
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 1.5,
                        background: selectedCategory === category._id 
                          ? 'rgba(var(--app-primary-rgb),0.12)' 
                          : 'transparent',
                        color: selectedCategory === category._id ? 'var(--app-primary)' : '#23272f',
                        border: '1px solid rgba(var(--app-primary-rgb),0.2)',
                        '&:hover': {
                          background: 'rgba(var(--app-primary-rgb),0.08)',
                          border: '1px solid rgba(var(--app-primary-rgb),0.3)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      {category.name}
                    </Button>
                  ))}
                </Stack>
              </Paper>
            </motion.div>
          </Grid>

          {/* Center Panel - Menu Items */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ height: '100%' }}
            >
              <Paper sx={{
                background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)',
                borderRadius: '24px',
                p: 3,
                height: { xs: 'auto', md: '70vh' },
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              }}>
                <Typography variant="h6" gutterBottom sx={{
                  fontWeight: 700,
                  color: '#23272f',
                  mb: 3,
                  textAlign: 'center',
                  letterSpacing: 1,
                }}>
                  <LocalDining sx={{ mr: 1, verticalAlign: 'middle', color: 'var(--app-primary)' }} />
                  Menu Items
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60%' }}>
                    <Typography sx={{ color: '#23272f' }}>Loading menu items...</Typography>
                  </Box>
                ) : menuItems.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60%' }}>
                    <Typography sx={{ color: '#23272f' }}>No items found in this category</Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    <AnimatePresence>
                      {menuItems.map(item => (
                        <Grid item xs={6} sm={4} md={3} key={item._id}>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            whileHover={{ scale: 1.05 }}
                          >
                            <Card
                              sx={{
                                height: 120,
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: '16px',
                                background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                                backdropFilter: 'var(--app-blur)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                  background: 'rgba(255,255,255,0.12)',
                                  transform: 'translateY(-4px) scale(1.02)',
                                  boxShadow: '0 8px 25px rgba(var(--app-primary-rgb),0.15)',
                                },
                              }}
                              onClick={() => addToCart(item)}
                            >
                              <CardContent sx={{
                                p: 1.5,
                                '&:last-child': { pb: 1.5 },
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                height: '100%',
                                position: 'relative',
                              }}>
                                <Chip
                                  label={item.isVeg ? "Veg" : "Non-Veg"}
                                  size="small"
                                  sx={{
                                    bgcolor: item.isVeg ? '#4caf50' : '#f44336',
                                    color: 'white',
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: 18,
                                  }}
                                />
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 700,
                                    color: '#23272f',
                                    fontSize: 13,
                                    lineHeight: 1.25,
                                    mb: 0.5,
                                    mt: 1.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {item.name}
                                </Typography>
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 700,
                                    color: 'var(--app-primary)',
                                    fontSize: 15,
                                  }}
                                >
                                  {currencySym()}{item.price.toFixed(2)}
                                </Typography>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </Grid>
                      ))}
                    </AnimatePresence>
                  </Grid>
                )}
              </Paper>
            </motion.div>
          </Grid>

          {/* Right Panel - Cart */}
          <Grid item xs={12} md={3.5}>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ height: '100%' }}
            >
              <Paper sx={{
                background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
                backdropFilter: 'var(--app-blur)',
                WebkitBackdropFilter: 'var(--app-blur)',
                borderRadius: '24px',
                p: 3,
                height: { xs: 'auto', md: '70vh' },
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <Typography variant="h6" gutterBottom sx={{
                  fontWeight: 700,
                  color: '#23272f',
                  mb: 3,
                  textAlign: 'center',
                  letterSpacing: 1,
                }}>
                  <ShoppingCart sx={{ mr: 1, verticalAlign: 'middle', color: 'var(--app-primary)' }} />
                  Order Summary
                </Typography>

                <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', mb: 2 }}>
                  {cart.length === 0 ? (
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '200px',
                      color: 'rgba(35, 39, 47, 0.7)',
                    }}>
                      <ShoppingCart sx={{ fontSize: 60, mb: 2, opacity: 0.5, color: 'var(--app-primary)' }} />
                      <Typography variant="h6" sx={{ mb: 1, color: '#23272f' }}>Your cart is empty</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(35, 39, 47, 0.7)' }}>Add items from the menu</Typography>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      <AnimatePresence>
                        {cart.map(item => (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ListItem
                              sx={{
                                py: 1.5,
                                px: 2,
                                mb: 1,
                                borderRadius: '12px',
                                background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                                border: '1px solid rgba(255,255,255,0.12)',
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Typography variant="body1" fontWeight="600" sx={{ color: '#23272f' }}>
                                    {item.name}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="body2" sx={{ color: 'rgba(35, 39, 47, 0.7)' }}>
                                    {currencySym()}{item.price.toFixed(2)} x {item.quantity} = {currencySym()}{(item.price * item.quantity).toFixed(2)}
                                  </Typography>
                                }
                              />
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => updateQuantity(item._id, -1)}
                                  sx={{
                                    background: 'rgba(var(--app-primary-rgb),0.12)',
                                    color: 'var(--app-primary)',
                                    '&:hover': { background: 'rgba(var(--app-primary-rgb),0.2)' },
                                    width: 28,
                                    height: 28,
                                  }}
                                >
                                  <Remove fontSize="small" />
                                </IconButton>
                                <Typography sx={{ mx: 1, color: '#23272f', minWidth: '24px', textAlign: 'center' }}>
                                  {item.quantity}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => updateQuantity(item._id, 1)}
                                  sx={{
                                    background: 'rgba(var(--app-primary-rgb),0.12)',
                                    color: 'var(--app-primary)',
                                    '&:hover': { background: 'rgba(var(--app-primary-rgb),0.2)' },
                                    width: 28,
                                    height: 28,
                                  }}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => removeFromCart(item._id)}
                                  sx={{
                                    ml: 1,
                                    color: '#f44336',
                                    '&:hover': { background: 'rgba(244, 67, 54, 0.1)' },
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            </ListItem>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </List>
                  )}
                </Box>

                {/* Totals */}
                <Box sx={{
                  p: 2,
                  background: 'rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  mt: 'auto',
                }}>
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ color: 'rgba(35, 39, 47, 0.8)' }}>Subtotal:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right" fontWeight="600" sx={{ color: '#23272f' }}>
                        {currencySym()}{calculateSubtotal().toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ color: 'rgba(35, 39, 47, 0.6)' }}>GST ({billing.posGstRate}%):</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right" fontWeight="600" sx={{ color: 'rgba(35, 39, 47, 0.6)' }}>
                        {currencySym()}{calculateGST().toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h6" sx={{ color: 'var(--app-primary)', fontWeight: 700 }}>Total:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h6" align="right" sx={{ color: 'var(--app-primary)', fontWeight: 700 }}>
                        {currencySym()}{calculateTotal().toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<ArrowBack />}
                      onClick={() => navigate('/restaurant')}
                      sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        color: '#23272f',
                        borderColor: 'rgba(var(--app-primary-rgb),0.3)',
                        '&:hover': {
                          borderColor: 'rgba(var(--app-primary-rgb),0.5)',
                          background: 'rgba(var(--app-primary-rgb),0.08)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Payment />}
                      onClick={handleOpenPaymentDialog}
                      disabled={cart.length === 0}
                      sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        flex: 1,
                        background: 'var(--app-primary)',
                        '&:hover': {
                          background: 'var(--app-primary)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(var(--app-primary-rgb),0.3)',
                        },
                        '&:disabled': {
                          background: 'rgba(var(--app-primary-rgb),0.3)',
                          color: 'rgba(255,255,255,0.7)',
                        },
                      }}
                    >
                      Process Payment
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </motion.div>
          </Grid>
        </Grid>
      </motion.div>

      {/* Payment Dialog */}
      <FormDialog
        open={openPaymentDialog}
        onClose={handleClosePaymentDialog}
        onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); handleProcessPayment(); }}
        maxWidth="sm"
        icon={<Payment />}
        eyebrow="Point of Sale"
        title="Process Payment"
        submitDisabled={loading || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < calculateTotal()))}
        submitLabel={loading ? 'Processing...' : 'Complete Payment'}
      >
        <FormSection title="Payment Details" icon={<Payment fontSize="small" />} iconColor="#10b981">
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  label="Payment Method"
                >
                  <MenuItem value="cash">💵 Cash</MenuItem>
                  <MenuItem value="card">💳 Card</MenuItem>
                  <MenuItem value="upi">📱 UPI</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {paymentMethod === 'cash' && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Cash Received"
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>{currencySym()}</Typography>,
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1">Change Amount:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" align="right" fontWeight="bold" color="primary">
                    {currencySym()}{calculateChange().toFixed(2)}
                  </Typography>
                </Grid>
              </>
            )}
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Customer Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Customer Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Table Number (Optional)</InputLabel>
                <Select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  label="Table Number (Optional)"
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: 'white',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        border: '1px solid #e0e0e0',
                        '& .MuiMenuItem-root': {
                          backgroundColor: 'white',
                          color: '#333',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                          },
                          '&.Mui-selected': {
                            backgroundColor: '#667eea',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: '#5a6fd8',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>None - Takeaway/Counter</em>
                  </MenuItem>
                  {tables.map((table) => (
                    <MenuItem key={table._id} value={table._id}>
                      🪑 Table {table.number} ({table.capacity} seats)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>

      {/* Thermal Receipt Dialog */}
      <FormDialog
        open={openReceiptDialog}
        onClose={handleCloseReceiptDialog}
        maxWidth="xs"
        icon={<Receipt />}
        eyebrow="Point of Sale"
        title="Receipt"
        hideCancel
        submitLabel="Close"
        extraActions={(
          <Button
            onClick={handlePrintReceipt}
            variant="outlined"
            startIcon={<Receipt />}
            sx={{ mr: 'auto', borderRadius: '12px', textTransform: 'none' }}
          >
            Print Receipt
          </Button>
        )}
      >
        <FormSection>
          {currentReceipt && (
            <Box 
              id="thermal-receipt"
              sx={{
                width: '320px',
                background: 'white',
                color: 'black',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.2,
                p: 2,
                '@media print': {
                  width: '80mm',
                  fontSize: '10px',
                  margin: 0,
                  padding: '8px',
                },
              }}
            >
              {/* Header */}
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography sx={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {hotelIdentity().restaurantName}
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '11px', mt: 0.5 }}>
                  {hotelIdentity().restaurantTagline}
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '10px' }}>
                  Ph: {hotelIdentity().phone}
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '10px' }}>
                  GST: {hotelIdentity().restaurantGstin}
                </Typography>
              </Box>

              {/* Separator */}
              <Box sx={{ borderTop: '1px dashed #333', my: 1 }} />

              {/* Order Details */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>Receipt: {currentReceipt.receiptNumber || currentReceipt.orderNumber}</span>
                  <span>{new Date(currentReceipt.orderDate).toLocaleDateString()}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>Order: {currentReceipt.orderNumber}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>Time: {new Date(currentReceipt.orderDate).toLocaleTimeString()}</span>
                  <span>POS</span>
                </Box>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                  Customer: {currentReceipt.customerName}
                </Typography>
                {currentReceipt.customerPhone !== 'N/A' && (
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    Phone: {currentReceipt.customerPhone}
                  </Typography>
                )}
                {currentReceipt.tableInfo && (
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    Table: {currentReceipt.tableInfo.number} ({currentReceipt.tableInfo.capacity} seats)
                  </Typography>
                )}
                {!currentReceipt.tableInfo && currentReceipt.orderType === 'pos' && (
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    Order Type: Takeaway/Counter
                  </Typography>
                )}
              </Box>

              {/* Separator */}
              <Box sx={{ borderTop: '1px dashed #333', my: 1 }} />

              {/* Items */}
              <Box sx={{ mb: 1 }}>
                {currentReceipt.items?.map((item, index) => (
                  <Box key={index} sx={{ mb: 0.5 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      <span>{item.name}</span>
                      <span>{currencySym()}{(item.price * item.quantity).toFixed(2)}</span>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      color: '#666',
                      pl: 1
                    }}>
                      <span>{item.quantity} x {currencySym()}{item.price.toFixed(2)}</span>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Separator */}
              <Box sx={{ borderTop: '1px dashed #333', my: 1 }} />

              {/* Totals */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>Subtotal:</span>
                  <span>{currencySym()}{(currentReceipt.subtotal ?? (currentReceipt.totalAmount - (currentReceipt.gst || 0)))?.toFixed(2)}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '10px', color: '#666' }}>
                  <span>GST ({billing.posGstRate}%):</span>
                  <span>{currencySym()}{currentReceipt.gst?.toFixed(2)}</span>
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontFamily: 'monospace', 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderTop: '1px solid #333',
                  pt: 0.5,
                  mt: 0.5
                }}>
                  <span>TOTAL:</span>
                  <span>{currencySym()}{currentReceipt.totalAmount?.toFixed(2)}</span>
                </Box>
              </Box>

              {/* Payment Details */}
              <Box sx={{ borderTop: '1px dashed #333', my: 1 }} />
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span>Payment:</span>
                  <span>{currentReceipt.paymentMethod?.toUpperCase()}</span>
                </Box>
                {currentReceipt.paymentMethod === 'cash' && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                      <span>Cash Received:</span>
                      <span>{currencySym()}{currentReceipt.cashReceived?.toFixed(2)}</span>
                    </Box>
                    {currentReceipt.changeAmount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px' }}>
                        <span>Change:</span>
                        <span>{currencySym()}{currentReceipt.changeAmount?.toFixed(2)}</span>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              {/* Footer */}
              <Box sx={{ borderTop: '1px dashed #333', my: 1 }} />
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold' }}>
                  THANK YOU FOR VISITING!
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '10px', mt: 0.5 }}>
                  Please visit again
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '9px', mt: 1, color: '#666' }}>
                  Powered by Hotel Management System
                </Typography>
              </Box>

              {/* QR Code placeholder */}
              <Box sx={{ textAlign: 'center', mt: 2, mb: 1 }}>
                <Box sx={{ 
                  width: '80px', 
                  height: '80px', 
                  border: '2px solid #333',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  backgroundColor: 'white',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    right: '10px',
                    bottom: '10px',
                    border: '1px solid #333',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    right: '20px',
                    bottom: '20px',
                    border: '1px solid #333',
                  }
                }}>
                  <Box sx={{ 
                    position: 'relative', 
                    zIndex: 3,
                    fontSize: '8px',
                    textAlign: 'center',
                    lineHeight: 1
                  }}>
                    QR<br/>CODE
                  </Box>
                </Box>
                <Typography sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '9px', 
                  mt: 1,
                  fontWeight: 'bold'
                }}>
                  SCAN FOR FEEDBACK
                </Typography>
              </Box>
            </Box>
          )}
        </FormSection>
      </FormDialog>


      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: '12px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default POS;
      