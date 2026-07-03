import {
  Box, Typography, Table, TableRow, TableCell, TableBody, Grid, Stack, Divider,
} from '@mui/material';
import { fmt, cardSx, INCOME_COLOR } from './accountingShared';

const Column = ({ title, rows, total, totalLabel, color }) => (
  <Box sx={cardSx}>
    <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>{title}</Typography>
    <Divider sx={{ mb: 1 }} />
    {(!rows || rows.length === 0) ? (
      <Box sx={{ py: 2, color: 'text.secondary' }}><em>None</em></Box>
    ) : (
      <Table size="small">
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell sx={{ border: 0 }}>{r.label}</TableCell>
              <TableCell align="right" sx={{ border: 0, fontWeight: 600 }}>{fmt(r.value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
    <Divider sx={{ my: 1 }} />
    <Stack direction="row" justifyContent="space-between">
      <Typography fontWeight={800}>{totalLabel}</Typography>
      <Typography fontWeight={800} sx={{ color: color || 'var(--app-primary)' }}>{fmt(total)}</Typography>
    </Stack>
  </Box>
);

const BalanceSheetTab = ({ reports }) => {
  const bs = reports?.balanceSheet || { assets: [], totalAssets: 0, liabilities: [], totalLiabilities: 0, equity: 0 };
  const assetRows = (bs.assets || []).map((a) => ({ label: `${a.account} balance`, value: a.balance }));
  const liabRows = (bs.liabilities || []).map((l) => ({ label: l.name, value: l.amount }));
  const equityAndLiab = bs.totalLiabilities + bs.equity;

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Column title="Assets" rows={assetRows} total={bs.totalAssets} totalLabel="Total Assets" color={INCOME_COLOR} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack spacing={2}>
            <Column title="Liabilities" rows={liabRows} total={bs.totalLiabilities} totalLabel="Total Liabilities" />
            <Column title="Owner's Equity" rows={[{ label: 'Retained earnings / capital', value: bs.equity }]} total={bs.equity} totalLabel="Total Equity" />
          </Stack>
        </Grid>
      </Grid>
      <Box sx={{ ...cardSx, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 520 }}>
          Cash-based statement of financial position. Assets = closing balances across cash/bank/digital accounts.
          Liabilities + Equity always equals Assets.
        </Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">Liabilities + Equity</Typography>
          <Typography variant="h6" fontWeight={800} sx={{ color: 'var(--app-primary)' }}>{fmt(equityAndLiab)}</Typography>
        </Box>
      </Box>
    </Stack>
  );
};

export default BalanceSheetTab;
