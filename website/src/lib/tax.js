import axios from 'axios';

/**
 * The GST rates the server will actually charge.
 *
 * Every page used to compute tax with a literal `* 0.05` and label it "GST (5%)".
 * 5% is only the current default: change posGstRate or roomGstRate in the
 * back-office Settings and the storefront would quote one total while the server
 * charged another, silently, for as long as nobody happened to notice.
 *
 * Nothing here falls back to a literal percentage. A wrong-but-plausible rate is
 * worse than no rate, so callers render the tax line as pending until this
 * resolves rather than inventing a number.
 */

// One request per session, shared by every page that needs it.
let cached = null;
let inflight = null;

export const fetchTaxRates = async () => {
  if (cached) return cached;
  if (!inflight) {
    inflight = axios
      .get('/api/website/tax-config')
      .then(({ data }) => {
        cached = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/**
 * Apply a percentage rate the same way the server does (see
 * server/config/operationalConfig.js), so the figure quoted and the figure
 * charged agree to the rupee rather than to within a rounding step.
 */
export const taxOn = (base, rate, roundAmounts = true) => {
  const amount = (Number(base) || 0) * ((Number(rate) || 0) / 100);
  return roundAmounts ? Math.round(amount) : amount;
};

/** "GST (5%)" once the rate is known, plain "GST" while it is still loading. */
export const taxLabel = (rate) => (rate == null ? 'GST' : `GST (${rate}%)`);
