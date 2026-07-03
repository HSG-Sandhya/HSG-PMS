// Selector hooks that expose the resolved Billing & Operations config to any
// component, layering the saved Settings values over the canonical defaults so
// a consumer always gets a complete object even before settings finish loading.
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { BILLING_DEFAULTS, OPERATIONS_DEFAULTS } from '../config/operationalDefaults';

export const useBilling = () => {
  const { settings } = useSettings();
  return useMemo(
    () => ({ ...BILLING_DEFAULTS, ...(settings?.billing || {}) }),
    [settings?.billing]
  );
};

export const useOperations = () => {
  const { settings } = useSettings();
  const saved = settings?.operations || {};
  return useMemo(
    () => ({
      housekeeping: { ...OPERATIONS_DEFAULTS.housekeeping, ...(saved.housekeeping || {}) },
      payroll: { ...OPERATIONS_DEFAULTS.payroll, ...(saved.payroll || {}) },
      accounting: { ...OPERATIONS_DEFAULTS.accounting, ...(saved.accounting || {}) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings?.operations]
  );
};

// Convenience: a currency formatter bound to the live billing config, so a
// component can do `const fmt = useCurrency(); fmt(1234)` → "₹1,234".
export const useCurrency = () => {
  const billing = useBilling();
  return useMemo(() => {
    const symbol = billing.currencySymbol;
    return (n, fractionDigits = 0) =>
      `${symbol}${(Number(n) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}`;
  }, [billing.currencySymbol]);
};
