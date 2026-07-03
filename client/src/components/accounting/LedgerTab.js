import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Stack, Chip,
} from '@mui/material';
import { fmt, cardSx, INCOME_COLOR, EXPENSE_COLOR } from './accountingShared';

const LedgerTable = ({ title, subtitle, rows, showType }) => (
  <Box sx={cardSx}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>{title}</Typography>
      {subtitle ? <Typography variant="caption" color="text.secondary">{subtitle}</Typography> : null}
    </Stack>
    {(!rows || rows.length === 0) ? (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No data in this period.</Box>
    ) : (
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell>Ledger</TableCell>
              {showType && <TableCell>Type</TableCell>}
              <TableCell align="right">Debit (paid)</TableCell>
              <TableCell align="right">Credit (received)</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell align="right">Entries</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.ledger} hover>
                <TableCell sx={{ fontWeight: 600 }}>{l.ledger}</TableCell>
                {showType && (
                  <TableCell>
                    <Chip size="small" label={l.type === 'income' ? 'Income' : 'Expense'}
                      sx={{ height: 20, fontWeight: 700, color: '#fff', bgcolor: l.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }} />
                  </TableCell>
                )}
                <TableCell align="right" sx={{ color: EXPENSE_COLOR }}>{l.debit ? fmt(l.debit) : '—'}</TableCell>
                <TableCell align="right" sx={{ color: INCOME_COLOR }}>{l.credit ? fmt(l.credit) : '—'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: l.balance >= 0 ? INCOME_COLOR : EXPENSE_COLOR }}>
                  {fmt(Math.abs(l.balance))} {l.balance >= 0 ? 'Cr' : 'Dr'}
                </TableCell>
                <TableCell align="right">{l.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    )}
  </Box>
);

const LedgerTab = ({ reports }) => (
  <Stack spacing={2}>
    <LedgerTable title="Ledger Management" subtitle="By account head" rows={reports?.ledgers} showType />
    <LedgerTable title="Party Ledgers" subtitle="By customer / vendor" rows={reports?.partyLedgers} />
  </Stack>
);

export default LedgerTab;
