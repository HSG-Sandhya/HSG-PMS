import AccountingEntry from '../models/AccountingEntry.js';

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ACCOUNTS = ['Cash', 'Bank', 'UPI', 'Card', 'Cheque', 'Other'];

// Parse ?from&to into a [from, to] Date range. Defaults to the current month.
const parseRange = (q = {}) => {
  const to = q.to ? new Date(q.to) : new Date();
  to.setHours(23, 59, 59, 999);
  let from;
  if (q.from) {
    from = new Date(q.from);
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date(to.getFullYear(), to.getMonth(), 1, 0, 0, 0, 0);
  }
  return { from, to };
};

// ── Entry CRUD ──────────────────────────────────────────────────────────────

export const getEntries = async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const filter = { date: { $gte: from, $lte: to } };
    if (req.query.entryType) filter.entryType = req.query.entryType;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.account) filter.account = req.query.account;

    const entries = await AccountingEntry.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, data: entries, message: 'Entries fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching entries', error: error.message });
  }
};

export const createEntry = async (req, res) => {
  try {
    const entry = new AccountingEntry({ ...req.body, createdBy: req.user?._id || req.user?.id || null });
    await entry.save();
    res.status(201).json({ success: true, data: entry, message: 'Entry recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating entry', error: error.message });
  }
};

export const updateEntry = async (req, res) => {
  try {
    const entry = await AccountingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    Object.assign(entry, req.body);
    await entry.save(); // pre-validate recomputes gst/total
    res.json({ success: true, data: entry, message: 'Entry updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating entry', error: error.message });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const entry = await AccountingEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting entry', error: error.message });
  }
};

