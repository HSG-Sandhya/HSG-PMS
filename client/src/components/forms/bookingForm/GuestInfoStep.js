import { Box, Typography, Divider, Grid, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
import { sectionVariants } from './stepConstants';

// Step 1 of the booking wizard — guest name, contact and demographics.
const GuestInfoStep = ({
  formData,
  handleInputChange,
  inputStyle,
  accentColor,
  fontFamily,
  fontSize,
  emailError,
  setEmailError,
  hideHeader = false,
}) => (
  <motion.div variants={sectionVariants} initial="hidden" animate="visible">
    <Box sx={{ mb: hideHeader ? 0 : 4 }}>
      {!hideHeader && (
        <>
          <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon color="primary" /> Guest Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
        </>
      )}

      <Grid container spacing={3}>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <TextField
            required
            name="guestName"
            label="Guest Name"
            fullWidth
            value={formData.guestName || ''}
            onChange={handleInputChange}
            variant={inputStyle}
            sx={{ borderColor: accentColor, fontFamily, fontSize }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
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
            required
            name="phone"
            label="Phone Number"
            fullWidth
            value={formData.phone || ''}
            onChange={handleInputChange}
            variant={inputStyle}
            sx={{ borderColor: accentColor, fontFamily, fontSize }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="action">+91</Typography>
                  </InputAdornment>
                ),
              },

              htmlInput: { maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }
            }} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <TextField
            name="email"
            label="Email"
            fullWidth
            value={formData.email || ''}
            onChange={(e) => {
              const email = e.target.value;
              handleInputChange(e);

              // Email validation
              if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setEmailError('Please enter a valid email address');
              } else {
                setEmailError('');
              }
            }}
            variant={inputStyle}
            sx={{ borderColor: accentColor, fontFamily, fontSize }}
            type="email"
            error={!!emailError}
            helperText={emailError}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="action">📧</Typography>
                  </InputAdornment>
                ),
              },

              htmlInput: { inputMode: 'email' }
            }} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <TextField
            name="age"
            label="Age"
            type="number"
            fullWidth
            value={formData.age || ''}
            onChange={handleInputChange}
            variant={inputStyle}
            sx={{ borderColor: accentColor, fontFamily, fontSize }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="action">🎂</Typography>
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
            <InputLabel>Gender</InputLabel>
            <Select
              name="gender"
              value={formData.gender || ''}
              onChange={handleInputChange}
              label="Gender"
              variant={inputStyle}
              sx={{ borderColor: accentColor, fontFamily, fontSize }}
              MenuProps={{ slotProps: {
                paper: { sx: { backgroundColor: '#fff' } }
              } }}
            >
              <MenuItem value="">Select Gender</MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
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
            name="nationality"
            label="Nationality"
            fullWidth
            value={formData.nationality || 'Indian'}
            onChange={handleInputChange}
            variant={inputStyle}
            sx={{ borderColor: accentColor, fontFamily, fontSize }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PublicIcon fontSize="small" color="action" />
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
            <InputLabel>Guest Type</InputLabel>
            <Select
              name="guestType"
              value={formData.guestType || 'Individual'}
              onChange={handleInputChange}
              label="Guest Type"
              variant={inputStyle}
              sx={{ borderColor: accentColor, fontFamily, fontSize }}
              MenuProps={{ slotProps: {
                paper: { sx: { backgroundColor: '#fff' } }
              } }}
            >
              <MenuItem value="Individual">Individual</MenuItem>
              <MenuItem value="Corporate">Corporate</MenuItem>
              <MenuItem value="VIP">VIP</MenuItem>
              <MenuItem value="Group">Group</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  </motion.div>
);

export default GuestInfoStep;
