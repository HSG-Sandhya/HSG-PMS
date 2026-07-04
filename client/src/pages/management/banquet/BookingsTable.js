import { useMemo, useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, TextField, Select, MenuItem, Button, InputAdornment, Skeleton, Avatar,
} from '@mui/material';
import {
  Search, FileDownloadOutlined, WhatsApp, Payments as PaymentsIcon,
  PrintOutlined, ReceiptLongOutlined, EditOutlined, DeleteOutlined, EventSeatOutlined,
  FactCheckOutlined,
} from '@mui/icons-material';
import {
  glassCard, textPrimary, textSecondary, eventColor, STATUS_META, PAYMENT_META,
  hallLabel, eventStart, money,
} from './banquetDash';

const Pill = ({ label, color }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.35, borderRadius: '999px',
    background: `${color}1f`, color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  }}>
    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
    {label}
  </Box>
);

const headCellSx = (isDark) => ({
  fontSize: 11.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
  color: textSecondary(isDark), border: 'none', py: 1,
});

const STATUS_OPTIONS = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

/**
 * Professional bookings table with search, status filter, sort and CSV export.
 * Row actions: WhatsApp confirmation, payments ledger, print quotation, print
 * invoice, edit, delete.
 */
const BookingsTable = ({
  bookings = [], halls = [], isDark = false, loading = false,
  title = 'All Bookings', subtitle,
  emptyState = null,
  onEdit, onDelete, onPayments, onPrintQuotation, onPrintInvoice, onFinalize,
}) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState('date_desc');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = bookings.filter((b) => {
      if (status !== 'All' && b.status !== status) return false;
      if (!q) return true;
      return [b.customerName, b.eventName, b.eventTitle, b.eventType, b.customerPhone, hallLabel(b, halls),
        b.groomName, b.brideName, b.eventDetails?.organizationName, b.eventDetails?.contactPerson,
        b.eventDetails?.birthdayPersonName, b.eventDetails?.celebrantNames]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
    out = out.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return (eventStart(a) || 0) - (eventStart(b) || 0);
        case 'amount_desc': return (b.totalAmount || 0) - (a.totalAmount || 0);
        case 'guests_desc': return (b.guestCount || 0) - (a.guestCount || 0);
        case 'date_desc':
        default: return (eventStart(b) || 0) - (eventStart(a) || 0);
      }
    });
    return out;
  }, [bookings, halls, query, status, sortBy]);

  const exportCsv = () => {
    const header = ['Event', 'Customer', 'Phone', 'Date', 'Hall', 'Guests', 'Package', 'Total', 'Paid', 'Balance', 'Payment', 'Status'];
    const lines = rows.map((b) => [
      b.eventName || b.eventTitle || b.eventType || '',
      b.customerName || '', b.customerPhone || '',
      b.eventDate ? new Date(b.eventDate).toLocaleDateString() : '',
      hallLabel(b, halls), b.guestCount || 0, b.packageName || '',
      b.totalAmount || 0, b.advanceAmount || 0, b.remainingAmount || 0,
      b.paymentStatus || '', b.status || '',
    ]);
    const csv = [header, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `banquet-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const whatsapp = (b) => {
    const digits = String(b.customerPhone || '').replace(/\D/g, '');
    if (!digits) return;
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const when = b.eventDate ? new Date(b.eventDate).toLocaleDateString() : '';
    const msg = `Hello ${b.customerName || ''}, your ${b.eventType || 'event'} booking at ${hallLabel(b, halls)} on ${when} is ${b.status}. Total ${money(b.totalAmount)}, balance ${money(b.remainingAmount)}. Thank you!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const cellSx = { border: 'none', py: 1.25, color: textPrimary(isDark) };
  const controlSx = {
    '& .MuiOutlinedInput-root': { borderRadius: '12px', background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.7)' },
  };

  const isEmpty = !loading && bookings.length === 0;

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <EventSeatOutlined sx={{ color: 'var(--app-primary)' }} />
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark), lineHeight: 1.1 }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: 12, color: textSecondary(isDark) }}>{subtitle}</Typography>}
        </Box>
        <Box sx={{ flex: 1 }} />
        {!isEmpty && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small" placeholder="Search event, customer, hall…"
              value={query} onChange={(e) => setQuery(e.target.value)}
              sx={{ ...controlSx, width: { xs: '100%', sm: 240 } }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }
              }}
            />
            <Select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ ...controlSx, minWidth: 130 }} MenuProps={{ slotProps: {
              paper: { sx: { backgroundColor: isDark ? '#1e293b' : '#fff' } }
            } }}>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s === 'All' ? 'All statuses' : s}</MenuItem>)}
            </Select>
            <Select size="small" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ ...controlSx, minWidth: 150 }} MenuProps={{ slotProps: {
              paper: { sx: { backgroundColor: isDark ? '#1e293b' : '#fff' } }
            } }}>
              <MenuItem value="date_desc">Date (newest)</MenuItem>
              <MenuItem value="date_asc">Date (oldest)</MenuItem>
              <MenuItem value="amount_desc">Amount (high→low)</MenuItem>
              <MenuItem value="guests_desc">Guests (high→low)</MenuItem>
            </Select>
            <Button onClick={exportCsv} startIcon={<FileDownloadOutlined />} variant="outlined" size="small"
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', color: textPrimary(isDark), borderColor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.15)' }}>
              Export
            </Button>
          </Box>
        )}
      </Box>
      {loading ? (
        <Box>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={46} sx={{ mb: 1, borderRadius: 2 }} />)}</Box>
      ) : isEmpty ? (
        emptyState
      ) : (
        <TableContainer sx={{ maxHeight: 560, '&::-webkit-scrollbar': { width: 6, height: 6 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 } }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ '& th': { background: isDark ? '#1e293b' : '#fff' } }}>
                {['Event', 'Customer', 'Date', 'Hall', 'Guests', 'Package', 'Payment', 'Status'].map((h) => (
                  <TableCell key={h} sx={headCellSx(isDark)}>{h}</TableCell>
                ))}
                <TableCell sx={{ ...headCellSx(isDark), textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((b) => {
                const color = eventColor(b.eventType);
                const start = eventStart(b);
                return (
                  <TableRow key={b._id} sx={{
                    transition: 'background 0.2s ease',
                    '&:hover': { background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(21,152,229,0.06)' },
                    '& td': { borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'}` },
                  }}>
                    <TableCell sx={cellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 34, borderRadius: '4px', background: color, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: textPrimary(isDark), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {b.eventName || b.eventTitle || b.eventType}
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark) }}>{b.eventType}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 26, height: 26, fontSize: 11, fontWeight: 700, bgcolor: color }}>
                          {String(b.customerName || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary(isDark), lineHeight: 1.1 }}>{b.customerName || '—'}</Typography>
                          <Typography sx={{ fontSize: 11, color: textSecondary(isDark) }}>{b.customerPhone || ''}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...cellSx, color: textSecondary(isDark), whiteSpace: 'nowrap' }}>
                      {start ? start.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>{hallLabel(b, halls)}</TableCell>
                    <TableCell sx={cellSx}>{b.guestCount || 0}</TableCell>
                    <TableCell sx={{ ...cellSx, color: textSecondary(isDark) }}>{b.packageName || '—'}</TableCell>
                    <TableCell sx={cellSx}>
                      <Pill label={b.paymentStatus || 'Pending'} color={(PAYMENT_META[b.paymentStatus] || {}).color || '#64748b'} />
                      {(b.remainingAmount || 0) > 0 && (
                        <Typography sx={{ fontSize: 11, color: '#dc2626', fontWeight: 700, mt: 0.4 }}>Bal {money(b.remainingAmount)}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}><Pill label={b.status} color={(STATUS_META[b.status] || {}).color || '#64748b'} /></TableCell>
                    <TableCell sx={{ ...cellSx, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Tooltip title="WhatsApp confirmation" arrow><IconButton size="small" onClick={() => whatsapp(b)} sx={{ color: '#25D366' }}><WhatsApp fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Payments" arrow><IconButton size="small" onClick={() => onPayments?.(b)} sx={{ color: 'var(--app-primary)' }}><PaymentsIcon fontSize="small" /></IconButton></Tooltip>
                      {onFinalize && b.status !== 'Cancelled' && (b.status === 'Completed' || new Date(b.eventDate) <= new Date()) && (
                        <Tooltip title={b.billingFinalized ? 'Billing finalized · edit actual plates' : 'Finalize billing (actual plates consumed)'} arrow>
                          <IconButton size="small" onClick={() => onFinalize(b)} sx={{ color: b.billingFinalized ? '#16a34a' : '#f59e0b' }}>
                            <FactCheckOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Print quotation" arrow><IconButton size="small" onClick={() => onPrintQuotation?.(b)} sx={{ color: '#10b981' }}><PrintOutlined fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Print invoice" arrow><IconButton size="small" onClick={() => onPrintInvoice?.(b)} sx={{ color: '#0f7fc9' }}><ReceiptLongOutlined fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Edit" arrow><IconButton size="small" onClick={() => onEdit?.(b)} sx={{ color: '#2193b0' }}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete" arrow><IconButton size="small" onClick={() => onDelete?.(b)} sx={{ color: '#ef4444' }}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ border: 'none', py: 5, textAlign: 'center', color: textSecondary(isDark) }}>
                    No bookings match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default BookingsTable;
