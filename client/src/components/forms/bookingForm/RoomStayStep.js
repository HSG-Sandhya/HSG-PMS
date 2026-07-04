import { Box, Typography, Divider, Grid, FormControl, InputLabel, Select, MenuItem, Chip, TextField, InputAdornment } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { parseISO, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import HotelIcon from '@mui/icons-material/Hotel';
import { sectionVariants, currentTimeHHmm } from './stepConstants';

// Parse a "HH:mm" string into a Date for the time pickers.
const timeStringToDate = (value) => {
  if (!value) return null;
  try {
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return isValid(date) ? date : null;
  } catch (error) {
    return null;
  }
};

// Step 3 of the booking wizard — room selection, dates/times and occupancy.
const RoomStayStep = ({
  formData,
  setFormData,
  handleInputChange,
  handleRoomChange,
  handleDateChange,
  handleTimeChange,
  inputStyle,
  accentColor,
  fontFamily,
  fontSize,
  rooms,
  calculateNights,
  hideHeader = false,
  hideRoomSelect = false,
}) => {
  const fieldSx = { borderColor: accentColor, fontFamily, fontSize };

  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Box sx={{ mb: hideHeader ? 0 : 4 }}>
        {!hideHeader && (
          <>
            <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HotelIcon color="primary" /> Room & Stay
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </>
        )}
        <Grid container spacing={3}>
          {!hideRoomSelect && (
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <FormControl fullWidth>
              <InputLabel>Room</InputLabel>
              <Select
                name="roomId"
                value={formData.roomId || ''}
                onChange={handleRoomChange}
                label="Room"
                variant={inputStyle}
                sx={fieldSx}
                MenuProps={{ slotProps: {
                  paper: { sx: { backgroundColor: '#fff' } }
                } }}
              >
                <MenuItem value="">Select Room</MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={room._id} value={room._id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>Room {room.roomNumber} - {room.type}</span>
                      <Chip
                        label={room.status}
                        size="small"
                        color={room.status === 'Available' ? 'success' : 'warning'}
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          )}
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <DatePicker
              label="Check-in Date"
              value={formData.checkInDate ? parseISO(formData.checkInDate) : null}
              onChange={(date) => {
                handleDateChange('checkInDate', date);
                // If no date was previously set, set it now with current time
                if (!formData.checkInDate && date) {
                  setFormData(prev => ({
                    ...prev,
                    checkInDate: date.toISOString(),
                    checkInTime: prev.checkInTime || currentTimeHHmm(),
                  }));
                }
              }}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TimePicker
              label="Check-in Time"
              value={timeStringToDate(formData.checkInTime)}
              onChange={(time) => handleTimeChange('checkInTime', time)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <DatePicker
              label="Check-out Date"
              value={formData.checkOutDate ? parseISO(formData.checkOutDate) : (() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow;
              })()}
              onChange={(date) => handleDateChange('checkOutDate', date)}
              format="dd/MM/yyyy"
              disabled={true}
              slotProps={{
                textField: {
                  fullWidth: true,
                  disabled: true,
                  sx: {
                    '& .MuiInputBase-input': {
                      backgroundColor: '#f5f5f5',
                      color: 'text.secondary',
                    },
                  },
                },
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TimePicker
              label="Check-out Time"
              value={timeStringToDate(formData.checkOutTime)}
              onChange={(time) => handleTimeChange('checkOutTime', time)}
              disabled={true}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              label="Number of Nights"
              fullWidth
              variant="outlined"
              value={calculateNights(formData.checkInDate, formData.checkInTime, formData.checkOutDate, formData.checkOutTime)}
              sx={{
                '& .MuiInputBase-input': {
                  backgroundColor: '#f5f5f5',
                  fontWeight: 600,
                  color: 'primary.main',
                },
              }}
              slotProps={{
                input: { readOnly: true }
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              name="adults"
              label="Adults"
              type="number"
              fullWidth
              value={formData.adults || ''}
              onChange={handleInputChange}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">👥</Typography>
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
              name="children"
              label="Children"
              type="number"
              fullWidth
              value={formData.children || ''}
              onChange={handleInputChange}
              variant={inputStyle}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="body2" color="action">👶</Typography>
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              name="specialRequests"
              label="Special Requests"
              fullWidth
              value={formData.specialRequests || ''}
              onChange={handleInputChange}
              variant={inputStyle}
              sx={fieldSx}
              multiline
              rows={3}
              placeholder="Any special requirements or requests..."
            />
          </Grid>
        </Grid>
      </Box>
    </motion.div>
  );
};

export default RoomStayStep;
