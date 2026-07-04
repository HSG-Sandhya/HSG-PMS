import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FormDialog, { FormSection } from './forms/FormDialog';
import api from '../api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useOperations } from '../hooks/useBilling';
import { currencySym } from '../utils/billing';

// Keep only the 10-digit local part of a phone number (drops a +91 / spaces).
const phoneLocal = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// Colour a recharge's async status for the history chip.
const RECHARGE_STATUS_COLOR = {
  success: 'success',
  processing: 'warning',
  pending: 'info',
  failed: 'error',
  cancelled: 'default',
};

const StaffAttendanceCards = () => {
  const ops = useOperations();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Dialog states
  const [calendarDialog, setCalendarDialog] = useState(false);
  const [payrollDialog, setPayrollDialog] = useState(false);
  const [moneyDialog, setMoneyDialog] = useState(false);
  const [rechargeDialog, setRechargeDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Calendar data
  const [attendanceData, setAttendanceData] = useState([]); // Ensure it's always an array
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Money tracking data
  const [moneyTransactions, setMoneyTransactions] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    reason: '',
    type: 'advance' // advance, salary, bonus, deduction
  });
  
  // Recharge data
  const [rechargeHistory, setRechargeHistory] = useState([]);
  const [newRecharge, setNewRecharge] = useState({
    amount: '',
    phoneNumber: '',
    operator: '',
    planType: 'prepaid'
  });

  // Loading states
  const [attendanceLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [rechargeLoading, setRechargeLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await api.users.getAll();
      
      // The API returns { success: true, data: users[], message: '...' }
      const users = response.data.data || [];
      
      const staffMembers = users.filter(user => 
        !user.isSystemAdmin && 
        user.isActive &&
        (!user.role || !['Admin', 'System Administrator'].includes(user.role?.name))
      );
      
      setStaff(staffMembers);
    } catch (error) {
      console.error('Error fetching staff:', error);
      showSnackbar('Error fetching staff', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Attendance Calendar Functions
  const openCalendarDialog = async (staffMember) => {
    setSelectedStaff(staffMember);
    setCalendarDialog(true);
    await fetchAttendanceData(staffMember._id, selectedMonth);
  };

  const fetchAttendanceData = async (staffId, month) => {
    try {
      const startDate = startOfMonth(month);
      const endDate = endOfMonth(month);
      
      const response = await api.attendance.getStaffAttendance(staffId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      // Extract attendance records from the nested response structure
      const attendanceRecords = response.data.data?.attendance || response.data.attendance || [];
      
      // Ensure we always set an array
      if (Array.isArray(attendanceRecords)) {
        setAttendanceData(attendanceRecords);
      } else {
        console.warn('Attendance data is not an array:', attendanceRecords);
        setAttendanceData([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceData([]);
    }
  };

  const getAttendanceStatus = (date) => {
    // Safety check: ensure attendanceData is an array
    if (!Array.isArray(attendanceData)) {
      console.warn('attendanceData is not an array:', attendanceData);
      return 'not_marked';
    }
    
    const attendance = attendanceData.find(att => 
      isSameDay(new Date(att.date), date)
    );
    const status = attendance?.status || 'not_marked';
    
    
    return status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#4caf50';
      case 'absent': return '#f44336';
      case 'half_day': return '#ff9800';
      case 'late': return '#ff5722';
      case 'leave': return '#9c27b0';
      default: return '#e0e0e0';
    }
  };

  const [selectedDate, setSelectedDate] = useState(null);
  const [markAttendanceDialog, setMarkAttendanceDialog] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    status: 'present',
    notes: '',
    leaveType: 'casual'
  });

  const renderCalendar = () => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return (
      <Grid container spacing={1} sx={{ mt: 2 }}>
        {days.map((day) => {
          const status = getAttendanceStatus(day);
          const color = getStatusColor(status);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Grid key={day.toString()}>
              <Box
                sx={{
                  width: 35,
                  height: 35,
                  backgroundColor: color,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: isToday ? '2px solid #1976d2' : 'none',
                  '&:hover': {
                    opacity: 0.8,
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease'
                }}
                onClick={() => handleDateClick(day)}
                title={`Click to mark attendance for ${format(day, 'MMM dd, yyyy')}`}
              >
                {format(day, 'd')}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const currentStatus = getAttendanceStatus(date);
    setAttendanceForm({
      status: currentStatus === 'not_marked' ? 'present' : currentStatus,
      notes: '',
      leaveType: 'casual'
    });
    setMarkAttendanceDialog(true);
  };

  const markAttendanceForDate = async () => {
    // Validate leave reason up front, before we touch the UI.
    if (attendanceForm.status === 'leave' && (!attendanceForm.notes || attendanceForm.notes.trim().length < 5)) {
      showSnackbar('Leave reason is required and must be at least 5 characters', 'error');
      return;
    }

    const payload = {
      staff: selectedStaff._id,
      date: selectedDate.toISOString(),
      status: attendanceForm.status,
      notes: attendanceForm.notes,
    };
    if (attendanceForm.status === 'leave') {
      payload.leaveType = attendanceForm.leaveType;
      payload.leaveReason = attendanceForm.notes;
    }

    // Optimistic update: reflect the new status on the calendar instantly and
    // close the dialog right away, then persist in the background. The day cell
    // reads from attendanceData, so replacing this date's record updates it now.
    const prevData = Array.isArray(attendanceData) ? attendanceData : [];
    const markedDate = selectedDate;
    setAttendanceData([
      ...prevData.filter((att) => !isSameDay(new Date(att.date), markedDate)),
      { ...payload },
    ]);
    setMarkAttendanceDialog(false);

    try {
      await api.attendance.markAttendance(payload);
      showSnackbar('Attendance marked', 'success');
      // Reconcile quietly with the server (no artificial delay).
      fetchAttendanceData(selectedStaff._id, selectedMonth);
    } catch (error) {
      console.error('Error marking attendance:', error);
      // Roll back the optimistic change and reopen so the user can retry.
      setAttendanceData(prevData);
      setMarkAttendanceDialog(true);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.errors?.[0]?.msg ||
                          'Error marking attendance';
      showSnackbar(errorMessage, 'error');
    }
  };

  // Payroll Functions
  const openPayrollDialog = (staffMember) => {
    setSelectedStaff(staffMember);
    setPayrollDialog(true);
  };

  const generateIndividualPayroll = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      showSnackbar('Generating payroll...', 'info');
      
      const response = await api.payroll.generatePayroll({
        staffId: selectedStaff._id,
        month: currentMonth,
        year: currentYear
      });

      if (response.data.success) {
        showSnackbar('Payroll generated successfully! You can download the PDF from the Payroll Management page.', 'success');
      }
      
      setPayrollDialog(false);
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Error generating payroll', 'error');
    }
  };

  // Money Tracking Functions
  const openMoneyDialog = async (staffMember) => {
    setSelectedStaff(staffMember);
    setMoneyDialog(true);
    await fetchMoneyTransactions(staffMember._id);
  };

  const fetchMoneyTransactions = async (staffId) => {
    try {
      const response = await api.staffTransactions.getByStaff(staffId);
      setMoneyTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setMoneyTransactions([]);
    }
  };

  const addMoneyTransaction = async () => {
    try {
      setTransactionLoading(true);
      
      // Validate input
      if (!newTransaction.amount || parseFloat(newTransaction.amount) <= 0) {
        showSnackbar('Please enter a valid amount', 'error');
        return;
      }

      const transactionData = {
        staffId: selectedStaff._id,
        amount: parseFloat(newTransaction.amount),
        reason: (newTransaction.reason || '').trim(), // optional
        type: newTransaction.type
      };

      console.log('Creating transaction:', transactionData);
      await api.staffTransactions.create(transactionData);
      
      showSnackbar('Transaction recorded successfully!', 'success');
      setNewTransaction({ amount: '', reason: '', type: 'advance' });
      await fetchMoneyTransactions(selectedStaff._id);
    } catch (error) {
      console.error('Transaction error:', error);
      showSnackbar(error.response?.data?.message || 'Error recording transaction', 'error');
    } finally {
      setTransactionLoading(false);
    }
  };

  // Phone Recharge Functions
  const openRechargeDialog = async (staffMember) => {
    setSelectedStaff(staffMember);
    setRechargeDialog(true);
    // Pre-fill the staff member's number as a bare 10-digit local part; the +91
    // is shown as a fixed field prefix, never stored in the value.
    setNewRecharge({
      ...newRecharge,
      phoneNumber: phoneLocal(staffMember.phone)
    });
    await fetchRechargeHistory(staffMember._id);
  };

  const fetchRechargeHistory = async (staffId) => {
    try {
      const response = await api.staffRecharges.getByStaff(staffId);
      setRechargeHistory(response.data.recharges || []);
    } catch (error) {
      console.error('Error fetching recharge history:', error);
      setRechargeHistory([]);
    }
  };

  const processRecharge = async () => {
    try {
      setRechargeLoading(true);
      
      // Validate input. The field holds only the 10-digit local part (+91 is a
      // fixed prefix), so validate/send exactly that — the server model wants
      // /^[6-9]\d{9}$/.
      const localPhone = phoneLocal(newRecharge.phoneNumber);
      if (!/^[6-9]\d{9}$/.test(localPhone)) {
        showSnackbar('Please enter a valid 10-digit mobile number', 'error');
        return;
      }
      if (!newRecharge.amount || parseFloat(newRecharge.amount) < ops.payroll.minWalletRecharge) {
        showSnackbar(`Minimum recharge amount is ${currencySym()}${ops.payroll.minWalletRecharge}`, 'error');
        return;
      }
      if (!newRecharge.operator) {
        showSnackbar('Please select an operator', 'error');
        return;
      }

      const rechargeData = {
        staffId: selectedStaff._id,
        amount: parseFloat(newRecharge.amount),
        phoneNumber: localPhone,
        operator: newRecharge.operator,
        planType: newRecharge.planType
      };

      console.log('Processing recharge:', rechargeData);
      await api.staffRecharges.create(rechargeData);
      
      showSnackbar('Recharge initiated!', 'success');
      const staffId = selectedStaff._id;
      setNewRecharge({ amount: '', phoneNumber: '', operator: '', planType: 'prepaid' });
      await fetchRechargeHistory(staffId);
      // The server simulates ~2s operator processing before marking the recharge
      // success/failed (and posting the accounting expense); refetch once after
      // that so the status chip settles without a manual refresh.
      setTimeout(() => { fetchRechargeHistory(staffId); }, 2600);
    } catch (error) {
      console.error('Recharge error:', error);
      showSnackbar(error.response?.data?.message || 'Error processing recharge', 'error');
    } finally {
      setRechargeLoading(false);
    }
  };

  const StaffCard = React.memo(function StaffCard({ staffMember }) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    
    // Status color based on staff activity
    const getStaffStatusColor = (staff) => {
      if (!staff.isActive) return '#f44336'; // Red for inactive
      if (staff.isSystemAdmin) return '#9c27b0'; // Purple for admin
      return '#4caf50'; // Green for active staff
    };

    const getStaffStatusLabel = (staff) => {
      if (!staff.isActive) return 'Inactive';
      if (staff.isSystemAdmin) return 'Admin';
      return 'Active';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        whileHover={{ scale: 1.03, y: -4 }}
        layout
        style={{ willChange: 'transform' }}
      >
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '24px',
            overflow: 'hidden',
            background: isDarkMode
              ? 'rgba(35,39,47,0.85)'
              : 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            boxShadow:
              '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <CardContent
            sx={{
              p: 3.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              height: '100%',
              position: 'relative',
            }}
          >
            {/* Status badge, top right */}
            <Chip
              label={getStaffStatusLabel(staffMember)}
              size="small"
              sx={{
                backgroundColor: getStaffStatusColor(staffMember),
                color: 'white',
                position: 'absolute',
                top: 16,
                right: 16,
                textTransform: 'capitalize',
                fontWeight: 'bold',
                fontSize: '0.95em',
                letterSpacing: 0.2,
                zIndex: 2,
                opacity: 0.92,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />

            {/* Staff Avatar — uploaded photo if available, otherwise a person icon.
                color:#fff is forced because the app palette sets background.default
                to 'transparent', which MUI would otherwise use as the icon colour. */}
            <Avatar
              src={staffMember.avatar || staffMember.photo || staffMember.photoUrl || staffMember.profile?.avatar || staffMember.profile?.photo || undefined}
              alt={`${staffMember.firstName || ''} ${staffMember.lastName || ''}`.trim()}
              sx={{
                width: 80,
                height: 80,
                bgcolor: theme.palette.primary.main,
                color: '#fff',
                mb: 2,
                mt: 2,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              <PersonIcon sx={{ fontSize: 44 }} />
            </Avatar>

            {/* Staff Name */}
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: isDarkMode
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(35,39,47,0.95)',
                mb: 1,
                letterSpacing: 0.5,
                textShadow: isDarkMode
                  ? '0 2px 8px rgba(0,0,0,0.18)'
                  : '0 2px 8px rgba(var(--app-primary-rgb),0.08)',
              }}
            >
              {staffMember.firstName} {staffMember.lastName}
            </Typography>

            {/* Employee ID & Role */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  opacity: 0.9,
                }}
              >
                {staffMember.profile?.employeeId || 'N/A'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontWeight: 500
                }}>
                {staffMember.role?.name || 'Staff'}
              </Typography>
            </Box>

            {/* Department & Salary */}
            <Box
              sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}
            >
              <Chip
                label={staffMember.department?.name || 'General'}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                }}
              />
              <Chip
                label={`${currencySym()}${staffMember.profile?.salary || ops.payroll.defaultSalary}`}
                size="small"
                sx={{
                  backgroundColor: theme.palette.success.main,
                  color: 'white',
                  fontWeight: 600,
                }}
              />
            </Box>

            {/* Phone */}
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 2,
                fontWeight: 500
              }}>
              📱 {staffMember.phone ? `+91 ${staffMember.phone}` : 'N/A'}
            </Typography>

            {/* Action Buttons (hover only, CSS transition, staggered) */}
            <Box
              className="staff-action-buttons"
              sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 2,
                mt: 2,
                zIndex: 10,
                position: 'relative',
              }}
            >
              {[
                {
                  key: 'calendar',
                  tooltip: 'Attendance Calendar',
                  onClick: () => openCalendarDialog(staffMember),
                  icon: <CalendarIcon fontSize="small" />,
                  color: 'primary.main',
                  bg: 'rgba(33, 150, 243, 0.08)',
                },
                {
                  key: 'payroll',
                  tooltip: 'Generate Payroll Record',
                  onClick: () => openPayrollDialog(staffMember),
                  icon: <PaymentIcon fontSize="small" />,
                  color: 'success.main',
                  bg: 'rgba(76, 175, 80, 0.08)',
                },
                {
                  key: 'money',
                  tooltip: 'Money Tracking',
                  onClick: () => openMoneyDialog(staffMember),
                  icon: <WalletIcon fontSize="small" />,
                  color: 'warning.main',
                  bg: 'rgba(255, 152, 0, 0.08)',
                },
                {
                  key: 'phone',
                  tooltip: 'Phone Recharge',
                  onClick: () => openRechargeDialog(staffMember),
                  icon: <PhoneIcon fontSize="small" />,
                  color: 'info.main',
                  bg: 'rgba(3, 169, 244, 0.08)',
                },
              ].map((btn, i) => (
                <Tooltip title={btn.tooltip} arrow key={btn.key}>
                  <IconButton
                    size="small"
                    onClick={btn.onClick}
                    sx={{
                      color: btn.color,
                      background: btn.bg,
                      opacity: 0,
                      pointerEvents: 'none',
                      transform: 'translateY(12px)',
                      transition: `opacity 0.38s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms, transform 0.38s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms`,
                      '.MuiCardContent-root:hover &': {
                        opacity: 1,
                        pointerEvents: 'auto',
                        transform: 'translateY(0)',
                      },
                    }}
                  >
                    {btn.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    );
  });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ p: 3 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" gutterBottom>
                Staff Management Dashboard
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchStaff}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </motion.div>

        {/* Staff Cards Grid */}
        <AnimatePresence>
          <Grid container spacing={3}>
            {staff.map((staffMember, index) => (
              <Grid
                key={staffMember._id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                  lg: 3
                }}>
                <StaffCard staffMember={staffMember} index={index} />
              </Grid>
            ))}
          </Grid>
        </AnimatePresence>

        {/* Attendance Calendar Dialog */}
        <FormDialog
          open={calendarDialog}
          onClose={() => setCalendarDialog(false)}
          maxWidth="md"
          icon={<CalendarIcon />}
          eyebrow={`${selectedStaff?.firstName || ''} ${selectedStaff?.lastName || ''}`.trim()}
          title="Attendance Calendar"
          hideCancel
          submitLabel="Close"
        >
          <FormSection title="Calendar" icon={<CalendarIcon fontSize="small" />} iconColor="#6366f1">
            <Box sx={{ mb: 3 }}>
              <DatePicker
                label="Select Month"
                value={selectedMonth}
                onChange={(newDate) => {
                  setSelectedMonth(newDate);
                  if (selectedStaff) {
                    fetchAttendanceData(selectedStaff._id, newDate);
                  }
                }}
                views={['year', 'month']}
                sx={{ width: '100%' }}
                slotProps={{
                  popper: {
                    sx: {
                      '& .MuiPaper-root': {
                        backgroundColor: 'white',
                        boxShadow: 3,
                      },
                      '& .MuiPickersDay-root': {
                        backgroundColor: 'white',
                        '&:hover': {
                          backgroundColor: '#f5f5f5'
                        },
                        '&.Mui-selected': {
                          backgroundColor: '#1976d2',
                          color: 'white'
                        }
                      }
                    }
                  }
                }}
              />
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {format(selectedMonth, 'MMMM yyyy')}
              </Typography>
              
              <Typography variant="body2" color="primary" sx={{ mb: 2, fontStyle: 'italic' }}>
                💡 Click on any date to mark or update attendance
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#4caf50', borderRadius: 1 }} />
                  <Typography variant="body2">Present</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#f44336', borderRadius: 1 }} />
                  <Typography variant="body2">Absent</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#ff9800', borderRadius: 1 }} />
                  <Typography variant="body2">Half Day</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#ff5722', borderRadius: 1 }} />
                  <Typography variant="body2">Late</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#9c27b0', borderRadius: 1 }} />
                  <Typography variant="body2">Leave</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#e0e0e0', borderRadius: 1 }} />
                  <Typography variant="body2">Not Marked</Typography>
                </Box>
              </Box>
            </Box>
            
            {renderCalendar()}
          </FormSection>
        </FormDialog>

        {/* Mark Attendance Dialog */}
        <FormDialog
          open={markAttendanceDialog}
          onClose={() => setMarkAttendanceDialog(false)}
          onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); markAttendanceForDate(); }}
          maxWidth="sm"
          icon={<CalendarIcon />}
          eyebrow={selectedDate ? format(selectedDate, 'MMM dd, yyyy') : ''}
          title="Mark Attendance"
          submitDisabled={attendanceLoading}
          submitLabel={attendanceLoading ? 'Marking...' : 'Mark Attendance'}
        >
          <FormSection title="Attendance" icon={<CalendarIcon fontSize="small" />} iconColor="#10b981">
            <Typography variant="body1" sx={{ mb: 2 }}>
              Mark attendance for <strong>{selectedStaff?.firstName} {selectedStaff?.lastName}</strong>
            </Typography>

            <Grid container spacing={2}>
              <Grid size={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={attendanceForm.status}
                    onChange={(e) => setAttendanceForm({...attendanceForm, status: e.target.value})}
                    MenuProps={{
                      slotProps: {
                        paper: {
                          sx: {
                            backgroundColor: 'white',
                            boxShadow: 3,
                            '& .MuiMenuItem-root': {
                              backgroundColor: 'white',
                              '&:hover': {
                                backgroundColor: '#f5f5f5'
                              },
                              '&.Mui-selected': {
                                backgroundColor: '#e3f2fd',
                                '&:hover': {
                                  backgroundColor: '#bbdefb'
                                }
                              }
                            }
                          }
                        }
                      }
                    }}
                  >
                    <MenuItem value="present">Present</MenuItem>
                    <MenuItem value="absent">Absent</MenuItem>
                    <MenuItem value="half_day">Half Day</MenuItem>
                    <MenuItem value="late">Late</MenuItem>
                    <MenuItem value="leave">Leave</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Show leave type selector only when leave is selected */}
              {attendanceForm.status === 'leave' && (
                <Grid size={12}>
                  <FormControl fullWidth>
                    <InputLabel>Leave Type</InputLabel>
                    <Select
                      value={attendanceForm.leaveType}
                      onChange={(e) => setAttendanceForm({...attendanceForm, leaveType: e.target.value})}
                      MenuProps={{
                        slotProps: {
                          paper: {
                            sx: {
                              backgroundColor: 'white',
                              boxShadow: 3,
                              '& .MuiMenuItem-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: '#e3f2fd',
                                  '&:hover': {
                                    backgroundColor: '#bbdefb'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="sick">Sick Leave</MenuItem>
                      <MenuItem value="casual">Casual Leave</MenuItem>
                      <MenuItem value="earned">Earned Leave</MenuItem>
                      <MenuItem value="maternity">Maternity Leave</MenuItem>
                      <MenuItem value="paternity">Paternity Leave</MenuItem>
                      <MenuItem value="emergency">Emergency Leave</MenuItem>
                      <MenuItem value="unpaid">Unpaid Leave</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              <Grid size={12}>
                <TextField
                  fullWidth
                  label={attendanceForm.status === 'leave' ? "Leave Reason (Required)" : "Notes (Optional)"}
                  multiline
                  rows={2}
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm({...attendanceForm, notes: e.target.value})}
                  required={attendanceForm.status === 'leave'}
                />
              </Grid>
            </Grid>
          </FormSection>
        </FormDialog>

        {/* Payroll Dialog */}
        <FormDialog
          open={payrollDialog}
          onClose={() => setPayrollDialog(false)}
          onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); generateIndividualPayroll(); }}
          maxWidth="sm"
          icon={<PaymentIcon />}
          eyebrow={`${selectedStaff?.firstName || ''} ${selectedStaff?.lastName || ''}`.trim()}
          title="Generate Payroll Record"
          submitLabel="Generate Payroll Record"
        >
          <FormSection title="Payroll" icon={<PaymentIcon fontSize="small" />} iconColor="#10b981">
            <Typography variant="body1" sx={{ mb: 2 }}>
              Generate payroll record for the current month based on attendance records.
            </Typography>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              This will create a payroll record. You can download the PDF from the Payroll Management page.
            </Typography>
          </FormSection>
        </FormDialog>

        {/* Money Tracking Dialog */}
        <FormDialog
          open={moneyDialog}
          onClose={() => setMoneyDialog(false)}
          maxWidth="md"
          icon={<WalletIcon />}
          eyebrow={`${selectedStaff?.firstName || ''} ${selectedStaff?.lastName || ''}`.trim()}
          title="Money Tracking"
          hideCancel
          submitLabel="Close"
        >
            {/* Add New Transaction */}
            <FormSection title="Add New Transaction" icon={<WalletIcon fontSize="small" />} iconColor="#6366f1">
              <Grid container spacing={2}>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <TextField
                    fullWidth
                    label={`Amount (${currencySym()})`}
                    type="number"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                  />
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={newTransaction.type}
                      onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                      MenuProps={{
                        slotProps: {
                          paper: {
                            sx: {
                              backgroundColor: 'white',
                              boxShadow: 3,
                              '& .MuiMenuItem-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: '#e3f2fd',
                                  '&:hover': {
                                    backgroundColor: '#bbdefb'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="advance">Advance</MenuItem>
                      <MenuItem value="salary">Salary</MenuItem>
                      <MenuItem value="bonus">Bonus</MenuItem>
                      <MenuItem value="deduction">Deduction</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Reason (optional)"
                    value={newTransaction.reason}
                    onChange={(e) => setNewTransaction({...newTransaction, reason: e.target.value})}
                  />
                </Grid>
                <Grid size={12}>
                  <Button 
                    variant="contained" 
                    onClick={addMoneyTransaction} 
                    fullWidth
                    disabled={transactionLoading}
                  >
                    {transactionLoading ? 'Adding...' : 'Add Transaction'}
                  </Button>
                </Grid>
              </Grid>
            </FormSection>

            {/* Transaction History */}
            <FormSection title="Transaction History" icon={<ReceiptIcon fontSize="small" />} iconColor="#a21caf">
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {moneyTransactions.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Chip 
                          label={transaction.type} 
                          size="small" 
                          color={transaction.type === 'deduction' ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell>{currencySym()}{transaction.amount}</TableCell>
                      <TableCell>{transaction.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </FormSection>
        </FormDialog>

        {/* Phone Recharge Dialog */}
        <FormDialog
          open={rechargeDialog}
          onClose={() => setRechargeDialog(false)}
          maxWidth="md"
          icon={<PhoneIcon />}
          eyebrow={`${selectedStaff?.firstName || ''} ${selectedStaff?.lastName || ''}`.trim()}
          title="Phone Recharge"
          hideCancel
          submitLabel="Close"
        >
            {/* New Recharge */}
            <FormSection title="Process New Recharge" icon={<PhoneIcon fontSize="small" />} iconColor="#6366f1">
              <Grid container spacing={2}>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="10-digit mobile number"
                    value={newRecharge.phoneNumber}
                    onChange={(e) => setNewRecharge({ ...newRecharge, phoneNumber: phoneLocal(e.target.value) })}
                    helperText="India (+91) · 10 digits"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.secondary",
                                fontWeight: 600
                              }}>+91</Typography>
                          </InputAdornment>
                        ),
                      },

                      htmlInput: { maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }
                    }} />
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <TextField
                    fullWidth
                    label="Amount"
                    type="number"
                    value={newRecharge.amount}
                    onChange={(e) => setNewRecharge({...newRecharge, amount: e.target.value})}
                    helperText={`Minimum ${currencySym()}${ops.payroll.minWalletRecharge}`}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.secondary",
                                fontWeight: 600
                              }}>{currencySym()}</Typography>
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <FormControl fullWidth>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={newRecharge.operator}
                      onChange={(e) => setNewRecharge({...newRecharge, operator: e.target.value})}
                      MenuProps={{
                        slotProps: {
                          paper: {
                            sx: {
                              backgroundColor: 'white',
                              boxShadow: 3,
                              '& .MuiMenuItem-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: '#e3f2fd',
                                  '&:hover': {
                                    backgroundColor: '#bbdefb'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="Airtel">Airtel</MenuItem>
                      <MenuItem value="Jio">Jio</MenuItem>
                      <MenuItem value="Vi">Vi</MenuItem>
                      <MenuItem value="BSNL">BSNL</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <FormControl fullWidth>
                    <InputLabel>Plan Type</InputLabel>
                    <Select
                      value={newRecharge.planType}
                      onChange={(e) => setNewRecharge({...newRecharge, planType: e.target.value})}
                      MenuProps={{
                        slotProps: {
                          paper: {
                            sx: {
                              backgroundColor: 'white',
                              boxShadow: 3,
                              '& .MuiMenuItem-root': {
                                backgroundColor: 'white',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5'
                                },
                                '&.Mui-selected': {
                                  backgroundColor: '#e3f2fd',
                                  '&:hover': {
                                    backgroundColor: '#bbdefb'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="prepaid">Prepaid</MenuItem>
                      <MenuItem value="postpaid">Postpaid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={12}>
                  <Button 
                    variant="contained" 
                    onClick={processRecharge} 
                    fullWidth
                    disabled={rechargeLoading}
                  >
                    {rechargeLoading ? 'Processing...' : 'Process Recharge'}
                  </Button>
                </Grid>
              </Grid>
            </FormSection>

            {/* Recharge History */}
            <FormSection title="Recharge History" icon={<ReceiptIcon fontSize="small" />} iconColor="#a21caf">
            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Phone Number</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Operator</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rechargeHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No recharges yet
                      </TableCell>
                    </TableRow>
                  )}
                  {rechargeHistory.map((recharge, index) => (
                    <TableRow key={recharge._id || index} hover>
                      <TableCell>{format(new Date(recharge.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>+91 {phoneLocal(recharge.phoneNumber)}</TableCell>
                      <TableCell>{recharge.operator}</TableCell>
                      <TableCell align="right">{currencySym()}{recharge.amount}</TableCell>
                      <TableCell>
                        <Chip
                          label={recharge.planType}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={recharge.status || 'pending'}
                          size="small"
                          color={RECHARGE_STATUS_COLOR[recharge.status] || 'default'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </FormSection>
        </FormDialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
        </Box>
      </motion.div>
    </LocalizationProvider>
  );
};

export default StaffAttendanceCards;
