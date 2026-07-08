import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  CircularProgress,
  InputAdornment,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Person as PersonIcon,
  Badge as BadgeIcon,
  Work as WorkIcon,
  Fingerprint as FingerprintIcon,
  ContactPhone as ContactPhoneIcon,
  Verified as VerifiedIcon,
  Send as SendIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import FormDialog, { FormSection } from './forms/FormDialog';
import AppDatePicker from './forms/AppDatePicker';
import api from '../api';
import { currencySym } from '../utils/billing';

// Per-section accent styling layered on top of the shared FormSection: a soft
// gradient "spine" down the left edge, a lift-on-hover glow, and a colour focus
// ring on the inputs — all keyed off the section's accent colour.
const accentSx = (accent) => ({
  position: 'relative',
  overflow: 'hidden',
  transition: 'box-shadow .3s ease, border-color .3s ease',
  '&::before': {
    content: '""',
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    background: `linear-gradient(180deg, ${accent}, ${accent}22)`,
  },
  '&:hover': {
    borderColor: `${accent}66`,
    boxShadow: `0 16px 36px -22px ${accent}`,
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    transition: 'box-shadow .2s ease',
    '&.Mui-focused': { boxShadow: `0 0 0 3px ${accent}22` },
  },
});

// A FormSection that cascades up into view on mount (staggered by `index`) and
// carries a colour accent. When `complete` is true, a check pops in beside the
// title — a live "this section's required fields are done" cue.
const AnimatedSection = ({ index = 0, iconColor = '#6366f1', title, complete = false, sx, children, ...rest }) => {
  const titleNode = (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      {title}
      <AnimatePresence>
        {complete && (
          <Box
            component={motion.span}
            key="section-done"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            sx={{ display: 'inline-flex', color: iconColor }}
          >
            <CheckCircleIcon sx={{ fontSize: 15 }} />
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.07 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <FormSection title={titleNode} iconColor={iconColor} {...rest} sx={{ ...accentSx(iconColor), ...(sx || {}) }}>
        {children}
      </FormSection>
    </Box>
  );
};

// Little spring "pop" for status chips (OTP Sent / Verified).
const PopChip = ({ children }) => (
  <Box
    component={motion.span}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
    sx={{ display: 'inline-flex' }}
  >
    {children}
  </Box>
);

const EMPTY_FORM_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  roleId: '',
  departmentId: '',
  generateCredentials: true,
  profile: {
    employeeId: '',
    address: '',
    dateOfBirth: '',
    salary: '',
    aadharNumber: '',
    aadharImageUrl: '',
    aadharFrontUrl: '',
    aadharBackUrl: '',
    aadharVerified: false,
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
    },
  },
};

