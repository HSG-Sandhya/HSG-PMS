import { Box, Typography, Divider, Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';
import { motion } from 'framer-motion';
import PaymentIcon from '@mui/icons-material/Payment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { sectionVariants } from './stepConstants';
import { currencySym } from '../../../utils/billing';

// Step 4 of the booking wizard — payment fields and ID-card capture. The ID
// number field swaps to a type-specific formatter as the ID type changes.
const PaymentStep = ({
  formData,
  handleInputChange,
  handlePaidAmountChange,
  inputStyle,
  accentColor,
  fontFamily,
  fontSize,
  handleAadharInput,
  handlePassportInput,
  handleDrivingLicenseInput,
  handleVoterIdInput,
  handlePanCardInput,
  aadharError,
  handleFileChange,
  idCardFile,
  hideImageUpload = false,
}) => {
  const fieldSx = { borderColor: accentColor, fontFamily, fontSize };

  // Prevent Enter key from submitting the form mid-wizard.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const idType = formData.idCardType;
  const idChangeHandler =
    idType === 'Aadhaar Card' ? handleAadharInput :
      idType === 'Passport' ? handlePassportInput :
        idType === 'Driving License' ? handleDrivingLicenseInput :
          idType === 'Voter ID' ? handleVoterIdInput :
            idType === 'PAN Card' ? handlePanCardInput :
              handleInputChange;

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaymentIcon color="primary" /> Payment & Confirmation
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="totalAmount"
              label="Total Amount"
              type="number"
              fullWidth
              value={formData.totalAmount || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">{currencySym()}</Typography>
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
              name="paidAmount"
              label="Paid Amount"
              type="number"
              fullWidth
              value={formData.paidAmount || ''}
              onChange={handlePaidAmountChange}
              onKeyDown={handleKeyDown}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">{currencySym()}</Typography>
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
              <InputLabel>Payment Method</InputLabel>
              <Select
                name="paymentMethod"
                value={formData.paymentMethod || ''}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                label="Payment Method"
                variant={inputStyle}
                sx={fieldSx}
                MenuProps={{ slotProps: {
                  paper: { sx: { backgroundColor: '#fff' } }
                } }}
              >
                <MenuItem value="">Select Method</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Card">Card</MenuItem>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="Net Banking">Net Banking</MenuItem>
                <MenuItem value="pay_at_hotel">Pay at Hotel</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="paymentReference"
              label="Payment Reference"
              fullWidth
              value={formData.paymentReference || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              variant={inputStyle}
              sx={fieldSx}
              placeholder="Transaction ID, UPI reference, etc."
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="discount"
              label="Discount"
              type="number"
              fullWidth
              value={formData.discount || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">%</Typography>
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
              name="gstAmount"
              label="GST Amount"
              type="number"
              fullWidth
              value={formData.gstAmount || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">{currencySym()}</Typography>
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Grid>
        </Grid>

        {/* ID Card Upload Section */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon color="primary" /> ID Card Upload
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <FormControl fullWidth>
                <InputLabel>ID Card Type</InputLabel>
                <Select
                  name="idCardType"
                  value={formData.idCardType || ''}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  label="ID Card Type"
                  variant={inputStyle}
                  sx={fieldSx}
                  MenuProps={{ slotProps: {
                    paper: { sx: { backgroundColor: '#fff' } }
                  } }}
                >
                  <MenuItem value="">Select Type</MenuItem>
                  <MenuItem value="Aadhaar Card">Aadhaar Card</MenuItem>
                  <MenuItem value="Passport">Passport</MenuItem>
                  <MenuItem value="Driving License">Driving License</MenuItem>
                  <MenuItem value="Voter ID">Voter ID</MenuItem>
                  <MenuItem value="PAN Card">PAN Card</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                name="idCardNumber"
                label="ID Card Number"
                fullWidth
                required={idType === 'Aadhaar Card'}
                value={formData.idCardNumber || ''}
                onChange={idChangeHandler}
                onKeyDown={handleKeyDown}
                variant={inputStyle}
                sx={fieldSx}
                error={idType === 'Aadhaar Card' && !!aadharError}
                helperText={idType === 'Aadhaar Card' ? aadharError : ''}
                placeholder={
                  idType === 'Aadhaar Card' ? 'XXXX-XXXX-XXXX' :
                    idType === 'Passport' ? 'AA1234567BB' :
                      idType === 'Driving License' ? 'AA12 12345678901' :
                        idType === 'Voter ID' ? 'ABC1234567' :
                          idType === 'PAN Card' ? 'ABCDE1234F' :
                            'Enter ID Card Number'
                }
                slotProps={{
                  htmlInput: {
                    maxLength:
                      idType === 'Aadhaar Card' ? 14 : // 12 digits + 2 hyphens
                        idType === 'Passport' ? 11 : // 2 alphabets + 7 digits + 2 optional alphabets
                          idType === 'Driving License' ? 15 : // 2 alphabets + 2 digits + space + 11 digits
                            idType === 'Voter ID' ? 10 : // 3 alphabets + 7 digits
                              idType === 'PAN Card' ? 10 : // 5 alphabets + 4 digits + 1 alphabet
                                undefined,
                    pattern:
                      idType === 'Aadhaar Card' ? '[0-9\\-]*' :
                        idType === 'Passport' ? '[A-Z0-9]*' :
                          idType === 'Driving License' ? '[A-Z0-9\\s]*' :
                            idType === 'Voter ID' ? '[A-Z0-9]*' :
                              idType === 'PAN Card' ? '[A-Z0-9]*' :
                                undefined,
                  }
                }}
              />
            </Grid>
            {!hideImageUpload && (
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{
                  borderStyle: 'dashed',
                  borderColor: accentColor,
                  color: accentColor,
                  fontWeight: 600,
                  py: 2,
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'primary.light',
                    color: 'primary.dark',
                  },
                }}
              >
                📷 Upload {idType || 'ID Card'} Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </Button>
              {idCardFile && (
                <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
                  ✅ Selected: {idCardFile.name}
                </Typography>
              )}
            </Grid>
            )}
          </Grid>
        </Box>
      </Box>
    </motion.div>
  );
};

export default PaymentStep;