// ── Consolidated reports ─────────────────────────────────────────────────────
// One call returns every report for the period so the UI can switch tabs
// without re-fetching. Cash/Bank opening balances are passed by the caller.
export const getReports = async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const openingCash = Number(req.query.openingCash) || 0;
    const openingBank = Number(req.query.openingBank) || 0;

    const entries = await AccountingEntry.find({ date: { $gte: from, $lte: to } })
      .sort({ date: 1, createdAt: 1 });

    // — Summary + P&L category totals —
    let totalIncome = 0;
    let totalExpense = 0;
    const catIncome = {};
    const catExpense = {};
    const acct = {};
    for (const e of entries) {
      const t = e.total || 0;
      if (e.entryType === 'income') {
        totalIncome += t;
        catIncome[e.category] = (catIncome[e.category] || 0) + t;
      } else {
        totalExpense += t;
        catExpense[e.category] = (catExpense[e.category] || 0) + t;
      }
      acct[e.account] = acct[e.account] || { account: e.account, income: 0, expense: 0 };
      acct[e.account][e.entryType] += t;
    }

    // — Cash Book (account === 'Cash', running balance) —
    let running = openingCash;
    const cashRows = [];
    for (const e of entries) {
      if (e.account !== 'Cash') continue;
      const receipt = e.entryType === 'income' ? e.total : 0;
      const payment = e.entryType === 'expense' ? e.total : 0;
      running += receipt - payment;
      cashRows.push({
        _id: e._id, date: e.date,
        particulars: e.party || e.category,
        category: e.category, description: e.description,
        receipt: round(receipt), payment: round(payment), balance: round(running),
      });
    }
    const cashbook = {
      openingBalance: round(openingCash),
      closingBalance: round(running),
      totalReceipts: round(cashRows.reduce((s, r) => s + r.receipt, 0)),
      totalPayments: round(cashRows.reduce((s, r) => s + r.payment, 0)),
      rows: cashRows,
    };

    // — Ledger Management (by category; income=credit, expense=debit) —
    const ledgerMap = {};
    const partyMap = {};
    for (const e of entries) {
      const l = (ledgerMap[e.category] = ledgerMap[e.category] || { ledger: e.category, type: e.entryType, debit: 0, credit: 0, count: 0 });
      if (e.entryType === 'income') l.credit += e.total; else l.debit += e.total;
      l.count += 1;

      const partyName = (e.party || '').trim();
      if (partyName) {
        const p = (partyMap[partyName] = partyMap[partyName] || { ledger: partyName, debit: 0, credit: 0, count: 0 });
        if (e.entryType === 'income') p.credit += e.total; else p.debit += e.total;
        p.count += 1;
      }
    }
    const ledgers = Object.values(ledgerMap)
      .map((l) => ({ ...l, debit: round(l.debit), credit: round(l.credit), balance: round(l.credit - l.debit) }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    const partyLedgers = Object.values(partyMap)
      .map((p) => ({ ...p, debit: round(p.debit), credit: round(p.credit), balance: round(p.credit - p.debit) }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    // — GST Reports (output = on income, input = on expense) —
    const outputByRate = {};
    const inputByRate = {};
    for (const e of entries) {
      if (!e.gstRate) continue;
      const bucket = e.entryType === 'income' ? outputByRate : inputByRate;
      const row = (bucket[e.gstRate] = bucket[e.gstRate] || { rate: e.gstRate, taxable: 0, gst: 0 });
      row.taxable += e.amount;
      row.gst += e.gstAmount;
    }
    const shape = (m) => Object.values(m)
      .map((r) => ({ rate: r.rate, taxable: round(r.taxable), gst: round(r.gst) }))
      .sort((a, b) => a.rate - b.rate);
    const output = shape(outputByRate);
    const input = shape(inputByRate);
    const outputTotal = round(output.reduce((s, r) => s + r.gst, 0));
    const inputTotal = round(input.reduce((s, r) => s + r.gst, 0));
    const gst = { output, input, outputTotal, inputTotal, netPayable: round(outputTotal - inputTotal) };

    // — Profit & Loss —
    const pnl = {
      income: Object.entries(catIncome).map(([category, total]) => ({ category, total: round(total) })).sort((a, b) => b.total - a.total),
      expense: Object.entries(catExpense).map(([category, total]) => ({ category, total: round(total) })).sort((a, b) => b.total - a.total),
      totalIncome: round(totalIncome),
      totalExpense: round(totalExpense),
      netProfit: round(totalIncome - totalExpense),
    };

    // — Balance Sheet (cash-based as of `to`) —
    const balances = Object.fromEntries(ACCOUNTS.map((a) => [a, 0]));
    balances.Cash += openingCash;
    balances.Bank += openingBank;
    for (const e of entries) {
      balances[e.account] = (balances[e.account] || 0) + (e.entryType === 'income' ? e.total : -e.total);
    }
    const assets = ACCOUNTS
      .filter((a) => Math.abs(balances[a]) > 0.001)
      .map((a) => ({ account: a, balance: round(balances[a]) }));
    const totalAssets = round(assets.reduce((s, a) => s + a.balance, 0));
    const gstPayable = Math.max(0, gst.netPayable);
    const liabilities = gstPayable > 0 ? [{ name: 'GST Payable', amount: round(gstPayable) }] : [];
    const totalLiabilities = round(gstPayable);
    const equity = round(totalAssets - totalLiabilities); // owner's funds / retained earnings
    const balanceSheet = {
      assets, totalAssets, liabilities, totalLiabilities, equity,
      openingCash: round(openingCash), openingBank: round(openingBank),
    };

    res.json({
      success: true,
      message: 'Reports generated',
      data: {
        range: { from, to },
        summary: {
          totalIncome: round(totalIncome),
          totalExpense: round(totalExpense),
          net: round(totalIncome - totalExpense),
          entryCount: entries.length,
          byAccount: Object.values(acct).map((a) => ({
            account: a.account, income: round(a.income), expense: round(a.expense), net: round(a.income - a.expense),
          })),
        },
        cashbook, ledgers, partyLedgers, gst, pnl, balanceSheet,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating reports', error: error.message });
  }
};
