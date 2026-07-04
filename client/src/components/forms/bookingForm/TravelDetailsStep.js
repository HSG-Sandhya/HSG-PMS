import { Box, Typography, Divider, Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { motion } from 'framer-motion';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import HomeIcon from '@mui/icons-material/Home';
import { sectionVariants, travelModes, purposeOfVisitOptions } from './stepConstants';

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
