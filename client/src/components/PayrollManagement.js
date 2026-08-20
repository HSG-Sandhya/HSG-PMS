import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Cached as RecalcIcon,
  CheckCircle as ApproveIcon,
  Payment as PayIcon,
  PictureAsPdf as PdfIcon,
  ReceiptLong as ReceiptIcon,
  Payments as AmountIcon,
  VerifiedUser as VerifiedIcon,
  AccountBalanceWallet as WalletIcon,
  EventAvailable as PayDayIcon,
} from '@mui/icons-material';
import api from '../api';
import { dialogPaperSx, dialogBackdropSx, primaryButtonSx, secondaryButtonSx } from './forms/formStyles';
import { currencySym } from '../utils/billing';
import { usePermissions } from '../contexts/PermissionContext';

const ACCENT = 'var(--app-primary)';

// Every form in which a staff member can draw money against their salary, in the
// order the salary slip lists them. Mirrors server/utils/payrollLedger.js.
const DEDUCTION_LABELS = {
  advance: 'Cash advance',
  salaryPaid: 'Salary paid in month',
  recharge: 'Mobile recharge',
  loan: 'Loan',
  other: 'Other deduction',
};

const STATUS_STYLES = {
  draft: { bg: 'rgba(148,163,184,0.18)', color: '#64748b' },
  calculated: { bg: 'rgba(14,165,233,0.16)', color: '#0ea5e9' },
  approved: { bg: 'rgba(16,185,129,0.16)', color: '#10b981' },
  paid: { bg: 'rgba(139,92,246,0.16)', color: '#8b5cf6' },
  cancelled: { bg: 'rgba(239,68,68,0.16)', color: '#ef4444' },
  not_generated: { bg: 'rgba(245,158,11,0.14)', color: '#b45309' },
};

const STATUS_LABEL = { not_generated: 'PENDING' };

const StatCard = ({ icon: Icon, label, value, color, isDarkMode }) => (
  <Box
    sx={{
      position: 'relative',
      height: '100%',
      p: 2.5,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? 'rgba(30,41,59,0.55)' : 'rgba(255,255,255,0.6)',
      border: '1px solid',
      borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : 'rgba(226,232,240,0.9)',
      backdropFilter: 'var(--app-blur)',
      WebkitBackdropFilter: 'var(--app-blur)',
      transition: 'transform .2s ease, box-shadow .2s ease',
      '&:hover': {
        transform: 'translateY(-3px)',
        boxShadow: isDarkMode ? '0 16px 36px -18px rgba(0,0,0,0.7)' : '0 16px 36px -18px rgba(15,23,42,0.3)',
      },
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: 4,
        height: '100%',
        background: `linear-gradient(180deg, ${color}, ${color}88)`,
      },
    }}
  >
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "flex-start"
      }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mt: 0.5,
            letterSpacing: '-0.02em',
            lineHeight: 1.1
          }}>
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          background: `${color}1f`,
        }}
      >
        <Icon />
      </Box>
    </Stack>
  </Box>
);

