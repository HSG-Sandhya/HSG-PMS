import {
  isConfigured,
  lookupGstin,
  simulateGstin,
  GSTIN_REGEX,
} from '../services/gstLookup.js';

// POST /api/admin/gst/lookup  { gstNumber }
// Returns the GST-registered company profile + structured address so the guest
// form can auto-fill company + address for a corporate/business guest.
//  • Provider configured  → real GSTIN lookup via Surepass.
//  • Not configured (dev) → clearly-labelled sample, so the flow is testable.
export const lookupGst = async (req, res) => {
  try {
    const gstNumber = String(req.body?.gstNumber || '').replace(/\s+/g, '').toUpperCase();

    if (!GSTIN_REGEX.test(gstNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GST number format (expected a 15-character GSTIN).',
      });
    }

    if (!isConfigured()) {
      // The simulation is a development affordance and must never run on a live
      // system. Front desk had no reliable way to tell sample data from a real
      // lookup: the fields auto-fill either way and the only warning is a
      // transient snackbar, so "Demo Enterprises / Sample District" was one
      // click from being saved onto a real guest and printed on their invoice.
      // In production we refuse instead, and staff type the details in.
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          success: false,
          message: 'GST lookup is not configured on this server. Please enter the company name and address manually.',
        });
      }
      return res.json({
        success: true,
        message: 'Demo mode: no GST provider configured — sample company details returned.',
        data: simulateGstin(gstNumber),
      });
    }

    let company;
    try {
      company = await lookupGstin(gstNumber);
    } catch (err) {
      console.error('GST lookup failed:', err.providerMessage || err.message);
      return res.status(502).json({
        success: false,
        message: err.providerMessage || 'Could not fetch GST details. Please try again.',
      });
    }

    return res.json({
      success: true,
      message: 'GST details fetched successfully',
      data: company,
    });
  } catch (error) {
    console.error('GST lookup error:', error);
    res.status(500).json({ success: false, message: 'Failed to look up GST details' });
  }
};

export default { lookupGst };
