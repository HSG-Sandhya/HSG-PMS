import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Grid, Stack,
} from '@mui/material';
import { fmt, fmtDate, cardSx, INCOME_COLOR, EXPENSE_COLOR } from './accountingShared';

const Stat = ({ label, value, color }) => (
  <Grid item xs={6} md={3}>
    <Box sx={{ ...cardSx, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: color || 'text.primary' }}>{value}</Typography>
    </Box>
  </Grid>
);

const CashBookTab = ({ reports }) => {
  const cb = reports?.cashbook || { openingBalance: 0, closingBalance: 0, totalReceipts: 0, totalPayments: 0, rows: [] };
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Stat label="Opening" value={fmt(cb.openingBalance)} />
        <Stat label="Receipts" value={fmt(cb.totalReceipts)} color={INCOME_COLOR} />
        <Stat label="Payments" value={fmt(cb.totalPayments)} color={EXPENSE_COLOR} />
        <Stat label="Closing" value={fmt(cb.closingBalance)} color="var(--app-primary)" />
      </Grid>

      <Box sx={cardSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800}>Cash Book</Typography>
          <Typography variant="caption" color="text.secondary">Cash account only</Typography>
        </Stack>
        {cb.rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>No cash movements in this period.</Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Particulars</TableCell>
                  <TableCell align="right">Receipt (Dr)</TableCell>
                  <TableCell align="right">Payment (Cr)</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4}><em>Opening balance</em></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(cb.openingBalance)}</TableCell>
                </TableRow>
                {cb.rows.map((r) => (
                  <TableRow key={r._id} hover>
                    <TableCell>{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      {r.particulars}
                      {r.description ? <Typography variant="caption" display="block" color="text.secondary">{r.description}</Typography> : null}
                    </TableCell>
                    <TableCell align="right" sx={{ color: INCOME_COLOR }}>{r.receipt ? fmt(r.receipt) : '—'}</TableCell>
                    <TableCell align="right" sx={{ color: EXPENSE_COLOR }}>{r.payment ? fmt(r.payment) : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(r.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} sx={{ fontWeight: 800 }}>Closing balance</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'var(--app-primary)' }}>{fmt(cb.closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CashBookTab;