const PayrollManagement = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  // Managers can generate, recalculate and print payroll; only administrators
  // and the owner may approve it. The server enforces the same rule.
  const { canApprovePayroll } = usePermissions();
  const mayApprove = canApprovePayroll();
  const [liveRows, setLiveRows] = useState([]);
  const [liveTotals, setLiveTotals] = useState({ netSalary: 0, pendingCount: 0 });
  // Which month the balances carry in from / out to, and how much of the previous
  // month has actually been generated (nothing carries out of an un-closed month).
  const [livePeriods, setLivePeriods] = useState({ previous: null, next: null });
  const [closingMonth, setClosingMonth] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [summary, setSummary] = useState({});
  const [payDayInfo, setPayDayInfo] = useState(null);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
    staff: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Generate payroll form
  const [generateForm, setGenerateForm] = useState({
    staffId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'bank_transfer',
    transactionId: '',
    amountPaid: '',
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      accountHolderName: ''
    }
  });

  useEffect(() => {
    fetchPayrolls();
    fetchStaff();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const liveRes = await api.payroll.getLive({ month: filters.month, year: filters.year });
      const payload = liveRes.data.data || {};
      setLiveRows(payload.rows || []);
      setLiveTotals(payload.totals || { netSalary: 0, pendingCount: 0 });
      setLivePeriods({ previous: payload.previous || null, next: payload.next || null });
    } catch (error) {
      showSnackbar('Error fetching payrolls', 'error');
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate (persist) payroll for one staff member from their live row.
  const handleGenerateForStaff = async (staffId) => {
    try {
      setGeneratingId(staffId);
      const res = await api.payroll.generatePayroll({ staffId, month: filters.month, year: filters.year });
      showSnackbar(res.data?.message || 'Payroll generated', 'success');
      fetchPayrolls();
      fetchSummary();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Error generating payroll', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  // Close a whole month in one go: generate payroll for everyone still missing
  // it. Only a generated month passes its balances on, so this is also how the
  // carry-forward for the following month gets unblocked.
  const handleGenerateMonth = async (month, year, label) => {
    try {
      setClosingMonth(`${year}-${month}`);
      const res = await api.payroll.generateMonth({ month, year });
      showSnackbar(res.data?.message || `Payroll generated for ${label}`, res.data?.data?.failed?.length ? 'warning' : 'success');
      await fetchPayrolls();
      fetchSummary();
    } catch (error) {
      showSnackbar(error.response?.data?.message || `Error generating payroll for ${label}`, 'error');
    } finally {
      setClosingMonth(null);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.attendance.getEligibleStaff();
      setStaff(response.data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.payroll.getSummary({
        month: filters.month,
        year: filters.year
      });
      const d = response.data.data || {};
      setSummary(d.summary || []);
      setPayDayInfo({
        payDay: d.payDay,
        nextPayDate: d.nextPayDate,
        daysUntilPayDay: d.daysUntilPayDay,
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleGeneratePayroll = async () => {
    try {
      await api.payroll.generatePayroll(generateForm);
      showSnackbar('Payroll generated successfully', 'success');
      setGenerateDialog(false);
      fetchPayrolls();
      fetchSummary();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Error generating payroll', 'error');
    }
  };

  const handleApprovePayroll = async (payrollId) => {
    try {
      await api.payroll.approvePayroll(payrollId);
      showSnackbar('Payroll approved successfully', 'success');
      fetchPayrolls();
      fetchSummary();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Error approving payroll', 'error');
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      await api.payroll.markAsPaid(selectedPayroll._id, {
        ...paymentForm,
        // Blank means "settle the whole balance" on the server.
        amountPaid: paymentForm.amountPaid === '' ? undefined : Number(paymentForm.amountPaid),
      });
      showSnackbar('Payroll marked as paid successfully', 'success');
      setPaymentDialog(false);
      fetchPayrolls();
      fetchSummary();
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Error marking payroll as paid', 'error');
    }
  };

  const handleDownloadPDF = async (payrollId, staffName) => {
    try {
      const response = await api.payroll.generatePDF(payrollId);

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-${staffName}-${filters.month}-${filters.year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar('Payroll PDF downloaded successfully', 'success');
    } catch (error) {
      showSnackbar('Error downloading payroll PDF', 'error');
    }
  };

  const openPaymentDialog = (payroll) => {
    setSelectedPayroll(payroll);
    setPaymentForm({
      paymentMethod: 'bank_transfer',
      transactionId: '',
      // Defaults to settling the whole balance; lower it for a part payment and
      // the remainder carries into the next month.
      amountPaid: String(Math.max(0, Math.round(Number(payroll?.netSalary) || 0))),
      bankDetails: {
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        accountHolderName: ''
      }
    });
    setPaymentDialog(true);
  };

  const getSummaryStats = () => {
    const stats = {
      total: 0,
      totalAmount: 0,
      draft: 0,
      calculated: 0,
      approved: 0,
      paid: 0
    };

    if (Array.isArray(summary)) {
      summary.forEach(item => {
        stats.total += item.count;
        stats.totalAmount += item.totalAmount;
        stats[item._id] = item.count;
      });
    }

    return stats;
  };

  const stats = getSummaryStats();

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2.5,
      backgroundColor: isDarkMode ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.7)',
    },
  };

  const periodLabel = `${new Date(2024, filters.month - 1).toLocaleString('default', { month: 'long' })} ${filters.year}`;

  const money = (v) => `${currencySym()}${Math.round(Math.abs(Number(v) || 0)).toLocaleString('en-IN')}`;
  // Signed for balances, where the direction is the point: + is still owed to the
  // staff member, − is money they have drawn beyond what they earned.
  const signedMoney = (v) => `${(Number(v) || 0) < 0 ? '−' : '+'}${money(v)}`;

  // The live table shows every eligible staff member; the Status / Staff filters
  // narrow it down client-side (the live endpoint always returns everyone).
  const filteredRows = liveRows.filter((r) =>
    (!filters.status || r.status === filters.status) &&
    (!filters.staff || r.staffId === filters.staff)
  );

  return (
    <Box>
      {/* Section heading */}
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: "center",
          mb: 2.5
        }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ACCENT,
            background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(129,140,248,0.18))',
          }}
        >
          <AmountIcon />
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              lineHeight: 1.15
            }}>
            Payroll Management
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            Generate, approve and disburse salaries
          </Typography>
        </Box>
      </Stack>
      {/* Next pay day reminder — from Settings → Operations → Payroll */}
      {payDayInfo?.nextPayDate && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, mb: 3, px: 2, py: 1.25, borderRadius: 2,
            border: '1px solid', borderColor: 'divider',
            background: 'rgba(var(--app-primary-rgb),0.06)',
          }}
        >
          <PayDayIcon sx={{ fontSize: 20, color: ACCENT }} />
          <Typography variant="body2">
            Next salary pay day:{' '}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {new Date(payDayInfo.nextPayDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Box>
            {typeof payDayInfo.daysUntilPayDay === 'number' && (
              <Box component="span" sx={{ fontWeight: 600, color: payDayInfo.daysUntilPayDay <= 2 ? '#d97706' : 'text.secondary' }}>
                {' · '}{payDayInfo.daysUntilPayDay === 0 ? 'today' : `in ${payDayInfo.daysUntilPayDay} day${payDayInfo.daysUntilPayDay === 1 ? '' : 's'}`}
              </Box>
            )}
          </Typography>
        </Box>
      )}
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <StatCard icon={ReceiptIcon} label="Total Payrolls" value={stats.total} color="var(--app-primary)" isDarkMode={isDarkMode} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <StatCard icon={AmountIcon} label="Total Amount" value={`${currencySym()}${stats.totalAmount.toLocaleString()}`} color="#10B981" isDarkMode={isDarkMode} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <StatCard icon={VerifiedIcon} label="Approved" value={stats.approved || 0} color="#0EA5E9" isDarkMode={isDarkMode} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3
          }}>
          <StatCard icon={WalletIcon} label="Paid" value={stats.paid || 0} color="#8B5CF6" isDarkMode={isDarkMode} />
        </Grid>
      </Grid>
      {/* Filters and Controls */}
      <Box
        sx={{
          mb: 3,
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          backgroundColor: isDarkMode ? 'rgba(30,41,59,0.45)' : 'rgba(255,255,255,0.6)',
          border: '1px solid',
          borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(226,232,240,0.9)',
          backdropFilter: 'var(--app-blur)',
          WebkitBackdropFilter: 'var(--app-blur)',
        }}
      >
        <Grid container spacing={2} sx={{
          alignItems: "center"
        }}>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 2
            }}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Month</InputLabel>
              <Select
                label="Month"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 2
            }}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Year</InputLabel>
              <Select
                label="Year"
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 2
            }}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="calculated">Calculated</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 2
            }}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Staff</InputLabel>
              <Select
                label="Staff"
                value={filters.staff}
                onChange={(e) => setFilters({ ...filters, staff: e.target.value })}
              >
                <MenuItem value="">All Staff</MenuItem>
                {staff.map((staffMember) => (
                  <MenuItem key={staffMember._id} value={staffMember._id}>
                    {staffMember.firstName} {staffMember.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
              md: 2
            }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchPayrolls}
              disabled={loading}
              fullWidth
              sx={{ ...secondaryButtonSx(isDarkMode), px: 2 }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Box>
      {/* Payroll Table */}
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: isDarkMode ? 'rgba(30,41,59,0.45)' : 'rgba(255,255,255,0.6)',
          border: '1px solid',
          borderColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(226,232,240,0.9)',
          backdropFilter: 'var(--app-blur)',
          WebkitBackdropFilter: 'var(--app-blur)',
        }}
      >
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Live Payroll · {periodLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              All eligible staff, calculated live from salary, attendance and everything drawn in {periodLabel}
              {liveTotals.pendingCount > 0 ? ` · ${liveTotals.pendingCount} not generated yet` : ' · all generated'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Balances roll over: an unpaid balance is added to {livePeriods.next?.label || 'next month'}, and anything
              drawn beyond earnings is recovered from it. Mark a payroll <strong>Paid</strong> to settle it.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            {liveTotals.totalDeductions > 0 && (
              <Chip
                label={`Drawn · ${money(liveTotals.totalDeductions)}`}
                sx={{ fontWeight: 700, bgcolor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
              />
            )}
            <Chip
              label={`Total net · ${money(liveTotals.netSalary)}`}
              sx={{ fontWeight: 800, bgcolor: 'rgba(var(--app-primary-rgb),0.12)', color: ACCENT }}
            />
            {liveTotals.pendingCount > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={closingMonth === `${filters.year}-${filters.month}`}
                onClick={() => handleGenerateMonth(filters.month, filters.year, periodLabel)}
                sx={{ ...secondaryButtonSx(isDarkMode), whiteSpace: 'nowrap' }}
              >
                {closingMonth === `${filters.year}-${filters.month}`
                  ? 'Generating…'
                  : `Generate all (${liveTotals.pendingCount})`}
              </Button>
            )}
          </Stack>
        </Box>

        {/* Balances only roll out of a month that has been generated, so an
            un-closed previous month is why a carry-in reads as zero. */}
        {livePeriods.previous?.missingCount > 0 && (
          <Box
            sx={{
              px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
              flexWrap: 'wrap',
              borderBottom: '1px solid', borderColor: 'divider',
              background: 'rgba(217,119,6,0.08)',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 240 }}>
              {livePeriods.previous.missingCount} staff have no {livePeriods.previous.label} payroll, so nothing carries
              into {periodLabel} for them. Generate {livePeriods.previous.label} to roll its balances forward.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={closingMonth === `${livePeriods.previous.year}-${livePeriods.previous.month}`}
              onClick={() => handleGenerateMonth(
                livePeriods.previous.month,
                livePeriods.previous.year,
                livePeriods.previous.label,
              )}
              sx={{ ...secondaryButtonSx(isDarkMode), whiteSpace: 'nowrap' }}
            >
              {closingMonth === `${livePeriods.previous.year}-${livePeriods.previous.month}`
                ? 'Generating…'
                : `Generate ${livePeriods.previous.label}`}
            </Button>
          </Box>
        )}

        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              p: 6
            }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1020 }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: isDarkMode ? 'rgba(15,23,42,0.3)' : 'rgba(248,250,252,0.6)',
                    },
                  }}
                >
                  <TableCell>Employee ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Basic Salary</TableCell>
                  <TableCell align="right">Earned</TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Everything drawn during ${periodLabel} — advances, recharges, salary paid in the month, loans and other deductions`}>
                      <Box component="span">Drawn / Deducted</Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={livePeriods.previous ? `Balance carried in from ${livePeriods.previous.label}` : 'Balance carried in from the previous month'}>
                      <Box component="span">Prev. Balance</Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">Net Payable</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  const ss = STATUS_STYLES[row.status] || STATUS_STYLES.draft;
                  const breakdown = Object.entries(row.deductions || {}).filter(([, amt]) => Number(amt) > 0);
                  const opening = Number(row.openingBalance) || 0;
                  const overdrawn = Number(row.netSalary) < 0;
                  return (
                    <TableRow
                      key={row.staffId}
                      sx={{
                        '& td': { borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(148,163,184,0.1)' : 'rgba(226,232,240,0.7)' },
                        transition: 'background-color .15s ease',
                        '&:hover': { backgroundColor: isDarkMode ? 'rgba(var(--app-primary-rgb),0.08)' : 'rgba(var(--app-primary-rgb),0.05)' },
                        '&:last-child td': { borderBottom: 'none' },
                        // Un-generated rows sit slightly muted so the "live estimate" reads clearly.
                        opacity: row.persisted ? 1 : 0.92,
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>{row.employeeId}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">
                        {money(row.basicSalary)}
                      </TableCell>
                      <TableCell align="right">
                        {money(row.totalEarnings)}
                      </TableCell>
                      {/* What was drawn this month, itemised on hover so a figure
                          can always be traced back to how the money was taken. */}
                      <TableCell align="right">
                        <Tooltip
                          title={
                            breakdown.length ? (
                              <Box>
                                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Drawn in {periodLabel}
                                </Typography>
                                {breakdown.map(([field, amt]) => (
                                  <Typography key={field} variant="caption" sx={{ display: 'block' }}>
                                    {DEDUCTION_LABELS[field] || field}: {money(amt)}
                                  </Typography>
                                ))}
                              </Box>
                            ) : `Nothing drawn in ${periodLabel}`
                          }
                        >
                          <Box
                            component="span"
                            sx={{
                              color: row.totalDeductions > 0 ? '#ef4444' : 'text.disabled',
                              fontWeight: row.totalDeductions > 0 ? 700 : 400,
                              cursor: 'default',
                            }}
                          >
                            {row.totalDeductions > 0 ? `−${money(row.totalDeductions)}` : money(0)}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      {/* Carry-in from the previous month: a credit they never drew,
                          or a debit for drawing more than they earned. */}
                      <TableCell align="right">
                        <Tooltip
                          title={
                            opening === 0
                              ? (row.openingSource === 'generated'
                                ? `Settled — nothing carried from ${livePeriods.previous?.label || 'the previous month'}`
                                : `${livePeriods.previous?.label || 'The previous month'} payroll is not generated, so nothing carries in`)
                              : opening > 0
                                ? `Unpaid balance from ${livePeriods.previous?.label || 'the previous month'} — added to this month`
                                : `Drawn beyond earnings in ${livePeriods.previous?.label || 'the previous month'} — recovered this month`
                          }
                        >
                          <Box
                            component="span"
                            sx={{
                              cursor: 'default',
                              fontWeight: opening === 0 ? 400 : 700,
                              color: opening === 0 ? 'text.disabled' : (opening > 0 ? '#10b981' : '#ef4444'),
                            }}
                          >
                            {opening === 0 ? '—' : signedMoney(opening)}
                          </Box>
                        </Tooltip>
                        {row.openingStale && (
                          <Tooltip title={`${livePeriods.previous?.label || 'The previous month'} has changed since this payroll was generated — recalculate to pick up the new balance`}>
                            <Box component="span" sx={{ ml: 0.5, color: '#d97706', fontWeight: 700 }}>!</Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip
                          title={
                            overdrawn
                              ? `Over-drawn by ${money(row.netSalary)} — nothing payable, recovered from ${livePeriods.next?.label || 'next month'}`
                              : row.status === 'paid'
                                ? `Paid ${money(row.amountPaid)}${Math.abs(Number(row.carryForward) || 0) >= 1 ? ` · ${signedMoney(row.carryForward)} carries to ${livePeriods.next?.label || 'next month'}` : ' · settled'}`
                                : `Carries to ${livePeriods.next?.label || 'next month'} until marked paid`
                          }
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 800, cursor: 'default', color: overdrawn ? '#ef4444' : 'inherit' }}
                          >
                            {overdrawn ? `−${money(row.netSalary)}` : money(row.netSalary)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABEL[row.status] || row.status.toUpperCase()}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: 10,
                            letterSpacing: '0.04em',
                            borderRadius: 999,
                            backgroundColor: ss.bg,
                            color: ss.color,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {!row.persisted ? (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            disabled={generatingId === row.staffId}
                            onClick={() => handleGenerateForStaff(row.staffId)}
                            sx={{ ...primaryButtonSx, py: 0.4, px: 1.5, fontSize: 12, whiteSpace: 'nowrap' }}
                          >
                            {generatingId === row.staffId ? 'Generating…' : 'Generate'}
                          </Button>
                        ) : (
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
                            <Tooltip title="Download PDF">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadPDF(row.payrollId, row.name.replace(/\s+/g, '-'))}
                                sx={{ color: ACCENT, bgcolor: 'rgba(var(--app-primary-rgb),0.08)' }}
                              >
                                <PdfIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {row.status === 'calculated' && (
                              <Tooltip title="Recalculate (apply latest salary, attendance & policy)">
                                <IconButton
                                  size="small"
                                  disabled={generatingId === row.staffId}
                                  onClick={() => handleGenerateForStaff(row.staffId)}
                                  sx={{ color: ACCENT, bgcolor: 'rgba(var(--app-primary-rgb),0.08)' }}
                                >
                                  <RecalcIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.status === 'calculated' && mayApprove && (
                              <Tooltip title="Approve Payroll">
                                <IconButton
                                  size="small"
                                  onClick={() => handleApprovePayroll(row.payrollId)}
                                  sx={{ color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' }}
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.status === 'approved' && (
                              <Tooltip title="Mark as Paid">
                                <IconButton
                                  size="small"
                                  onClick={() => openPaymentDialog({
                                    _id: row.payrollId,
                                    netSalary: row.netSalary,
                                    openingBalance: row.openingBalance,
                                    carryForward: row.carryForward,
                                    staff: { firstName: row.name, lastName: '' },
                                  })}
                                  sx={{ color: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' }}
                                >
                                  <PayIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ borderBottom: 'none' }}>
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <ReceiptIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                        <Typography sx={{
                          color: "text.secondary"
                        }}>No eligible staff for {periodLabel}.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
      {/* Generate Payroll Dialog */}
      <Dialog
        open={generateDialog}
        onClose={() => setGenerateDialog(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Generate Payroll
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Staff Member</InputLabel>
                <Select
                  label="Staff Member"
                  value={generateForm.staffId}
                  onChange={(e) => setGenerateForm({ ...generateForm, staffId: e.target.value })}
                >
                  {staff.map((staffMember) => (
                    <MenuItem key={staffMember._id} value={staffMember._id}>
                      {staffMember.firstName} {staffMember.lastName} ({staffMember.profile?.employeeId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  label="Month"
                  value={generateForm.month}
                  onChange={(e) => setGenerateForm({ ...generateForm, month: e.target.value })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  label="Year"
                  value={generateForm.year}
                  onChange={(e) => setGenerateForm({ ...generateForm, year: e.target.value })}
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setGenerateDialog(false)} sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Button onClick={handleGeneratePayroll} variant="contained" sx={primaryButtonSx}>
            Generate Payroll
          </Button>
        </DialogActions>
      </Dialog>
      {/* Payment Dialog */}
      <Dialog
        open={paymentDialog}
        onClose={() => setPaymentDialog(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: { sx: dialogBackdropSx },
          paper: { sx: dialogPaperSx(isDarkMode) }
        }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Mark Payroll as Paid
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedPayroll && (
            <Box
              sx={{
                mb: 2.5,
                mt: 0.5,
                p: 2,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.1), rgba(129,140,248,0.06))',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.9)',
              }}
            >
              <Typography variant="subtitle1" sx={{
                fontWeight: 700
              }}>
                {selectedPayroll.staff?.firstName} {selectedPayroll.staff?.lastName}
              </Typography>
              <Typography sx={{
                color: "text.secondary"
              }}>
                Balance payable: <strong>{money(selectedPayroll.netSalary)}</strong>
                {selectedPayroll.carryForward != null && Math.abs(Number(selectedPayroll.carryForward)) >= 1 && (
                  <> · includes {signedMoney(selectedPayroll.openingBalance)} carried in</>
                )}
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                type="number"
                label="Amount Paid"
                value={paymentForm.amountPaid}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                helperText={`Pay less than the balance and the remainder carries into ${livePeriods.next?.label || 'next month'}.`}
              />
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  label="Payment Method"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                >
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Transaction ID"
                value={paymentForm.transactionId}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
              />
            </Grid>

            {paymentForm.paymentMethod === 'bank_transfer' && (
              <>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Account Number"
                    value={paymentForm.bankDetails.accountNumber}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankDetails: { ...paymentForm.bankDetails, accountNumber: e.target.value }
                    })}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="IFSC Code"
                    value={paymentForm.bankDetails.ifscCode}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankDetails: { ...paymentForm.bankDetails, ifscCode: e.target.value }
                    })}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Bank Name"
                    value={paymentForm.bankDetails.bankName}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankDetails: { ...paymentForm.bankDetails, bankName: e.target.value }
                    })}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Account Holder Name"
                    value={paymentForm.bankDetails.accountHolderName}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      bankDetails: { ...paymentForm.bankDetails, accountHolderName: e.target.value }
                    })}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setPaymentDialog(false)} sx={secondaryButtonSx(isDarkMode)}>
            Cancel
          </Button>
          <Button onClick={handleMarkAsPaid} variant="contained" sx={primaryButtonSx}>
            Mark as Paid
          </Button>
        </DialogActions>
      </Dialog>
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PayrollManagement;
