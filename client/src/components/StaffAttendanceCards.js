import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Stack,
  Divider,
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
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FormDialog, { FormSection } from './forms/FormDialog';
import AppDatePicker from './forms/AppDatePicker';
import api from '../api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths } from 'date-fns';
import { useOperations } from '../hooks/useBilling';
import { currencySym } from '../utils/billing';

// Keep only the 10-digit local part of a phone number (drops a +91 / spaces).
const phoneLocal = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

// Today as 'YYYY-MM-DD' (local) — what the date pickers below start on.
const todayYmd = () => format(new Date(), 'yyyy-MM-dd');

// Only send a date to the API when the entry is actually backdated. Omitting it
// for today lets the server stamp the real time, which keeps several entries
// made on the same day in the order they were recorded.
const backdate = (ymd) => (ymd && ymd !== todayYmd() ? ymd : undefined);

// Tap-to-cycle attendance: each tap on a day advances Present → Absent → Half
// Day and wraps around. Anything else (an unmarked day, or a legacy 'late' /
// 'leave' record from when this UI still offered those) enters at Present.
const ATTENDANCE_CYCLE = ['present', 'absent', 'half_day'];
const ATTENDANCE_LABEL = { present: 'Present', absent: 'Absent', half_day: 'Half Day' };
const nextAttendanceStatus = (status) =>
  ATTENDANCE_CYCLE[(ATTENDANCE_CYCLE.indexOf(status) + 1) % ATTENDANCE_CYCLE.length];

