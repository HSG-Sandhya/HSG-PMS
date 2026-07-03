export const escapeHtml = (input) => {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const formatNumber = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(value);
  }
};

export const formatLongDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(value);
  }
};

export const formatTime = (value) => {
  if (!value) return '—';
  if (typeof value === 'string' && value.includes(':')) {
    const [h, m] = value.split(':');
    const hour = Number(h);
    if (Number.isFinite(hour)) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${display}:${m} ${period}`;
    }
  }
  return String(value);
};

// SAC codes per service category — used by the GST-forward templates so each
// line carries the right tax-classification code.
const SAC_BY_CATEGORY = {
  room: '996311',
  hall: '996334',
  restaurant: '996331',
  meals: '996331',
  side: '996331',
  extra: '996331',
};

export const hsnFor = (category) => SAC_BY_CATEGORY[category] || '996311';

// Per-line GST split — base templates carry GST as a single 5% bucket; the
// modern templates surface CGST/SGST per line.
export const splitItemTax = (item, rate = 0.05) => {
  const gross = Number(item.amount || 0);
  const taxable = gross / (1 + rate);
  const tax = gross - taxable;
  return {
    taxable: Math.round(taxable * 100) / 100,
    cgst: Math.round((tax / 2) * 100) / 100,
    sgst: Math.round((tax / 2) * 100) / 100,
    gross: Math.round(gross * 100) / 100,
  };
};

export const amountInWords = (rupees) => {
  const amount = Math.round(Number(rupees) || 0);
  if (amount === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigit = (n) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
  };

  const threeDigit = (n) => {
    if (n < 100) return twoDigit(n);
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigit(n % 100)}` : ''}`;
  };

  let n = amount;
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const remainder = n;

  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${twoDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigit(thousand)} Thousand`);
  if (remainder) parts.push(threeDigit(remainder));

  return `${parts.join(' ')} Rupees Only`;
};
