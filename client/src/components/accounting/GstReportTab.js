import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Grid, Stack,
} from '@mui/material';
import { fmt, cardSx, INCOME_COLOR, EXPENSE_COLOR } from './accountingShared';

const GstTable = ({ title, subtitle, rows, total, color }) => (
  <Box sx={cardSx}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <Box>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </Box>
      <Typography variant="h6" fontWeight={800} sx={{ color }}>{fmt(total)}</Typography>
    </Stack>
    {(!rows || rows.length === 0) ? (
      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No GST recorded.</Box>
    ) : (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Rate</TableCell>
            <TableCell align="right">Taxable value</TableCell>
            <TableCell align="right">GST</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.rate} hover>
              <TableCell>{r.rate}%</TableCell>
              <TableCell align="right">{fmt(r.taxable)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(r.gst)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </Box>
);

const GstReportTab = ({ reports }) => {
  const gst = reports?.gst || { output: [], input: [], outputTotal: 0, inputTotal: 0, netPayable: 0 };
  const payable = gst.netPayable >= 0;
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <GstTable title="Output GST" subtitle="GST collected on income / sales" rows={gst.output} total={gst.outputTotal} color={INCOME_COLOR} />
        </Grid>
        <Grid item xs={12} md={6}>
          <GstTable title="Input GST" subtitle="GST paid on expenses / purchases" rows={gst.input} total={gst.inputTotal} color={EXPENSE_COLOR} />
        </Grid>
      </Grid>
      <Box sx={{ ...cardSx, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{payable ? 'Net GST payable' : 'Net GST credit'}</Typography>
          <Typography variant="caption" color="text.secondary">Output GST − Input GST</Typography>
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ color: payable ? EXPENSE_COLOR : INCOME_COLOR }}>
          {fmt(Math.abs(gst.netPayable))}
        </Typography>
      </Box>
    </Stack>
  );
};

export default GstReportTab;