const StaffDialog = ({ open, onClose, onSuccess, editingStaff, roles: propRoles, departments: propDepartments }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState(propRoles || []);
  const [departments, setDepartments] = useState(propDepartments || []);
  const [aadharFrontImage, setAadharFrontImage] = useState(null);
  const [aadharBackImage, setAadharBackImage] = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState('');
  const [aadharBackPreview, setAadharBackPreview] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [receivedOtp, setReceivedOtp] = useState('');

  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const errorRef = useRef(null);

  // The form is long; when a submit error appears at the top, bring it into
  // view so the user actually sees why "Create Staff" failed (e.g. a duplicate
  // email/phone) instead of just a silent console 400.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  useEffect(() => {
    if (open) {
      if (propRoles && propDepartments) {
        setRoles(propRoles);
        setDepartments(propDepartments);
      } else {
        loadInitialData();
      }
      
      // If editing, populate form with staff data
      if (editingStaff) {
        setFormData({
          firstName: editingStaff.firstName || '',
          lastName: editingStaff.lastName || '',
          email: editingStaff.email || '',
          phone: editingStaff.phone || '',
          roleId: editingStaff.role?._id || editingStaff.role?.id || editingStaff.roleId || '',
          departmentId: editingStaff.department?._id || editingStaff.department?.id || editingStaff.departmentId || '',
          generateCredentials: false, // Don't regenerate credentials when editing
          profile: {
            employeeId: editingStaff.profile?.employeeId || editingStaff.employeeId || '',
            address: editingStaff.profile?.address || '',
            dateOfBirth: editingStaff.profile?.dateOfBirth ? editingStaff.profile.dateOfBirth.split('T')[0] : '',
            salary: editingStaff.profile?.salary || '',
            aadharNumber: editingStaff.profile?.aadharNumber || '',
            aadharImageUrl: editingStaff.profile?.aadharImageUrl || '',
            aadharFrontUrl: editingStaff.profile?.aadharFrontUrl || '',
            aadharBackUrl: editingStaff.profile?.aadharBackUrl || '',
            aadharVerified: editingStaff.profile?.aadharVerified || false,
            emergencyContact: {
              name: editingStaff.profile?.emergencyContact?.name || '',
              phone: editingStaff.profile?.emergencyContact?.phone || '',
              relationship: editingStaff.profile?.emergencyContact?.relationship || ''
            }
          }
        });
        
        // Set image previews if URLs exist
        setAadharFrontPreview(editingStaff.profile?.aadharFrontUrl || '');
        setAadharBackPreview(editingStaff.profile?.aadharBackUrl || '');
        setOtpSent(false);
        setOtpVerified(editingStaff.profile?.aadharVerified || false);
        setOtp('');
        setReceivedOtp('');
        setAadharFrontImage(null);
        setAadharBackImage(null);
      } else {
        // Reset form for new staff
        setFormData(EMPTY_FORM_DATA);
        setOtpSent(false);
        setOtpVerified(false);
        setOtp('');
        setReceivedOtp('');
        setAadharFrontImage(null);
        setAadharBackImage(null);
        setAadharFrontPreview('');
        setAadharBackPreview('');
      }
    }
  }, [open, editingStaff, propRoles, propDepartments]);

  const loadInitialData = async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        api.get('/admin/roles'),
        api.departments.getAll()
      ]);
      
      setRoles(rolesRes.data.data || []);
      setDepartments(deptsRes.data.data || deptsRes.data || []);
    } catch (err) {
      setError('Failed to load roles and departments');
    }
  };

  // Aadhar verification functions
  const handleAadharImageUpload = (event, side) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Aadhar image must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (side === 'front') {
          setAadharFrontImage(file);
          setAadharFrontPreview(e.target.result);
        } else {
          setAadharBackImage(file);
          setAadharBackPreview(e.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const sendOtpForAadhar = async () => {
    if (!formData.profile.aadharNumber || formData.profile.aadharNumber.length !== 12) {
      setError('Please enter a valid 12-digit Aadhar number');
      return;
    }

    try {
      setOtpLoading(true);
      setError('');
      
      // Simulate OTP sending (replace with actual API call)
      const response = await api.post('/admin/aadhar/send-otp', {
        aadharNumber: formData.profile.aadharNumber
      });
      
      if (response.data.success) {
        setOtpSent(true);
        setError('');
        // Show OTP in development mode
        if (response.data.data.testOTP) {
          setReceivedOtp(response.data.data.testOTP);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setOtpLoading(true);
      setError('');
      
      // Simulate OTP verification (replace with actual API call)
      const response = await api.post('/admin/aadhar/verify-otp', {
        aadharNumber: formData.profile.aadharNumber,
        otp: otp
      });
      
      if (response.data.success) {
        setOtpVerified(true);
        handleInputChange('profile.aadharVerified', true);
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child, grandchild] = field.split('.');
      if (grandchild) {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [child]: {
              ...(prev[parent]?.[child] || {}),
              [grandchild]: value
            }
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [child]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.phone || !formData.roleId || !formData.departmentId) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Upload Aadhar images only if new images are provided
      let aadharFrontUrl = formData.profile.aadharFrontUrl || '';
      let aadharBackUrl = formData.profile.aadharBackUrl || '';
      
      // Only upload front image if a new one is selected
      if (aadharFrontImage && aadharFrontImage instanceof File) {
        const frontFormData = new FormData();
        frontFormData.append('aadharImage', aadharFrontImage);
        frontFormData.append('side', 'front');
        
        try {
          const uploadResponse = await api.post('/admin/aadhar/upload', frontFormData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          aadharFrontUrl = uploadResponse.data.data.url;
        } catch (uploadErr) {
          console.error('Front image upload error:', uploadErr);
          setError('Failed to upload Aadhar front image');
          return;
        }
      }
      
      // Only upload back image if a new one is selected
      if (aadharBackImage && aadharBackImage instanceof File) {
        const backFormData = new FormData();
        backFormData.append('aadharImage', aadharBackImage);
        backFormData.append('side', 'back');
        
        try {
          const uploadResponse = await api.post('/admin/aadhar/upload', backFormData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          aadharBackUrl = uploadResponse.data.data.url;
        } catch (uploadErr) {
          console.error('Back image upload error:', uploadErr);
          setError('Failed to upload Aadhar back image');
          return;
        }
      }

      const staffData = {
        ...formData,
        profile: {
          ...formData.profile,
          aadharFrontUrl,
          aadharBackUrl
        }
      };

      const response = editingStaff 
        ? await api.put(`/admin/staff/${editingStaff._id || editingStaff.id}`, staffData)
        : await api.post('/admin/staff', staffData);
      
      if (response.data.success) {
        onSuccess(response.data.data);
        handleClose();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || `Failed to ${editingStaff ? 'update' : 'create'} staff member`;
      
      // Provide more specific error messages for common validation errors
      if (errorMessage.includes('email, phone, or username already exists')) {
        setError('A user with this email, phone number, or username already exists. Please use different contact details.');
      } else if (errorMessage.includes('email')) {
        setError('This email address is already registered. Please use a different email.');
      } else if (errorMessage.includes('phone')) {
        setError('This phone number is already registered. Please use a different phone number.');
      } else if (errorMessage.includes('username')) {
        setError('This username is already taken. Please choose a different username.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData(EMPTY_FORM_DATA);
    setError('');
    onClose();
  };

  // Live "section done" cues — only the sections with required fields.
  const basicComplete = Boolean(
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    formData.phone.length === 10
  );
  const roleComplete = Boolean(formData.roleId && formData.departmentId);

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      maxWidth="md"
      icon={<PersonIcon />}
      eyebrow="Workforce"
      title={editingStaff ? 'Edit Staff Member' : 'Create New Staff Member'}
      submitDisabled={loading}
      submitLabel={loading ? (editingStaff ? 'Updating...' : 'Creating...') : (editingStaff ? 'Update Staff' : 'Create Staff')}
    >
      {error && (
        <Alert ref={errorRef} severity="error" sx={{ scrollMarginTop: 16 }}>
          {error}
        </Alert>
      )}
      <AnimatedSection index={0} complete={basicComplete} title="Basic Information" icon={<PersonIcon fontSize="small" />} iconColor="#06b6d4">
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => {
                let value = e.target.value;
                // Remove +91 if user tries to type it
                if (value.startsWith('+91')) {
                  value = value.substring(3);
                }
                // Only allow digits and limit to 10
                value = value.replace(/\D/g, '').slice(0, 10);
                handleInputChange('phone', value);
              }}
              required
              helperText="10-digit phone number"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      +91
                    </InputAdornment>
                  )
                },

                htmlInput: { maxLength: 10 }
              }} />
          </Grid>
        </Grid>
      </AnimatedSection>
      <AnimatedSection index={1} complete={roleComplete} title="Role & Department" icon={<WorkIcon fontSize="small" />} iconColor="#6366f1">
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <FormControl fullWidth required>
              <InputLabel>Role</InputLabel>
              <Select
                value={roles.some((r) => (r._id || r.id) === formData.roleId) ? formData.roleId : ''}
                onChange={(e) => handleInputChange('roleId', e.target.value)}
                MenuProps={{
                  slotProps: {
                    paper: {
                      sx: {
                        backgroundColor: '#ffffff',
                        backgroundImage: 'none',
                        boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)'
                      }
                    }
                  }
                }}
              >
                {roles?.map(role => (
                  <MenuItem key={role._id || role.id} value={role._id || role.id}>
                    {role.name} (Level {role.hierarchy})
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
            <FormControl fullWidth required>
              <InputLabel>Department</InputLabel>
              <Select
                value={departments.some((d) => (d._id || d.id) === formData.departmentId) ? formData.departmentId : ''}
                onChange={(e) => handleInputChange('departmentId', e.target.value)}
                MenuProps={{
                  slotProps: {
                    paper: {
                      sx: {
                        backgroundColor: '#ffffff',
                        backgroundImage: 'none',
                        boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)'
                      }
                    }
                  }
                }}
              >
                {departments?.map(dept => (
                  <MenuItem key={dept._id || dept.id} value={dept._id || dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </AnimatedSection>
      <AnimatedSection index={2} title="Profile Information (Optional)" icon={<BadgeIcon fontSize="small" />} iconColor="#a21caf">
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Employee ID"
              value={formData.profile.employeeId}
              onChange={(e) => handleInputChange('profile.employeeId', e.target.value)}
              helperText="Leave empty to auto-generate"
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Salary"
              type="number"
              value={formData.profile.salary}
              onChange={(e) => handleInputChange('profile.salary', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {currencySym()}
                    </InputAdornment>
                  )
                },

                htmlInput: { min: 0 }
              }} />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={2}
              value={formData.profile.address}
              onChange={(e) => handleInputChange('profile.address', e.target.value)}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 4
            }}>
            <AppDatePicker
              label="Date of Birth"
              value={formData.profile.dateOfBirth}
              onChange={(v) => handleInputChange('profile.dateOfBirth', v)}
            />
          </Grid>
        </Grid>
      </AnimatedSection>
      <AnimatedSection index={3} title="Aadhar Verification" icon={<FingerprintIcon fontSize="small" />} iconColor="#10b981">
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <TextField
              fullWidth
              label="Aadhar Number"
              value={formData.profile.aadharNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                handleInputChange('profile.aadharNumber', value);
              }}
              helperText="12-digit Aadhar number"
              slotProps={{
                htmlInput: { maxLength: 12 }
              }}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={sendOtpForAadhar}
                disabled={!formData.profile.aadharNumber || formData.profile.aadharNumber.length !== 12 || otpLoading}
                startIcon={otpLoading ? <CircularProgress size={20} /> : <SendIcon />}
              >
                {otpLoading ? 'Sending...' : 'Send OTP'}
              </Button>
              {otpSent && (
                <PopChip>
                  <Chip
                    label="OTP Sent"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                </PopChip>
              )}
            </Box>
          </Grid>

          {/* OTP entry — smoothly reveals once the OTP has been sent */}
          <Grid size={12}>
            <Collapse in={otpSent} timeout={350} unmountOnExit>
              <Grid container spacing={2} sx={{ pt: 0.5 }}>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <TextField
                    fullWidth
                    label="Enter OTP"
                    value={otp || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(value);
                    }}
                    helperText="6-digit OTP sent to registered mobile"
                    slotProps={{
                      htmlInput: { maxLength: 6 }
                    }}
                  />
                </Grid>

                {receivedOtp && (
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
                      <strong>Development OTP: {receivedOtp}</strong>
                    </Alert>
                  </Grid>
                )}

                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={verifyOtp}
                      disabled={!otp || otp.length !== 6}
                      startIcon={<VerifiedIcon />}
                    >
                      Verify OTP
                    </Button>
                    {otpVerified && (
                      <PopChip>
                        <Chip
                          label="Verified"
                          color="success"
                          size="small"
                          icon={<CheckCircleIcon />}
                        />
                      </PopChip>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Collapse>
          </Grid>

          {/* Aadhar Image Upload - Front and Back */}
          <Grid size={12}>
            <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
              Upload Aadhar Card Images
            </Typography>
            
            <Grid container spacing={2}>
              {/* Front Image */}
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Front Side
                  </Typography>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="aadhar-front-upload"
                    type="file"
                    key={`front-${open}`}
                    onChange={(e) => handleAadharImageUpload(e, 'front')}
                  />
                  <label htmlFor="aadhar-front-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<ImageIcon />}
                      fullWidth
                    >
                      Choose Front Image
                    </Button>
                  </label>
                  
                  {aadharFrontPreview && (
                    <Box sx={{ mt: 1 }}>
                      <img
                        src={aadharFrontPreview}
                        alt="Aadhar Front Preview"
                        style={{
                          width: '100%',
                          maxHeight: '120px',
                          objectFit: 'contain',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Back Image */}
              <Grid
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Back Side
                  </Typography>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="aadhar-back-upload"
                    type="file"
                    key={`back-${open}`}
                    onChange={(e) => handleAadharImageUpload(e, 'back')}
                  />
                  <label htmlFor="aadhar-back-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<ImageIcon />}
                      fullWidth
                    >
                      Choose Back Image
                    </Button>
                  </label>
                  
                  {aadharBackPreview && (
                    <Box sx={{ mt: 1 }}>
                      <img
                        src={aadharBackPreview}
                        alt="Aadhar Back Preview"
                        style={{
                          width: '100%',
                          maxHeight: '120px',
                          objectFit: 'contain',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </AnimatedSection>
      <AnimatedSection index={4} title="Emergency Contact (Optional)" icon={<ContactPhoneIcon fontSize="small" />} iconColor="#f59e0b">
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 4
            }}>
            <TextField
              fullWidth
              label="Contact Name"
              value={formData.profile.emergencyContact.name}
              onChange={(e) => handleInputChange('profile.emergencyContact.name', e.target.value)}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 4
            }}>
            <TextField
              fullWidth
              label="Contact Phone"
              value={formData.profile.emergencyContact.phone}
              onChange={(e) => handleInputChange('profile.emergencyContact.phone', e.target.value)}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 4
            }}>
            <TextField
              fullWidth
              label="Relationship"
              value={formData.profile.emergencyContact.relationship}
              onChange={(e) => handleInputChange('profile.emergencyContact.relationship', e.target.value)}
              placeholder="e.g., Spouse, Parent, Sibling"
            />
          </Grid>
        </Grid>
      </AnimatedSection>
      {!editingStaff && (
        <AnimatedSection index={5} title="Login Credentials" icon={<VerifiedIcon fontSize="small" />} iconColor="#6366f1">
          <FormControlLabel
            control={
              <Switch
                checked={formData.generateCredentials}
                onChange={(e) => handleInputChange('generateCredentials', e.target.checked)}
              />
            }
            label="Auto-generate login credentials"
          />
        </AnimatedSection>
      )}
    </FormDialog>
  );
};

export default StaffDialog;