// Cell tooltip: names the three cycled statuses, and still reads a legacy
// 'late' / 'leave' record honestly rather than calling it unmarked.
const attendanceLabel = (status) => ATTENDANCE_LABEL[status]
  || (status && status !== 'not_marked' ? status.replace(/_/g, ' ') : 'Not marked');

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
    type: 'advance', // advance, salary, bonus, deduction
    date: todayYmd() // the day the money actually changed hands
  });

  // Recharge data
  const [rechargeHistory, setRechargeHistory] = useState([]);
  const [newRecharge, setNewRecharge] = useState({
    amount: '',
    phoneNumber: '',
    operator: '',
    planType: 'prepaid',
    date: todayYmd()
  });

  // Loading states
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
      
      // Exclude admin / owner accounts from the operational staff list. As well
      // as the isSystemAdmin flag and the Admin/System Administrator/Owner roles,
      // anyone in the "System Administration" department is an admin account
      // (e.g. the Owner and a General Manager) and shouldn't be tracked for
      // attendance or payroll.
      const staffMembers = users.filter(user =>
        !user.isSystemAdmin &&
        user.isActive &&
        !['Admin', 'System Administrator', 'Owner'].includes(user.role?.name) &&
        (user.department?.name || '') !== 'System Administration'
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
    // Any taps still queued from the last staff member were captured with their
    // own id and will save themselves; drop the bookkeeping so this calendar
    // starts from what the server says.
    pendingStatus.current = {};
    rollbackStatus.current = {};
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

  // Tapping a day cycles its status and paints the new colour immediately; the
  // write is debounced so triple-tapping to reach Half Day is one request, not
  // three. Keyed by 'YYYY-MM-DD': the timer in flight, the status the taps have
  // landed on (the source of truth mid-burst, since state hasn't caught up yet),
  // and the status to restore if the write fails.
  const attendanceTimers = useRef({});
  const pendingStatus = useRef({});
  const rollbackStatus = useRef({});

  // Replace this day's record in the local list. The date is kept as a real Date
  // (not a 'YYYY-MM-DD' string) so the cell lookup can't drift a day in either
  // direction when it re-parses it.
  const withStatus = (list, day, status, staffId) => [
    ...(Array.isArray(list) ? list : []).filter((att) => !isSameDay(new Date(att.date), day)),
    { staff: staffId, date: day, status },
  ];

  const cycleAttendance = (day) => {
    if (!selectedStaff) return;
    const staffId = selectedStaff._id;
    const ymd = format(day, 'yyyy-MM-dd');
    const saved = getAttendanceStatus(day);
    const next = nextAttendanceStatus(ymd in pendingStatus.current ? pendingStatus.current[ymd] : saved);

    // The first tap of a burst remembers what to fall back to if the write fails.
    if (!(ymd in rollbackStatus.current)) rollbackStatus.current[ymd] = saved;
    pendingStatus.current[ymd] = next;
    setAttendanceData((prev) => withStatus(prev, day, next, staffId));

    clearTimeout(attendanceTimers.current[ymd]);
    attendanceTimers.current[ymd] = setTimeout(() => saveAttendance(day, staffId), 450);
  };

  const saveAttendance = async (day, staffId) => {
    const ymd = format(day, 'yyyy-MM-dd');
    const status = pendingStatus.current[ymd];
    delete attendanceTimers.current[ymd];
    if (!status || !staffId) return;

    try {
      // Send the day as a plain date (no time/zone). Using toISOString() here
      // shifted the day back by one in +05:30 IST — local midnight July 22
      // serialises to 2026-07-21T18:30Z, which the UTC server floored to July 21,
      // so the mark landed on the previous date.
      await api.attendance.markAttendance({ staff: staffId, date: ymd, status });
      if (attendanceTimers.current[ymd]) return; // more taps queued — they own the state now
      delete pendingStatus.current[ymd];
      delete rollbackStatus.current[ymd];
      showSnackbar(`${format(day, 'dd MMM')} · ${ATTENDANCE_LABEL[status]}`, 'success');
    } catch (error) {
      console.error('Error marking attendance:', error);
      if (attendanceTimers.current[ymd]) return;
      const previous = rollbackStatus.current[ymd];
      delete pendingStatus.current[ymd];
      delete rollbackStatus.current[ymd];
      setAttendanceData((prev) => (previous && previous !== 'not_marked'
        ? withStatus(prev, day, previous, staffId)
        : (Array.isArray(prev) ? prev : []).filter((att) => !isSameDay(new Date(att.date), day))));
      showSnackbar(
        error.response?.data?.message
        || error.response?.data?.errors?.[0]?.msg
        || 'Error marking attendance',
        'error',
      );
    }
  };

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
                component={motion.div}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.82 }}
                transition={{ type: 'spring', stiffness: 700, damping: 24, mass: 0.4 }}
                onClick={() => cycleAttendance(day)}
                title={`${format(day, 'MMM dd, yyyy')} — ${attendanceLabel(status)} · tap to change`}
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
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  border: isToday ? '2px solid #1976d2' : 'none',
                  // Only the colour animates in CSS — the press/lift is framer's
                  // spring, so a transform transition here would fight it.
                  transition: 'background-color 0.2s ease',
                }}
              >
                {format(day, 'd')}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    );
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

  // Previous calendar month's settlement for the staff in the Money Tracking
  // dialog: base salary plus additions (bonus, overtime) minus what was already
  // paid out or withheld (advances, deductions, loans) from transactions dated
  // in that month. Everything is derived from the already-loaded transactions,
  // so no extra request is needed.
  const prevSettlement = useMemo(() => {
    const prev = subMonths(new Date(), 1);
    const start = startOfMonth(prev);
    const end = endOfMonth(prev);
    const inPrev = (moneyTransactions || []).filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
    const sumBy = (type) => inPrev
      .filter((t) => t.type === type)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const advance = sumBy('advance');
    const deduction = sumBy('deduction');
    const loan = sumBy('loan');
    const bonus = sumBy('bonus');
    const overtime = sumBy('overtime');
    const baseSalary = Number(selectedStaff?.profile?.salary) || Number(ops?.payroll?.defaultSalary) || 0;
    const net = baseSalary + bonus + overtime - advance - deduction - loan;
    return {
      monthLabel: format(prev, 'MMMM yyyy'),
      baseSalary, advance, deduction, loan, bonus, overtime, net,
      hasActivity: inPrev.length > 0,
    };
  }, [moneyTransactions, selectedStaff, ops]);

  // Money Tracking Functions
  const openMoneyDialog = async (staffMember) => {
    setSelectedStaff(staffMember);
    setMoneyDialog(true);
    setNewTransaction((prev) => ({ ...prev, date: todayYmd() }));
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
        type: newTransaction.type,
        date: backdate(newTransaction.date) // only when it isn't today
      };

      console.log('Creating transaction:', transactionData);
      await api.staffTransactions.create(transactionData);

      showSnackbar('Transaction recorded successfully!', 'success');
      setNewTransaction({ amount: '', reason: '', type: 'advance', date: todayYmd() });
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
      phoneNumber: phoneLocal(staffMember.phone),
      date: todayYmd() // never carry a date left over from an abandoned entry
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
        planType: newRecharge.planType,
        date: backdate(newRecharge.date) // only when it isn't today
      };

      console.log('Processing recharge:', rechargeData);
      await api.staffRecharges.create(rechargeData);
      
      showSnackbar('Recharge initiated!', 'success');
      const staffId = selectedStaff._id;
      setNewRecharge({ amount: '', phoneNumber: '', operator: '', planType: 'prepaid', date: todayYmd() });
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
              <AppDatePicker
                label="Select Month"
                value={format(selectedMonth, 'yyyy-MM-dd')}
                onChange={(ymd) => {
                  if (!ymd) return;
                  // Normalise to the 1st so the month grid never depends on which
                  // day the picker carried over (Jan 31 → Feb would clamp).
                  const month = startOfMonth(new Date(`${ymd}T00:00:00`));
                  setSelectedMonth(month);
                  if (selectedStaff) {
                    fetchAttendanceData(selectedStaff._id, month);
                  }
                }}
                views={['year', 'month']}
                openTo="month"
                format="MMMM yyyy"
              />
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {format(selectedMonth, 'MMMM yyyy')}
              </Typography>
              
              <Typography variant="body2" color="primary" sx={{ mb: 2, fontStyle: 'italic' }}>
                💡 Tap a date to cycle it — 1 tap Present, 2 taps Absent, 3 taps Half Day
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
                  <Box sx={{ width: 16, height: 16, backgroundColor: '#e0e0e0', borderRadius: 1 }} />
                  <Typography variant="body2">Not Marked</Typography>
                </Box>
              </Box>
            </Box>
            
            {renderCalendar()}
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
            {/* Previous month settlement summary */}
            <Box sx={{
              mb: 2, p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.06))',
            }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box>
                  <Typography variant="overline" sx={{ letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}>
                    Previous Month Settlement
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: -0.5 }}>
                    {prevSettlement.monthLabel}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: prevSettlement.net >= 0 ? '#059669' : '#dc2626', lineHeight: 1.1 }}>
                    {currencySym()}{Math.round(prevSettlement.net).toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Estimate on full salary</Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 1.25 }} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip size="small" variant="outlined" label={`Salary ${currencySym()}${prevSettlement.baseSalary.toLocaleString('en-IN')}`} />
                {prevSettlement.bonus > 0 && <Chip size="small" variant="outlined" sx={{ color: '#059669', borderColor: '#a7f3d0' }} label={`+ Bonus ${currencySym()}${prevSettlement.bonus.toLocaleString('en-IN')}`} />}
                {prevSettlement.overtime > 0 && <Chip size="small" variant="outlined" sx={{ color: '#059669', borderColor: '#a7f3d0' }} label={`+ Overtime ${currencySym()}${prevSettlement.overtime.toLocaleString('en-IN')}`} />}
                {prevSettlement.advance > 0 && <Chip size="small" variant="outlined" sx={{ color: '#dc2626', borderColor: '#fecaca' }} label={`− Advances ${currencySym()}${prevSettlement.advance.toLocaleString('en-IN')}`} />}
                {prevSettlement.deduction > 0 && <Chip size="small" variant="outlined" sx={{ color: '#dc2626', borderColor: '#fecaca' }} label={`− Deductions ${currencySym()}${prevSettlement.deduction.toLocaleString('en-IN')}`} />}
                {prevSettlement.loan > 0 && <Chip size="small" variant="outlined" sx={{ color: '#dc2626', borderColor: '#fecaca' }} label={`− Loan ${currencySym()}${prevSettlement.loan.toLocaleString('en-IN')}`} />}
              </Stack>
              {!prevSettlement.hasActivity && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  No advances or adjustments recorded for {prevSettlement.monthLabel} — settlement equals the base salary.
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                Counts these transactions against the full monthly salary. Payroll pays for days attended and also
                recovers mobile recharges and any balance carried over, so use Payroll for the amount actually payable.
              </Typography>
            </Box>

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
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <AppDatePicker
                    label="Date"
                    value={newTransaction.date}
                    onChange={(ymd) => setNewTransaction({ ...newTransaction, date: ymd })}
                    max={todayYmd()}
                  />
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
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
                  <AppDatePicker
                    label="Date"
                    value={newRecharge.date}
                    onChange={(ymd) => setNewRecharge({ ...newRecharge, date: ymd })}
                    max={todayYmd()}
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
          // Confirmations clear fast — tapping down a month of attendance would
          // otherwise leave a toast parked over the calendar.
          autoHideDuration={snackbar.severity === 'error' ? 6000 : 2000}
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
