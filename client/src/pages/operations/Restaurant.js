import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  Avatar,
} from '@mui/material';
import {
  MenuBook as MenuIcon,
  TableBar as TableIcon,
  ShoppingCart as OrderIcon,
  Restaurant as RestaurantIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import PageLayout from '../../components/layout/PageLayout';
import { containerVariants, itemVariants } from './restaurant/animations';
import MenuItemDialog from './restaurant/dialogs/MenuItemDialog';
import TableDialog from './restaurant/dialogs/TableDialog';
import CategoryDialog from './restaurant/dialogs/CategoryDialog';
import CSVUploadDialog from './restaurant/dialogs/CSVUploadDialog';
import OrderDialog from './restaurant/dialogs/OrderDialog';
import MenuFilters from './restaurant/MenuFilters';
import MenuItemsTab from './restaurant/tabs/MenuItemsTab';
import TablesTab from './restaurant/tabs/TablesTab';
import OrdersTab from './restaurant/tabs/OrdersTab';
import api from '../../api';
import { useSettings } from '../../contexts/SettingsContext';
import { useBilling } from '../../hooks/useBilling';

const Restaurant = () => {
  const { settings } = useSettings();
  const billing = useBilling();
  const _cardStyle = settings?.theme?.cardStyle || 'rounded';
  const _accentColor = settings?.theme?.accentColor || '#F59E42';
  const fontFamily = settings?.theme?.fontFamily;
  const fontSize = settings?.theme?.fontSize;
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  // Order status management states
  const [statusFilter, setStatusFilter] = useState('All');
  const [orderStatusUpdating, setOrderStatusUpdating] = useState({});
  const [timerTime, setTimerTime] = useState(new Date());
  
  // Use ref to track if data has been fetched
  const dataFetchedRef = useRef(false);
  
  // Dialog states
  const [openMenuItemDialog, setOpenMenuItemDialog] = useState(false);
  const [openTableDialog, setOpenTableDialog] = useState(false);
  const [openOrderDialog, setOpenOrderDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [openCSVDialog, setOpenCSVDialog] = useState(false);
  
  // Form states
  const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    isVeg: true,
    preparationTime: 15,
    popular: false,
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    displayOrder: 1,
    isVegOnly: false,
  });
  
  const [tableForm, setTableForm] = useState({
    number: '',
    capacity: 4,
    floor: 'Ground Floor',
    status: 'Available',
    section: 'Main',
    notes: '',
  });

  const [orderForm, setOrderForm] = useState({
    tableId: '',
    roomId: '',
    orderType: 'table', // 'table' or 'room'
    items: [],
    specialInstructions: '',
    status: 'Pending',
  });

  // Track selected items and their quantities
  const [selectedItems, setSelectedItems] = useState({});

  // Menu item search and filter states
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All'); // 'All' or a category id (menu filter only)
  const [editingCategory, setEditingCategory] = useState(null); // category being edited in the dialog
  const [showVegOnly, setShowVegOnly] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'popular'

  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(menuSearchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [menuSearchTerm]);
  
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [csvFile, setCSVFile] = useState(null);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });


  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Memoized menu item filtering and searching logic
  const filteredMenuItems = useMemo(() => {
    let filtered = [...menuItems];

    // Search by name or description
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => 
        item.category && item.category._id === selectedCategory
      );
    }

    // Filter by vegetarian
    if (showVegOnly) {
      filtered = filtered.filter(item => item.isVeg === true);
    }

    // Filter by availability
    if (showAvailableOnly) {
      filtered = filtered.filter(item => item.isAvailable !== false);
    }

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.price || 0) - (b.price || 0);
        case 'popular':
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return a.name.localeCompare(b.name);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [menuItems, debouncedSearchTerm, selectedCategory, showVegOnly, showAvailableOnly, sortBy]);

  // Reset filters
  const resetFilters = () => {
    setMenuSearchTerm('');
    setSelectedCategory('All');
    setShowVegOnly(false);
    setShowAvailableOnly(true);
    setSortBy('name');
  };

  // Handle item selection
  const handleItemClick = (item) => {
    if (item.isAvailable === false) {
      showSnackbar(`${item.name} is out of stock`, 'warning');
      return;
    }
    setSelectedItems(prev => {
      const currentQuantity = prev[item._id] || 0;
      const newQuantity = currentQuantity + 1;

      return {
        ...prev,
        [item._id]: newQuantity
      };
    });
  };

  // Handle quantity change
  const handleQuantityChange = (itemId, quantity) => {
    if (quantity <= 0) {
      setSelectedItems(prev => {
        const newItems = { ...prev };
        delete newItems[itemId];
        return newItems;
      });
    } else {
      setSelectedItems(prev => ({
        ...prev,
        [itemId]: quantity
      }));
    }
  };

  // Get total items count
  const getTotalItemsCount = () => {
    return Object.values(selectedItems).reduce((total, quantity) => total + quantity, 0);
  };

  // Get subtotal (before GST)
  const getSubtotal = () => {
    return Object.entries(selectedItems).reduce((total, [itemId, quantity]) => {
      const item = menuItems.find(item => item._id === itemId);
      return total + (item ? item.price * quantity : 0);
    }, 0);
  };

  // Get GST amount using the configured POS GST rate (Billing & Tariff),
  // kept to 2-decimal (paise) precision as before.
  const getGSTAmount = () => {
    const subtotal = getSubtotal();
    return Math.round(subtotal * (billing.posGstRate / 100) * 100) / 100;
  };

  // Get total price (subtotal + GST)
  const getTotalPrice = () => {
    return getSubtotal() + getGSTAmount();
  };

  // Handle create order
  const handleCreateOrder = async () => {
    try {
      // Validate order form
      if (orderForm.orderType === 'room' && !orderForm.roomId) {
        showSnackbar('Please select a room for room service', 'error');
        return;
      }
      
      if (orderForm.orderType === 'table' && !orderForm.tableId) {
        showSnackbar('Please select a table for table service', 'error');
        return;
      }

      if (getTotalItemsCount() === 0) {
        showSnackbar('Please select at least one item', 'error');
        return;
      }

      // Prepare order data based on existing order structure
      const orderItems = Object.entries(selectedItems).map(([itemId, quantity]) => {
        const item = menuItems.find(item => item._id === itemId);
        return {
          itemId: itemId, // Required by Order model
          name: item?.name || 'Unknown Item',
          quantity: parseInt(quantity),
          price: parseFloat(item?.price || 0)
        };
      });

      // Calculate subtotal (before GST)
      const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Calculate GST using the configured POS rate
      const gstAmount = Math.round(subtotal * (billing.posGstRate / 100) * 100) / 100; // Round to 2 decimal places
      
      // Calculate total amount (subtotal + GST)
      const totalAmount = subtotal + gstAmount;

      // Prepare complete order structure
      const orderData = {
        items: orderItems,
        totalAmount: totalAmount,
        gst: gstAmount,
        orderType: orderForm.orderType,
        status: 'Pending'
      };

      // Add table or room ID based on order type
      if (orderForm.orderType === 'table' && orderForm.tableId) {
        orderData.tableId = orderForm.tableId;
      } else if (orderForm.orderType === 'room' && orderForm.roomId) {
        orderData.roomId = orderForm.roomId;
      }

      // Add special instructions if provided
      if (orderForm.specialInstructions?.trim()) {
        orderData.specialInstructions = orderForm.specialInstructions.trim();
      }

      let response;
      if (selectedOrder) {
        // Update existing order
        response = await api.restaurant.updateOrder(selectedOrder._id, orderData);
      } else {
        // Create new order
        response = await api.restaurant.createOrder(orderData);
      }
      
      if (response && response.data) {
        showSnackbar(selectedOrder ? 'Order updated successfully!' : 'Order created successfully!', 'success');
        
        // Refresh orders data
        await fetchData();
        
        // Close dialog and reset form
        setOpenOrderDialog(false);
        setSelectedItems({});
        setOrderForm({
          tableId: '',
          roomId: '',
          orderType: 'table',
          items: [],
          specialInstructions: '',
          status: 'Pending',
        });
      } else {
        throw new Error('Invalid response from server');
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      
      // Get more detailed error information
      let errorMessage = 'Unknown error';
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
        console.error('Server error details:', error.response.data);
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'No response from server';
      } else {
        // Something else happened
        errorMessage = error.message || 'Request failed';
      }
      
      showSnackbar('Failed to create order: ' + errorMessage, 'error');
    }
  };

  // Render menu item search and filter controls (shared toolbar component)
  const renderMenuItemFilters = () => (
    <MenuFilters
      menuSearchTerm={menuSearchTerm}
      setMenuSearchTerm={setMenuSearchTerm}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      categories={categories}
      sortBy={sortBy}
      setSortBy={setSortBy}
      showVegOnly={showVegOnly}
      setShowVegOnly={setShowVegOnly}
      showAvailableOnly={showAvailableOnly}
      setShowAvailableOnly={setShowAvailableOnly}
      resetFilters={resetFilters}
      filteredCount={filteredMenuItems.length}
      totalCount={menuItems.length}
    />
  );

  // Tab change handler
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTableStatusChange = async (tableId, newStatus) => {
    try {
      // Create update data with status and timestamp if occupied
      const updateData = { 
        status: newStatus, 
      };
      
      // Add occupiedAt timestamp when setting to Occupied
      if (newStatus === 'Occupied') {
        updateData.occupiedAt = new Date().toISOString();
      }
      
      await api.tables.updateTable(tableId, updateData);
      
      // Update the tables array with the new status and timestamp
      setTables(prevTables => 
        prevTables.map(table => 
          table._id === tableId ? { 
            ...table, 
            status: newStatus,
            ...(newStatus === 'Occupied' ? { occupiedAt: new Date().toISOString() } : {}),
          } : table,
        ),
      );
      
      showSnackbar(`Table status changed to ${newStatus}`);
    } catch (error) {
      showSnackbar('Failed to update table status', 'error');
    }
  };

  // Update the seated guest count on an occupied table (drives the dining charge).
  const handleTableGuestsChange = async (tableId, guests) => {
    const safe = Math.min(50, Math.max(1, Number(guests) || 1));
    // Optimistic update so the running bill responds instantly.
    setTables(prevTables =>
      prevTables.map(table =>
        table._id === tableId ? { ...table, guests: safe } : table,
      ),
    );
    try {
      await api.tables.updateTable(tableId, { guests: safe });
    } catch (error) {
      showSnackbar('Failed to update guest count', 'error');
    }
  };

  // Collect the final bill and free the table (clears the timer + guest count).
  // The server completes the table's active orders and records the collected
  // dine-in bill in accounting, so the "table transaction" lands in the books.
  const handleTableSettle = async (table, amount) => {
    const collected = `${billing.currencySymbol}${(Number(amount) || 0).toLocaleString('en-IN')}`;
    // Optimistic: drop the table back to Available right away.
    setTables(prevTables =>
      prevTables.map(t =>
        t._id === table._id ? { ...t, status: 'Available', occupiedAt: null, guests: 2 } : t,
      ),
    );
    try {
      await api.tables.settleTable(table._id, {
        collectedTotal: Number(amount) || 0,
        paymentMethod: 'cash',
      });
      showSnackbar(`Collected ${collected} — Table ${table.number} is now available`);
      await fetchData(); // reconcile with server (orders completed, table freed)
    } catch (error) {
      showSnackbar('Failed to settle table', 'error');
      await fetchData(); // roll back the optimistic change on failure
    }
  };

  // Move fetchData outside useEffect so it can be reused
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch existing data
      const [menuResponse, categoryResponse, tableResponse, orderResponse] = await Promise.all([
        api.restaurant.getMenuItems(),
        api.restaurant.getCategories(),
        api.tables.getAll(),
        api.restaurant.getAll(),
      ]);
      
      // Fetch bookings with status "CheckedIn" to get occupied rooms
      const bookingsResponse = await api.bookings.getAll();
      const occupiedRooms = [];
      
      // Handle different response structures
      let bookingsData = [];
      if (bookingsResponse && bookingsResponse.data && bookingsResponse.data.data) {
        bookingsData = Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [bookingsResponse.data.data];
      } else if (bookingsResponse && bookingsResponse.data) {
        bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [bookingsResponse.data];
      }
      
      // Process bookings to get occupied rooms
      if (Array.isArray(bookingsData)) {
        for (const booking of bookingsData) {
          if (booking && booking.bookingStatus === 'Confirmed' && booking.roomId) {
            let roomData = {
              roomNumber: 'Unknown',
              guestName: booking.guestName || 'Unknown Guest',
              checkIn: booking.checkInDate || 'Unknown',
              checkOut: booking.checkOutDate || 'Unknown',
            };
            
            // Handle different roomId structures
            if (typeof booking.roomId === 'object' && booking.roomId.number) {
              roomData.roomNumber = booking.roomId.number;
            } else if (typeof booking.roomId === 'string') {
              roomData.roomNumber = booking.roomId;
            }
            occupiedRooms.push(roomData);
          }
        }
      }
      
      setMenuItems(menuResponse.data || []);
      setCategories(categoryResponse.data || []);
      setTables(tableResponse.data || []);
      setOrders(orderResponse.data || []);
      setRooms(occupiedRooms);
      
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
      // Reset the ref if there was an error so we can retry
      dataFetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data once when component mounts
    if (dataFetchedRef.current) {
      return;
    }
    
    // Mark as fetched immediately to prevent double execution
    dataFetchedRef.current = true;
    
    const _initialFetch = async () => {
      setLoading(true);
      try {
        // Fetch existing data
        const [menuResponse, categoryResponse, tableResponse, orderResponse] = await Promise.all([
          api.restaurant.getMenuItems(),
          api.restaurant.getCategories(),
          api.tables.getAll(),
          api.restaurant.getAll(),
        ]);
        
        // Fetch bookings with status "CheckedIn" to get occupied rooms
        const bookingsResponse = await api.bookings.getAll();
        const occupiedRooms = [];
        
        // Handle different response structures
        let bookingsData = [];
        if (bookingsResponse && bookingsResponse.data && bookingsResponse.data.data) {
          bookingsData = Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [bookingsResponse.data.data];
        } else if (bookingsResponse && bookingsResponse.data) {
          bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [bookingsResponse.data];
        } else if (bookingsResponse && Array.isArray(bookingsResponse)) {
          bookingsData = bookingsResponse;
        } else if (bookingsResponse && bookingsResponse.bookings) {
          bookingsData = Array.isArray(bookingsResponse.bookings) ? bookingsResponse.bookings : [bookingsResponse.bookings];
        }
        
        // Extract room information from bookings that are checked in
        if (bookingsData && bookingsData.length > 0) {
          for (const booking of bookingsData) {
            // Only include bookings that are currently checked in (not completed/checked out)
            if (booking.status === 'CheckedIn' || booking.bookingStatus === 'Confirmed') {
              const roomData = {
                _id: booking._id, // Use booking ID as the room identifier
                number: booking.roomId?.roomNumber || booking.roomNumber || `Room ${booking._id.substring(0, 4)}`,
                type: booking.roomId?.type || booking.roomType || 'Standard',
                guestName: booking.guestName || 'Unknown Guest',
                bookingId: booking._id,
                roomId: booking.roomId?._id || booking.roomId, // Store actual room ID
              };
              occupiedRooms.push(roomData);
            }
          }
        }
        
        setMenuItems(menuResponse.data || []);
        setCategories(categoryResponse.data || []);
        setTables(tableResponse.data || []);
        setOrders(orderResponse.data || []);
        setRooms(occupiedRooms);
        
      } catch (error) {
        showSnackbar('Failed to load data', 'error');
        // Reset the ref if there was an error so we can retry
        dataFetchedRef.current = false;
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      // Reset the ref on unmount so fresh data can be loaded on next mount
      dataFetchedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Real-time timer for order status tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);


  // Defensive: show spinner if settings is not loaded (after all hooks)
  if (!settings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  // Show loading spinner while data is being fetched
  if (loading) {
    return (
      <PageLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      </PageLayout>
    );
  }

  // Menu Item Dialog Handlers
  const handleMenuItemDialog = (menuItem = null) => {
    if (menuItem) {
      setSelectedMenuItem(menuItem);
      setMenuItemForm({
        name: menuItem.name || '',
        description: menuItem.description || '',
        price: menuItem.price || '',
        category: menuItem.category?._id || '',
        isVeg: menuItem.isVeg === true,
        preparationTime: menuItem.preparationTime || 15,
        popular: menuItem.popular || false,
      });
    } else {
      setSelectedMenuItem(null);
      setMenuItemForm({
        name: '',
        description: '',
        price: '',
        category: categories.length > 0 ? categories[0]._id : '',
        isVeg: true,
        preparationTime: 15,
        popular: false,
      });
    }
    setOpenMenuItemDialog(true);
  };

  const handleCloseMenuItemDialog = () => {
    setOpenMenuItemDialog(false);
    setSelectedMenuItem(null);
  };

  const handleMenuItemSubmit = async (e) => {
    e.preventDefault();
    
    if (!menuItemForm.name.trim()) {
      showSnackbar('Menu item name is required', 'error');
      return;
    }
    
    if (!menuItemForm.price) {
      showSnackbar('Price is required', 'error');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('name', menuItemForm.name);
      formData.append('description', menuItemForm.description);
      formData.append('price', Number(menuItemForm.price));
      formData.append('category', menuItemForm.category);
      formData.append('isVeg', menuItemForm.isVeg);
      formData.append('preparationTime', Number(menuItemForm.preparationTime));
      formData.append('popular', menuItemForm.popular);

      if (selectedMenuItem) {
        await api.restaurant.updateMenuItem(selectedMenuItem._id, formData);
        showSnackbar('Menu item updated successfully');
      } else {
        await api.restaurant.createMenuItem(formData);
        showSnackbar('Menu item created successfully');
      }

      // Refresh menu items so the new details show immediately
      const menuResponse = await api.restaurant.getMenuItems();
      setMenuItems(menuResponse.data || []);

      handleCloseMenuItemDialog();
    } catch (error) {
      showSnackbar('Failed to save menu item', 'error');
    }
  };

  // Table Dialog Handlers
  const handleTableDialog = (table = null) => {
    if (table) {
      setSelectedTable(table);
      setTableForm({
        number: table.number || '',
        capacity: table.capacity || 4,
        floor: table.floor || 'Ground Floor',
        status: table.status || 'Available',
        section: table.section || 'Main',
        notes: table.notes || '',
      });
    } else {
      setSelectedTable(null);
      setTableForm({
        number: '',
        capacity: 4,
        floor: 'Ground Floor',
        status: 'Available',
        section: 'Main',
        notes: '',
      });
    }
    setOpenTableDialog(true);
  };

  const handleCloseTableDialog = () => {
    setOpenTableDialog(false);
    setSelectedTable(null);
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    
    if (!tableForm.number.trim()) {
      showSnackbar('Table number is required', 'error');
      return;
    }
    
    try {
      if (selectedTable) {
        await api.tables.updateTable(selectedTable._id, tableForm);
        showSnackbar('Table updated successfully');
      } else {
        await api.tables.createTable(tableForm);
        showSnackbar('Table created successfully');
      }
      
      // Refresh tables — must await and push into state, otherwise the new
      // table doesn't appear until the user hits "Refresh Data".
      const tableResponse = await api.tables.getAll();
      setTables(tableResponse.data || []);

      handleCloseTableDialog();
    } catch (error) {
      showSnackbar(error.message || 'Failed to save table', 'error');
    }
  };

  // Order Dialog Handlers
  const handleOrderDialog = async (order = null) => {
    // First, make sure we have tables loaded
    if (tables.length === 0) {
      try {
        setLoading(true);
        const tableResponse = await api.tables.getAll();
        setTables(tableResponse.data || []);
        setLoading(false);
      } catch (error) {
        showSnackbar('Failed to load tables', 'error');
        setLoading(false);
        return; // Don't open dialog if we can't load tables
      }
    }
    
    // Also load rooms if needed
    try {
      setLoading(true);
      // Fetch all bookings
      const bookingsResponse = await api.bookings.getAll();
      const occupiedRooms = [];
      
      // Handle different response structures (same as main function)
      let bookingsData = [];
      if (bookingsResponse && bookingsResponse.data && bookingsResponse.data.data) {
        bookingsData = Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [bookingsResponse.data.data];
      } else if (bookingsResponse && bookingsResponse.data) {
        bookingsData = Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [bookingsResponse.data];
      }

      // Extract room information from bookings that are checked in
      if (bookingsData && bookingsData.length > 0) {
        for (const booking of bookingsData) {
          // Only include bookings that are currently checked in (not completed/checked out)
          if (booking.status === 'CheckedIn' || booking.bookingStatus === 'Confirmed') {
            occupiedRooms.push({
              _id: booking._id, // Use booking ID as the room identifier
              number: booking.roomId?.roomNumber || booking.roomNumber || `Room ${booking._id.substring(0, 4)}`,
              type: booking.roomId?.type || booking.roomType || 'Standard',
              guestName: booking.guestName || 'Unknown Guest',
              bookingId: booking._id,
              roomId: booking.roomId?._id || booking.roomId, // Store actual room ID
            });
          }
        }
      }
      
      setRooms(occupiedRooms);
      setLoading(false);
    } catch (error) {
      showSnackbar('Failed to load occupied rooms', 'error');
      setLoading(false);
    }
    
    if (order) {
      setSelectedOrder(order);
      
      // Extract the table ID correctly regardless of format
      let tableId = '';
      if (order.tableId) {
        if (typeof order.tableId === 'object' && order.tableId._id) {
          tableId = order.tableId._id;
        } else {
          tableId = order.tableId;
        }
      }
      
      // Extract room ID if it exists
      let roomId = '';
      if (order.roomId) {
        if (typeof order.roomId === 'object' && order.roomId._id) {
          roomId = order.roomId._id;
        } else {
          roomId = order.roomId;
        }
      }
      
      // Format items to ensure they have the correct structure
      const formattedItems = (order.items || []).map(item => {
        return {
          itemId: item.itemId || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        };
      });
      
      setOrderForm({
        tableId: tableId,
        roomId: roomId,
        orderType: roomId ? 'room' : 'table',
        items: formattedItems,
        specialInstructions: order.specialInstructions || '',
        status: order.status || 'Pending',
      });

      // Populate selectedItems state with existing order items
      const existingSelectedItems = {};
      formattedItems.forEach(item => {
        existingSelectedItems[item.itemId] = item.quantity;
      });
      setSelectedItems(existingSelectedItems);
    } else {
      setSelectedOrder(null);
      setOrderForm({
        tableId: tables.length > 0 ? tables[0]._id : '',
        roomId: '',
        orderType: 'table',
        items: [],
        specialInstructions: '',
        status: 'Pending',
      });
      // Clear selected items for new orders
      setSelectedItems({});
    }
    setOpenOrderDialog(true);
  };

  const handleCloseOrderDialog = () => {
    setOpenOrderDialog(false);
    setSelectedOrder(null);
    setSelectedItems({});
    setOrderForm({
      tableId: '',
      roomId: '',
      orderType: 'table',
      items: [],
      specialInstructions: '',
      status: 'Pending',
    });
  };

  // Delete handlers
  const handleDeleteMenuItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) {return;}

    try {
      await api.restaurant.deleteMenuItem(id);
      showSnackbar('Menu item deleted successfully');

      // Refresh menu items so the list updates immediately
      const menuResponse = await api.restaurant.getMenuItems();
      setMenuItems(menuResponse.data || []);
    } catch (error) {
      showSnackbar('Failed to delete menu item', 'error');
    }
  };

  // Flip a single item's availability (the "out of stock" switch on each row).
  const handleToggleAvailability = async (item) => {
    const nextAvailable = item.isAvailable === false; // unavailable -> available, else -> unavailable
    // Optimistic update so the switch responds instantly.
    setMenuItems(prev => prev.map(m => (m._id === item._id ? { ...m, isAvailable: nextAvailable } : m)));
    try {
      await api.restaurant.setMenuItemAvailability(item._id, nextAvailable);
      showSnackbar(nextAvailable ? `${item.name} is now available` : `${item.name} marked unavailable`);
    } catch (error) {
      // Revert on failure.
      setMenuItems(prev => prev.map(m => (m._id === item._id ? { ...m, isAvailable: item.isAvailable } : m)));
      showSnackbar('Failed to update availability', 'error');
    }
  };

  const handleDeleteTable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this table?')) {return;}
    
    try {
      await api.tables.deleteTable(id);
      showSnackbar('Table deleted successfully');
      
      // Refresh tables
      api.tables.getAll();
    } catch (error) {
      showSnackbar('Failed to delete table', 'error');
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) {return;}
    
    try {
      await api.restaurant.deleteOrder(id);
      showSnackbar('Order deleted successfully');
      
      // Refresh orders
      const refreshedOrders = await api.restaurant.getAll();
      setOrders(refreshedOrders.data || []);
    } catch (error) {
      showSnackbar('Failed to delete order', 'error');
    }
  };

  // Order status update handler
  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    setOrderStatusUpdating(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // Find the current order to get its existing data
      const currentOrder = orders.find(order => order._id === orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }
      
      // Create updated order data with new status
      const updatedOrderData = {
        ...currentOrder,
        status: newStatus,
        statusUpdatedAt: new Date().toISOString(),
      };
      
      // Use the existing updateOrder API method
      await api.restaurant.updateOrder(orderId, updatedOrderData);
      showSnackbar(`Order status updated to ${newStatus}`);
      
      // Update the order in the local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId 
            ? { ...order, status: newStatus, statusUpdatedAt: new Date().toISOString() }
            : order,
        ),
      );
    } catch (error) {
      showSnackbar(error.message || 'Failed to update order status', 'error');
    } finally {
      setOrderStatusUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Get filtered orders based on status filter
  const getFilteredOrders = () => {
    if (statusFilter === 'All') {return orders;}
    return orders.filter(order => order.status === statusFilter);
  };

  // Calculate time since order creation or last status update (real-time)
  const _getTimeSinceStatus = (order) => {
    // Use the most recent status timestamp or creation time
    const statusTime = order.statusUpdatedAt || order.updatedAt || order.createdAt;
    
    if (!statusTime) {
      return 'Just now';
    }
    
    // Use timerTime for real-time updates
    const now = timerTime;
    const statusDate = new Date(statusTime);
    
    // Validate the date
    if (isNaN(statusDate.getTime())) {
      return 'Just now';
    }
    
    const diff = now - statusDate;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ago`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'Just now';
  };

  // Category Dialog Handlers
  const handleCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || '',
        description: category.description || '',
        displayOrder: category.displayOrder || 1,
        isVegOnly: category.isVegOnly || false,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        displayOrder: categories.length > 0 ? Math.max(...categories.map(c => c.displayOrder || 0)) + 1 : 1,
        isVegOnly: false,
      });
    }
    setOpenCategoryDialog(true);
  };

  const handleCloseCategoryDialog = () => {
    setOpenCategoryDialog(false);
    setEditingCategory(null);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.name.trim()) {
      showSnackbar('Category name is required', 'error');
      return;
    }
    
    try {
      const formData = {
        ...categoryForm,
        displayOrder: Number(categoryForm.displayOrder),
      };
      
      if (editingCategory) {
        await api.restaurant.updateCategory(editingCategory._id, formData);
        showSnackbar('Category updated successfully');
      } else {
        await api.restaurant.createCategory(formData);
        showSnackbar('Category created successfully');
      }
      
      // Refresh categories
      api.restaurant.getCategories();
      
      handleCloseCategoryDialog();
    } catch (error) {
      showSnackbar('Failed to save category', 'error');
    }
  };

  const handleOpenCSVDialog = () => setOpenCSVDialog(true);
  const handleCloseCSVDialog = () => {
    setOpenCSVDialog(false);
    setCSVFile(null);
  };

  const handleCSVFileChange = (e) => {
    setCSVFile(e.target.files[0]);
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      showSnackbar('Please select a CSV file to upload', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', csvFile);
      
      const response = await api.restaurant.uploadMenuCSV(formData);
      
      if (response.data.success) {
        const { imported, errors, errorSummary } = response.data;

        // Turn the grouped reasons into a short, human-readable "why": e.g.
        // "Valid price is required (184)". Falls back to grouping the raw
        // errors client-side if the server didn't send a summary.
        const summary =
          errorSummary ||
          (errors || []).reduce((acc, e) => {
            const reason = e?.error || 'Unknown error';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
          }, {});
        const reasonText = Object.entries(summary)
          .sort((a, b) => b[1] - a[1])
          .map(([reason, count]) => `${reason} (${count})`)
          .join(' · ');

        if (imported > 0 && errors.length === 0) {
          showSnackbar(`Successfully imported ${imported} menu items!`, 'success');
        } else if (imported > 0 && errors.length > 0) {
          showSnackbar(`Imported ${imported} items — skipped ${errors.length}: ${reasonText}`, 'warning');
        } else {
          showSnackbar(`Import failed (${errors.length}). Reason: ${reasonText}`, 'error');
        }
        if (errors.length > 0) console.warn('[CSV import] error breakdown:', summary, errors.slice(0, 10));
        
        // Refresh menu items and categories if any were imported
        if (imported > 0) {
          const [menuResponse, categoryResponse] = await Promise.all([
            api.restaurant.getMenuItems(),
            api.restaurant.getCategories(),
          ]);
          setMenuItems(menuResponse.data || []);
          setCategories(categoryResponse.data || []);
        }
      } else {
        showSnackbar(response.data.message || 'CSV upload failed', 'error');
      }
      
      handleCloseCSVDialog();
    } catch (error) {
      showSnackbar(
        error.response?.data?.message || 
        error.message || 
        'Failed to upload CSV file', 
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Render menu items tab
  const renderMenuItemsTab = () => (
    <MenuItemsTab
      menuFilters={renderMenuItemFilters()}
      onMenuItemDialog={handleMenuItemDialog}
      onCategoryDialog={handleCategoryDialog}
      onUploadCSV={handleOpenCSVDialog}
      onDeleteItem={handleDeleteMenuItem}
      onToggleAvailability={handleToggleAvailability}
      categories={categories}
      filteredMenuItems={filteredMenuItems}
      fontFamily={fontFamily}
      fontSize={fontSize}
    />
  );

  // Render tables tab
  const renderTablesTab = () => (
    <TablesTab
      tables={tables}
      orders={orders}
      onTableDialog={handleTableDialog}
      onRefresh={fetchData}
      onStatusChange={handleTableStatusChange}
      onGuestsChange={handleTableGuestsChange}
      onSettle={handleTableSettle}
      onDeleteTable={handleDeleteTable}
    />
  );

  // Render orders tab
  const renderOrdersTab = () => (
    <OrdersTab
      onOrderDialog={handleOrderDialog}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      orders={orders}
      filteredOrders={getFilteredOrders()}
      onRefreshOrders={async () => {
        const refreshedOrders = await api.restaurant.getAll();
        setOrders(refreshedOrders.data || []);
        showSnackbar('Orders refreshed');
      }}
      onStatusUpdate={handleOrderStatusUpdate}
      onDeleteOrder={handleDeleteOrder}
      orderStatusUpdating={orderStatusUpdating}
      rooms={rooms}
      tables={tables}
      fontFamily={fontFamily}
      fontSize={fontSize}
    />
  );

  return (
    <PageLayout>
      {/* Header Section */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        sx={{
        flexWrap: 'wrap',
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        backdropFilter: 'var(--app-blur)',
        WebkitBackdropFilter: 'var(--app-blur)',
        border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 3,
      }}>
        <Avatar
          component={motion.div}
          whileHover={{ rotate: [0, -12, 12, 0] }}
          transition={{ duration: 0.5 }}
          sx={{ width: 56, height: 56, bgcolor: 'rgba(var(--app-primary-rgb),0.12)' }}
        >
          <RestaurantIcon sx={{ fontSize: 30, color: 'var(--app-primary)' }} />
        </Avatar>
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="h4" sx={{ color: 'var(--app-primary)', fontWeight: 700, lineHeight: 1.1 }}>
            Restaurant Management
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(var(--app-primary-rgb),0.75)' }}>
            Manage your menu, tables, and orders with ease
          </Typography>
        </Box>
      </Box>
      {/* Redesigned Stat Cards */}
      <Grid
        container
        spacing={2.5}
        sx={{ mb: 3 }}
        component={motion.div}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          { icon: <MenuIcon />, value: menuItems.length, label: 'Menu Items', color: 'var(--app-primary)', bg: 'rgba(var(--app-primary-rgb),0.12)' },
          { icon: <TableIcon />, value: tables.length, label: 'Tables', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
          { icon: <OrderIcon />, value: orders.length, label: 'Active Orders', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
          { icon: <CategoryIcon />, value: categories.length, label: 'Categories', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
        ].map((s) => (
          <Grid
            key={s.label}
            size={{
              xs: 6,
              md: 3
            }}>
            <Box
              component={motion.div}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              sx={{
              p: 2.5,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              cursor: 'default',
              background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
              backdropFilter: 'var(--app-blur)',
              border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
              borderRadius: 3,
              transition: 'box-shadow 0.25s ease',
              '&:hover': {
                boxShadow: '0 16px 34px -10px rgba(var(--app-primary-rgb),0.28)',
              },
            }}>
              <Avatar sx={{ bgcolor: s.bg, color: s.color, width: 48, height: 48 }}>
                {s.icon}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: s.color, lineHeight: 1.1 }}>
                  {s.value}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                  {s.label}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Modern Tabs - Redesigned Glassy Tab Bar */}
        <Box sx={{
          background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
          backdropFilter: 'var(--app-blur)',
          border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
          borderRadius: '24px',
          mb: 4,
          p: 1.5,
        }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 0,
              '& .MuiTab-root': {
                borderRadius: '18px',
                mx: 0.5,
                minHeight: 44,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                color: '#23272f',
                background: 'var(--app-glass-sheen), rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'none',
                '&:hover': {
                  background: 'rgba(var(--app-primary-rgb),0.10)',
                  color: 'var(--app-primary)',
                  boxShadow: '0 2px 12px rgba(var(--app-primary-rgb),0.10)',
                  transform: 'scale(1.04)',
                },
                '&.Mui-selected': {
                  background: 'rgba(var(--app-primary-rgb),0.13)',
                  color: 'var(--app-primary)',
                  boxShadow: '0 2px 8px rgba(var(--app-primary-rgb),0.10)',
                  transform: 'scale(1.02)',
                },
              },
              '& .MuiTabs-indicator': {
                display: 'none',
              },
            }}
          >
            <Tab icon={<MenuIcon />} label="Menu Items" iconPosition="start" />
            <Tab icon={<TableIcon />} label="Tables" iconPosition="start" />
            <Tab icon={<OrderIcon />} label="Orders" iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ mt: 4 }}>
          {tabValue === 0 && renderMenuItemsTab()}
          {tabValue === 1 && renderTablesTab()}
          {tabValue === 2 && renderOrdersTab()}
        </Box>

        {/* Menu Item Dialog */}
        <MenuItemDialog
          open={openMenuItemDialog}
          onClose={handleCloseMenuItemDialog}
          onSubmit={handleMenuItemSubmit}
          selectedMenuItem={selectedMenuItem}
          menuItemForm={menuItemForm}
          setMenuItemForm={setMenuItemForm}
          categories={categories}
        />

        {/* Table Dialog */}
        <TableDialog
          open={openTableDialog}
          onClose={handleCloseTableDialog}
          onSubmit={handleTableSubmit}
          selectedTable={selectedTable}
          tableForm={tableForm}
          setTableForm={setTableForm}
        />

        {/* Category Dialog */}
        <CategoryDialog
          open={openCategoryDialog}
          onClose={handleCloseCategoryDialog}
          onSubmit={handleCategorySubmit}
          selectedCategory={editingCategory}
          categoryForm={categoryForm}
          setCategoryForm={setCategoryForm}
        />

        {/* CSV Upload Dialog */}
        <CSVUploadDialog
          open={openCSVDialog}
          onClose={handleCloseCSVDialog}
          onUpload={handleCSVUpload}
          csvFile={csvFile}
          onFileChange={handleCSVFileChange}
          loading={loading}
        />

        {/* Order Creation Dialog */}
        <OrderDialog
          open={openOrderDialog}
          onClose={handleCloseOrderDialog}
          onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); handleCreateOrder(); }}
          selectedOrder={selectedOrder}
          orderForm={orderForm}
          setOrderForm={setOrderForm}
          rooms={rooms}
          tables={tables}
          menuFilters={renderMenuItemFilters()}
          filteredMenuItems={filteredMenuItems}
          selectedItems={selectedItems}
          onItemClick={handleItemClick}
          onQuantityChange={handleQuantityChange}
          menuItems={menuItems}
          totalItemsCount={getTotalItemsCount()}
          subtotal={getSubtotal()}
          gstAmount={getGSTAmount()}
          totalPrice={getTotalPrice()}
        />

        {/* Snackbar for notifications */}
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={6000} 
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity} 
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </motion.div>
    </PageLayout>
  );
};

export default Restaurant;