import {
  Box, Typography, Table, TableRow, TableCell, TableBody, Grid, Stack, Divider,
} from '@mui/material';
import { fmt, cardSx, INCOME_COLOR, EXPENSE_COLOR } from './accountingShared';

const Side = ({ title, rows, total, color }) => (
  <Box sx={cardSx}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="h6" fontWeight={800}>{title}</Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color }}>{fmt(total)}</Typography>
    </Stack>
    <Divider sx={{ mb: 1 }} />
    {(!rows || rows.length === 0) ? (
      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No entries.</Box>
    ) : (
      <Table size="small">
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.category} hover>
              <TableCell sx={{ border: 0 }}>{r.category}</TableCell>
              <TableCell align="right" sx={{ border: 0, fontWeight: 600 }}>{fmt(r.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </Box>
);

const ProfitLossTab = ({ reports }) => {
  const pnl = reports?.pnl || { income: [], expense: [], totalIncome: 0, totalExpense: 0, netProfit: 0 };
  const profit = pnl.netProfit >= 0;
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><Side title="Income" rows={pnl.income} total={pnl.totalIncome} color={INCOME_COLOR} /></Grid>
        <Grid item xs={12} md={6}><Side title="Expenses" rows={pnl.expense} total={pnl.totalExpense} color={EXPENSE_COLOR} /></Grid>
      </Grid>
      <Box sx={{
        ...cardSx, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        borderLeft: `4px solid ${profit ? INCOME_COLOR : EXPENSE_COLOR}`,
      }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{profit ? 'Net Profit' : 'Net Loss'}</Typography>
          <Typography variant="caption" color="text.secondary">Total income − total expenses</Typography>
        </Box>
        <Typography variant="h4" fontWeight={800} sx={{ color: profit ? INCOME_COLOR : EXPENSE_COLOR }}>
          {fmt(Math.abs(pnl.netProfit))}
        </Typography>
      </Box>
    </Stack>
  );
};

export default ProfitLossTab;
