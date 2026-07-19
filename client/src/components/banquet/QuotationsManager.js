import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, TextField, Select, MenuItem, Button, InputAdornment, CircularProgress,
} from '@mui/material';
import {
  Search, Add as AddIcon, PrintOutlined, EditOutlined, DeleteOutlined,
  ContentCopyOutlined, WhatsApp, EventAvailableOutlined, RequestQuoteOutlined,
} from '@mui/icons-material';
import { glassCard, textPrimary, textSecondary, money } from '../../pages/management/banquet/banquetDash';
import QuotationBuilder from './QuotationBuilder';
import ConvertQuotationDialog from './ConvertQuotationDialog';
import { STATUS_COLOR, QUOTATION_STATUSES, packageTotal, effectiveStatus } from './quotationPresets';
import api from '../../api';

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

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Headline value of a quotation for the list — the recommended package, else the
// first one. A quotation quotes options, so there is no single "total".
const headlineValue = (q) => {
  const packages = q.packages || [];
  if (!packages.length) return 0;
  const pick = packages.find((p) => p.recommended) || packages[0];
  return packageTotal(pick, q.expectedGuests);
};

/**
 * Sales quotations for banquet enquiries: build a package proposal, print the
 * A4 sheet for the client, and convert the accepted one into a booking that
 * bills through the normal invoice flow.
 */
