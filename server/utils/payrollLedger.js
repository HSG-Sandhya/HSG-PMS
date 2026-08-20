// ───────────────────────────────────────────────────────────────────────────
// Payroll ledger rules — shared by the Payroll model (which calculates) and the
// payroll controller (which reports and prints), so a figure never disagrees
// between the payroll table, the salary slip and the stored record.
//
// Salary here is a RUNNING BALANCE, not an isolated monthly payout. Staff draw
// money through the month in several forms — cash advances, part-salary payouts,
// mobile recharges, loans, ad-hoc deductions — and every one of them is
// recovered from that month's earnings. Whatever is left at month end carries
// into the next month in either direction:
//
//   • drew LESS than they earned  → the unpaid balance is a credit next month
//   • drew MORE than they earned  → the excess is a debit recovered next month
//
// Marking a payroll "paid" records what was actually handed over and settles the
// balance, so only the unsettled part rolls forward.
// ───────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const periodLabel = (month, year) => `${MONTH_NAMES[(month || 1) - 1]} ${year}`;

// Calendar bounds of a payroll month.
//
// The end date is the last day at 23:59:59.999, NOT midnight: staff money is
// stamped with a real time of day (UTC noon for a back-dated entry, `Date.now()`
// otherwise), so a midnight end date silently dropped everything taken on the
// last day of the month.
export const periodRange = (month, year) => ({
  startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
  endDate: new Date(year, month, 0, 23, 59, 59, 999),
});

export const previousPeriod = (month, year) =>
  (month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year });

export const nextPeriod = (month, year) =>
  (month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year });

// How each StaffTransaction type lands on the payslip.
//
// Anything the staff member RECEIVED against their salary is a deduction,
// whatever it was called when it was recorded — an "advance", a part payment of
// salary mid-month, a loan, or an explicit deduction. Bonus and overtime are the
// two types that add to pay instead. This mirrors the Money Tracking dialog in
// StaffAttendanceCards, which nets the same types the same way.
export const TAKEN_TYPE_TO_FIELD = {
  advance: 'advance',
  salary: 'salaryPaid',
  loan: 'loan',
  deduction: 'other',
};

export const EARNING_TYPE_TO_FIELD = {
  bonus: 'bonus',
  overtime: 'incentive',
};

// A cancelled transaction never moved any money; a failed or cancelled recharge
// never reached the operator. Neither is recoverable from salary.
const VOID_TXN_STATUSES = new Set(['cancelled']);
const VOID_RECHARGE_STATUSES = new Set(['failed', 'cancelled']);

// Every deduction bucket a staff member can be charged for, in slip order.
export const DEDUCTION_FIELDS = ['advance', 'salaryPaid', 'recharge', 'loan', 'other'];

export const emptyTaken = () => ({ advance: 0, salaryPaid: 0, recharge: 0, loan: 0, other: 0 });

/**
 * Total up everything a staff member took (and was granted) inside one period.
 * @param {Array} transactions StaffTransaction docs dated inside the period
 * @param {Array} recharges    StaffRecharge docs dated inside the period
 * @returns {{taken: object, earned: object, totalTaken: number}}
 */
export const summariseStaffMoney = (transactions = [], recharges = []) => {
  const taken = emptyTaken();
  const earned = { bonus: 0, incentive: 0 };

  for (const txn of transactions || []) {
    if (VOID_TXN_STATUSES.has(txn?.status)) continue;
    const dedField = TAKEN_TYPE_TO_FIELD[txn?.type];
    if (dedField) {
      taken[dedField] += num(txn.amount);
      continue;
    }
    const earnField = EARNING_TYPE_TO_FIELD[txn?.type];
    if (earnField) earned[earnField] += num(txn.amount);
  }

  for (const rch of recharges || []) {
    if (VOID_RECHARGE_STATUSES.has(rch?.status)) continue;
    taken.recharge += num(rch.amount);
  }

  const totalTaken = DEDUCTION_FIELDS.reduce((sum, f) => sum + taken[f], 0);
  return { taken, earned, totalTaken };
};

/**
 * Balance a payroll record leaves behind for the following month.
 * Positive = the hotel still owes the staff member; negative = the staff member
 * has drawn more than they earned and owes the hotel.
 */
export const closingBalanceOf = (payroll) => {
  if (!payroll) return 0;
  const stored = payroll.carryForward?.closing;
  if (stored != null) return num(stored);
  // Records generated before carry-forward existed: a paid payroll settled in
  // full, anything else still stands as it was calculated.
  return payroll.status === 'paid' ? 0 : num(payroll.netSalary);
};

// What a payroll actually pays out. A negative net means the staff member has
// over-drawn — nothing leaves the business, the debit rolls forward instead.
export const payableAmount = (netSalary) => Math.max(0, num(netSalary));

// Human label for a carry-in amount, used by the slip and the dashboard.
export const carryLabel = (amount) => {
  const n = num(amount);
  if (n === 0) return 'No opening balance';
  return n > 0 ? 'Unpaid balance brought forward' : 'Excess drawn last month';
};
