import { useState } from 'react';
import { Box, Typography, Divider, Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Button, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../../api';
import { sectionVariants, travelModes, purposeOfVisitOptions } from './stepConstants';

// 15-character GSTIN: 2-digit state code + 10-char PAN + entity + Z + checksum.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Step 2 of the booking wizard — origin/destination, travel mode, purpose and
// the address block (with best-effort PIN-code → district/state lookup).
const TravelDetailsStep = ({
  formData,
  handleInputChange,
  setFormData,
  inputStyle,
  accentColor,
  fontFamily,
  fontSize,
  pincodeLoading,
  setPincodeLoading,
  lookupPincode,
}) => {
  const fieldSx = { borderColor: accentColor, fontFamily, fontSize };

  const [gstLoading, setGstLoading] = useState(false);
  const [gstStatus, setGstStatus] = useState({ error: false, msg: '' });

  // Look up the GSTIN → registered company name + address, then auto-fill the
  // company field and the address block below. For a business guest the GST-
  // registered address is the authoritative one (the fields stay editable).
  const handleFetchGst = async () => {
    const gst = String(formData.gstNumber || '').replace(/\s+/g, '').toUpperCase();
    if (!GST_REGEX.test(gst)) {
      setGstStatus({ error: true, msg: 'Enter a valid 15-character GSTIN before fetching' });
      return;
    }
    setGstLoading(true);
    setGstStatus({ error: false, msg: '' });
    try {
      const { data } = await api.gst.lookup(gst);
      const c = data?.data;
      if (!data?.success || !c) throw new Error(data?.message || 'Could not fetch GST details');
      const addr = c.address || {};
      setFormData((prev) => ({
        ...prev,
        gstNumber: gst,
        // Only fill the company name if the user hasn't typed one.
        companyName: prev.companyName?.trim() ? prev.companyName : (c.tradeName || c.legalName || ''),
        streetName: addr.street || prev.streetName,
        area: addr.area || prev.area,
        district: addr.district || prev.district,
        state: addr.state || prev.state,
        pincode: addr.pincode || prev.pincode,
      }));
      setGstStatus({
        error: false,
        msg: c.demo
          ? 'Demo mode: sample company details filled (no GST provider configured)'
          : `Fetched: ${c.legalName || c.tradeName || gst}`,
      });
    } catch (err) {
      setGstStatus({ error: true, msg: err.response?.data?.message || err.message || 'Could not fetch GST details' });
    } finally {
      setGstLoading(false);
    }
  };

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" /> Travel Details
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="customerOrigin"
              label="Where customer comes from"
              fullWidth
              value={formData.customerOrigin || ''}
              onChange={handleInputChange}
              variant={inputStyle}
              sx={fieldSx}
              placeholder="e.g., Mumbai, Maharashtra"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <FlightTakeoffIcon color="action" />
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="customerDestination"
              label="Where customer is going"
              fullWidth
              value={formData.customerDestination || ''}
              onChange={handleInputChange}
              variant={inputStyle}
              sx={fieldSx}
              placeholder="e.g., Delhi, NCR"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <FlightLandIcon color="action" />
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <FormControl fullWidth>
              <InputLabel>Travel Mode</InputLabel>
              <Select
                name="travelMode"
                value={formData.travelMode || ''}
                onChange={handleInputChange}
                label="Travel Mode"
                variant={inputStyle}
                sx={fieldSx}
                MenuProps={{ slotProps: {
                  paper: { sx: { backgroundColor: '#fff' } }
                } }}
              >
                <MenuItem value="">Select Travel Mode</MenuItem>
                {travelModes.map((mode) => (
                  <MenuItem key={mode.value} value={mode.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {mode.icon} {mode.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <FormControl fullWidth>
              <InputLabel>Purpose of Visit</InputLabel>
              <Select
                name="purposeOfVisit"
                value={formData.purposeOfVisit || ''}
                onChange={handleInputChange}
                label="Purpose of Visit"
                variant={inputStyle}
                sx={fieldSx}
                MenuProps={{ slotProps: {
                  paper: { sx: { backgroundColor: '#fff' } }
                } }}
              >
                <MenuItem value="">Select Purpose</MenuItem>
                {purposeOfVisitOptions.map((purpose) => (
                  <MenuItem key={purpose} value={purpose}>
                    {purpose}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Company / GST — optional; GSTIN auto-fetches the registered address */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon color="primary" /> Company / GST
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                name="companyName"
                label="Company Name"
                fullWidth
                value={formData.companyName || ''}
                onChange={handleInputChange}
                variant={inputStyle}
                sx={fieldSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon color="action" />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                name="gstNumber"
                label="GST Number"
                placeholder="15-character GSTIN"
                fullWidth
                value={formData.gstNumber || ''}
                onChange={(e) => {
                  const gst = e.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 15);
                  setFormData((prev) => ({ ...prev, gstNumber: gst }));
                  if (gstStatus.msg) setGstStatus({ error: false, msg: '' });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleFetchGst(); }
                }}
                variant={inputStyle}
                sx={fieldSx}
                error={gstStatus.error || (!!formData.gstNumber && !GST_REGEX.test(formData.gstNumber))}
                helperText={
                  gstStatus.msg
                    || (formData.gstNumber && !GST_REGEX.test(formData.gstNumber)
                        ? 'Enter a valid 15-character GSTIN'
                        : "Fetches the company's registered address")
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          size="small"
                          onClick={handleFetchGst}
                          disabled={gstLoading || !GST_REGEX.test(String(formData.gstNumber || ''))}
                          startIcon={gstLoading ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
                          sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 0 }}
                        >
                          {gstLoading ? 'Fetching' : 'Fetch'}
                        </Button>
                      </InputAdornment>
                    ),
                  },

                  htmlInput: { maxLength: 15, style: { textTransform: 'uppercase' } }
                }}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Address Section */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeIcon color="primary" /> Address Details
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField name="streetName" label="Street Name" fullWidth value={formData.streetName || ''} onChange={handleInputChange} variant={inputStyle} sx={fieldSx} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField name="area" label="Area" fullWidth value={formData.area || ''} onChange={handleInputChange} variant={inputStyle} sx={fieldSx} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField name="district" label="District" fullWidth value={formData.district || ''} onChange={handleInputChange} variant={inputStyle} sx={fieldSx} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField name="state" label="State" fullWidth value={formData.state || ''} onChange={handleInputChange} variant={inputStyle} sx={fieldSx} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                name="pincode"
                label="Pincode"
                fullWidth
                value={formData.pincode || ''}
                onChange={(e) => {
                  const pincode = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, pincode }));
                  if (pincode.length !== 6) return;

                  // Best-effort city/state lookup. We avoid native `fetch`
                  // here because some browser extensions (notably MetaMask)
                  // monkey-patch `window.fetch` and dispatch their own
                  // unhandled-promise rejection in parallel — try/catch on
                  // our awaited promise can't suppress that. axios uses
                  // XMLHttpRequest under the hood and isn't intercepted.
                  setPincodeLoading(true);
                  lookupPincode(pincode)
                    .then((result) => {
                      if (!result) return;
                      setFormData(prev => ({
                        ...prev,
                        pincode,
                        district: result.district || prev.district,
                        state:    result.state    || prev.state,
                      }));
                    })
                    .catch(() => { /* silent — fields stay user-editable */ })
                    .finally(() => setPincodeLoading(false));
                }}
                variant={inputStyle}
                sx={fieldSx}
                slotProps={{
                  input: {
                    endAdornment: pincodeLoading ? (
                      <InputAdornment position="end">
                        <Typography variant="body2" color="action">🔄</Typography>
                      </InputAdornment>
                    ) : null,
                  },

                  htmlInput: { maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }
                }} />
            </Grid>
          </Grid>
        </Box>
      </Box>
    </motion.div>
  );
};

export default TravelDetailsStep;