const QuotationsManager = ({ halls = [], isDark = false, onNotify, onConverted }) => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.banquet.getQuotations();
      setQuotations(data?.data || []);
    } catch {
      onNotify?.('Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotations.filter((row) => {
      // Filter on the displayed status so "Expired" matches what staff see.
      if (status !== 'All' && effectiveStatus(row) !== status) return false;
      if (!q) return true;
      return [row.quotationNumber, row.clientName, row.clientCompany, row.clientPhone, row.eventType, row.eventTitle]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [quotations, query, status]);

  // The sheet is rendered server-side so it matches the hotel profile and the
  // printed identity everywhere else in the PMS.
  const printQuotation = async (row) => {
    const win = window.open('', '_blank');
    if (!win) { onNotify?.('Allow popups for this site to print', 'warning'); return; }
    try {
      const { data } = await api.banquet.printQuotation(row._id);
      win.document.open();
      win.document.write(data);
      win.document.close();
      win.onload = () => setTimeout(() => { win.print(); win.close(); }, 500);
    } catch (err) {
      win.close();
      onNotify?.(err.response?.data?.message || 'Failed to render quotation', 'error');
    }
  };

  const shareOnWhatsApp = (row) => {
    const digits = String(row.clientPhone || '').replace(/\D/g, '');
    if (!digits) { onNotify?.('No mobile number on this quotation', 'warning'); return; }
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const msg = `Hello ${row.clientName}, thank you for your enquiry. Please find our quotation ${row.quotationNumber} for your ${row.eventTitle || row.eventType}${row.eventDate ? ` on ${fmtDate(row.eventDate)}` : ''}. It is valid up to ${fmtDate(row.validUpto)}. We look forward to hosting you.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const duplicate = async (row) => {
    try {
      await api.banquet.duplicateQuotation(row._id);
      onNotify?.('Quotation duplicated as a new draft', 'success');
      fetchQuotations();
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Duplicate failed', 'error');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete quotation ${row.quotationNumber}?`)) return;
    try {
      await api.banquet.deleteQuotation(row._id);
      onNotify?.('Quotation deleted', 'info');
      fetchQuotations();
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const cellSx = { border: 'none', py: 1.25, color: textPrimary(isDark) };
  const controlSx = {
    '& .MuiOutlinedInput-root': { borderRadius: '12px', background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.7)' },
  };

  return (
    <Box sx={{ ...glassCard(isDark), p: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <RequestQuoteOutlined sx={{ color: 'var(--app-primary)' }} />
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark), lineHeight: 1.1 }}>
            Event Quotations
          </Typography>
          <Typography sx={{ fontSize: 12, color: textSecondary(isDark) }}>
            {quotations.length} proposal{quotations.length === 1 ? '' : 's'} · conference, meeting, corporate &amp; celebrations
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Search number, client, event…"
            value={query} onChange={(e) => setQuery(e.target.value)}
            sx={{ ...controlSx, minWidth: 230 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
          />
          <Select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ ...controlSx, minWidth: 130 }}>
            {['All', ...QUOTATION_STATUSES].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditing(null); setBuilderOpen(true); }}
            sx={{
              borderRadius: '999px', fontWeight: 700, textTransform: 'none',
              background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))',
            }}
          >
            New Quotation
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <RequestQuoteOutlined sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            {quotations.length === 0
              ? 'No quotations yet. Build a package proposal for a conference, meeting or celebration enquiry.'
              : 'No quotations match this search.'}
          </Typography>
          {quotations.length === 0 && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setEditing(null); setBuilderOpen(true); }}
              sx={{ borderRadius: '999px', fontWeight: 700, textTransform: 'none' }}>
              Create the first quotation
            </Button>
          )}
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Quotation', 'Client', 'Event', 'Event date', 'Valid upto', 'Packages', 'From', 'Status', ''].map((h, i) => (
                  <TableCell key={h + i} sx={{ ...headCellSx(isDark), textAlign: i === 6 ? 'right' : 'left' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const locked = row.status === 'Converted';
                const shownStatus = effectiveStatus(row);
                return (
                  <TableRow key={row._id} hover>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{row.quotationNumber}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark) }}>{fmtDate(row.quotationDate)}</Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.clientCompany || row.clientName}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark) }}>
                        {row.clientCompany ? `${row.clientName} · ` : ''}{row.clientPhone || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Typography sx={{ fontSize: 13 }}>{row.eventTitle || row.eventType}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark) }}>
                        {row.expectedGuests ? `${row.expectedGuests} pax` : '—'}{row.seatingStyle ? ` · ${row.seatingStyle}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cellSx}>{fmtDate(row.eventDate)}</TableCell>
                    <TableCell sx={{ ...cellSx, color: shownStatus === 'Expired' ? '#f59e0b' : undefined }}>
                      {fmtDate(row.validUpto)}
                    </TableCell>
                    <TableCell sx={cellSx}>{(row.packages || []).length}</TableCell>
                    <TableCell sx={{ ...cellSx, textAlign: 'right', fontWeight: 700 }}>{money(headlineValue(row))}</TableCell>
                    <TableCell sx={cellSx}>
                      <Pill label={shownStatus} color={STATUS_COLOR[shownStatus] || '#94a3b8'} />
                    </TableCell>
                    <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                      <Tooltip title="Print quotation" arrow>
                        <IconButton size="small" onClick={() => printQuotation(row)} sx={{ color: '#10b981' }}>
                          <PrintOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Send on WhatsApp" arrow>
                        <IconButton size="small" onClick={() => shareOnWhatsApp(row)} sx={{ color: '#25D366' }}>
                          <WhatsApp fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={locked ? 'Already converted to a booking' : 'Convert to booking'} arrow>
                        <span>
                          <IconButton size="small" disabled={locked} onClick={() => setConvertTarget(row)} sx={{ color: '#8b5cf6' }}>
                            <EventAvailableOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Duplicate" arrow>
                        <IconButton size="small" onClick={() => duplicate(row)} sx={{ color: '#0ea5e9' }}>
                          <ContentCopyOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={locked ? 'Converted quotations are locked' : 'Edit'} arrow>
                        <span>
                          <IconButton size="small" disabled={locked} onClick={() => { setEditing(row); setBuilderOpen(true); }} sx={{ color: 'var(--app-primary)' }}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete" arrow>
                        <IconButton size="small" onClick={() => remove(row)} sx={{ color: '#ef4444' }}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <QuotationBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        editing={editing}
        halls={halls}
        onNotify={onNotify}
        onSaved={fetchQuotations}
      />
      <ConvertQuotationDialog
        open={!!convertTarget}
        quotation={convertTarget}
        onClose={() => setConvertTarget(null)}
        onNotify={onNotify}
        onConverted={() => { fetchQuotations(); onConverted?.(); }}
      />
    </Box>
  );
};

export default QuotationsManager;
