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
  CheckCircle as ApproveIcon,
  Payment as PayIcon,
  PictureAsPdf as PdfIcon,
  ReceiptLong as ReceiptIcon,
  Payments as AmountIcon,
  VerifiedUser as VerifiedIcon,
  AccountBalanceWallet as WalletIcon,
} from '@mui/icons-material';
import api from '../api';
import { dialogPaperSx, dialogBackdropSx, primaryButtonSx, secondaryButtonSx } from './forms/formStyles';
import { currencySym } from '../utils/billing';

const ACCENT = 'var(--app-primary)';

const STATUS_STYLES = {
  draft: { bg: 'rgba(148,163,184,0.18)', color: '#64748b' },
  calculated: { bg: 'rgba(14,165,233,0.16)', color: '#0ea5e9' },
  approved: { bg: 'rgba(16,185,129,0.16)', color: '#10b981' },
  paid: { bg: 'rgba(139,92,246,0.16)', color: '#8b5cf6' },
  cancelled: { bg: 'rgba(239,68,68,0.16)', color: '#ef4444' },
};

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
  const [payrolls, setPayrolls] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [summary, setSummary] = useState({});
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
      const response = await api.payroll.getAll(filters);
      setPayrolls(response.data.data || []);
    } catch (error) {
      showSnackbar('Error fetching payrolls', 'error');
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
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
      setSummary(response.data.data?.summary || []);
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
      await api.payroll.markAsPaid(selectedPayroll._id, paymentForm);
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
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setGenerateDialog(true)}
              fullWidth
              sx={{ ...primaryButtonSx, px: 2 }}
            >
              Generate
            </Button>
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
        <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{
            fontWeight: 700
          }}>
            Payroll Records · {periodLabel}
          </Typography>
        </Box>

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
            <Table sx={{ minWidth: 900 }}>
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
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Basic Salary</TableCell>
                  <TableCell align="right">Total Earnings</TableCell>
                  <TableCell align="right">Deductions</TableCell>
                  <TableCell align="right">Net Salary</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrolls.map((payroll) => {
                  const ss = STATUS_STYLES[payroll.status] || STATUS_STYLES.draft;
                  return (
                    <TableRow
                      key={payroll._id}
                      sx={{
                        '& td': { borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(148,163,184,0.1)' : 'rgba(226,232,240,0.7)' },
                        transition: 'background-color .15s ease',
                        '&:hover': { backgroundColor: isDarkMode ? 'rgba(var(--app-primary-rgb),0.08)' : 'rgba(var(--app-primary-rgb),0.05)' },
                        '&:last-child td': { borderBottom: 'none' },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        {payroll.staff?.profile?.employeeId || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payroll.staff?.firstName} {payroll.staff?.lastName}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {payroll.payrollPeriodDisplay}
                      </TableCell>
                      <TableCell align="right">
                        {currencySym()}{payroll.salary.basic.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {currencySym()}{payroll.earnings.totalEarnings.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#ef4444' }}>
                        −{currencySym()}{payroll.deductions.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{
                          fontWeight: 800
                        }}>
                          {currencySym()}{payroll.netSalary.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payroll.status.toUpperCase()}
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
                        <Stack direction="row" spacing={0.5} sx={{
                          justifyContent: "center"
                        }}>
                          <Tooltip title="Download PDF">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadPDF(
                                payroll._id,
                                `${payroll.staff?.firstName}-${payroll.staff?.lastName}`
                              )}
                              sx={{ color: ACCENT, bgcolor: 'rgba(var(--app-primary-rgb),0.08)' }}
                            >
                              <PdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {payroll.status === 'calculated' && (
                            <Tooltip title="Approve Payroll">
                              <IconButton
                                size="small"
                                onClick={() => handleApprovePayroll(payroll._id)}
                                sx={{ color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' }}
                              >
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {payroll.status === 'approved' && (
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                onClick={() => openPaymentDialog(payroll)}
                                sx={{ color: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' }}
                              >
                                <PayIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {payrolls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ borderBottom: 'none' }}>
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <ReceiptIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
                        <Typography sx={{
                          color: "text.secondary"
                        }}>No payroll records for {periodLabel}.</Typography>
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
                Net Salary: <strong>{currencySym()}{selectedPayroll.netSalary.toLocaleString()}</strong>
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
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
