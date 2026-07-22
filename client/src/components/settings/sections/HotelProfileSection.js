import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Button,
  Avatar,
  Stack,
  Divider,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { CloudUpload as UploadIcon, Save as SaveIcon, CheckCircleRounded as CheckCircleIcon } from '@mui/icons-material';
import api from '../../../api';
import RichTextField from '../../common/RichTextField';
import { useSettings } from '../../../contexts/SettingsContext';
import { broadcastSettingsChange } from '../settingsEvents';

const emptyProfile = {
  hotelName: '',
  legalName: '',
  description: '',
  logo: '',
  address: {
    line1: '',
    line2: '',
    area: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  },
  contact: {
    phone: '',
    altPhone: '',
    landline: '',
    email: '',
    website: '',
    whatsappBusinessNumber: '',
  },
  businessRegistration: {
    gstNumber: '',
    panNumber: '',
  },
  restaurant: {
    name: '',
    gstNumber: '',
    fssaiNumber: '',
  },
};

// Phone fields store a "+91 <10 digits>" string but the +91 is shown as a fixed,
// non-editable prefix, so the input only deals with the 10 digits.
// For display, drop the leading "+91" the stored value carries (with any spacing)
// THEN keep digits — using slice(-10) here would fold that prefix's "91" into a
// short number as you type it.
const tenDigits = (v) => String(v || '').replace(/^\s*\+91[\s-]*/, '').replace(/\D/g, '').slice(0, 10);
const withPrefix = (digits) => (digits ? `+91 ${digits}` : '');

// Up-to-3-letter monogram from the hotel name, shown when no logo is uploaded.
const hotelInitials = (name) =>
  (name || 'Hotel').trim().split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join('').toUpperCase() || 'H';

const sectionPaper = {
  p: { xs: 2, md: 3 },
  borderRadius: 2,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundColor: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundImage: 'none',
  backdropFilter: 'var(--app-blur)',
  WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

const HotelProfileSection = ({ onNotify }) => {
  const { updateSettingsTemporary, reload: reloadSettings } = useSettings();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [emailOtp, setEmailOtp] = useState({ sent: false, code: '', sending: false, verifying: false, verified: false, error: '', dev: '' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/settings/hotel-profile');
        const payload = data?.data || data;
        if (active && payload) {
          setProfile({
            ...emptyProfile,
            ...payload,
            address: { ...emptyProfile.address, ...(payload.address || {}) },
            contact: { ...emptyProfile.contact, ...(payload.contact || {}) },
            businessRegistration: {
              ...emptyProfile.businessRegistration,
              ...(payload.businessRegistration || {}),
            },
            restaurant: {
              ...emptyProfile.restaurant,
              ...(payload.restaurant || {}),
            },
          });
          // Reflect a previously-saved email verification.
          setEmailOtp((p) => ({ ...p, verified: !!payload.contact?.emailVerified }));
        }
      } catch (err) {
        onNotify?.('Failed to load hotel profile', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onNotify]);

  const updateField = (path, value) => {
    setProfile((prev) => {
      const [a, b] = path.split('.');
      if (b) return { ...prev, [a]: { ...prev[a], [b]: value } };
      return { ...prev, [a]: value };
    });
  };

  const emailValid = /^\S+@\S+\.\S+$/.test((profile.contact.email || '').trim());

  // Reusable +91-prefixed phone field: fixed grey "+91", 10-digit input only.
  const phoneField = (label, path, stored) => (
    <TextField
      fullWidth
      label={label}
      value={tenDigits(stored)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        const digits = raw.length > 10 ? raw.slice(-10) : raw;
        updateField(path, withPrefix(digits));
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Box
                component="span"
                sx={{ color: 'text.disabled', fontWeight: 600, userSelect: 'none', pr: 0.75, mr: 0.25, borderRight: '1px solid', borderColor: 'divider' }}
              >
                +91
              </Box>
            </InputAdornment>
          ),
        },
        htmlInput: { inputMode: 'numeric', 'aria-label': label },
      }}
    />
  );

  const sendEmailOtp = async () => {
    if (!emailValid) { setEmailOtp((p) => ({ ...p, error: 'Enter a valid email first' })); return; }
    setEmailOtp((p) => ({ ...p, sending: true, error: '' }));
    try {
      const { data } = await api.post('/settings/hotel-profile/email-otp/send', { email: profile.contact.email.trim() });
      setEmailOtp((p) => ({ ...p, sending: false, sent: true, dev: data?.devCode || '' }));
    } catch (err) {
      setEmailOtp((p) => ({ ...p, sending: false, error: err.response?.data?.message || 'Could not send code' }));
    }
  };

  const verifyEmailOtp = async () => {
    setEmailOtp((p) => ({ ...p, verifying: true, error: '' }));
    try {
      await api.post('/settings/hotel-profile/email-otp/verify', { email: profile.contact.email.trim(), code: emailOtp.code });
      setEmailOtp((p) => ({ ...p, verifying: false, verified: true, error: '' }));
    } catch (err) {
      setEmailOtp((p) => ({ ...p, verifying: false, error: err.response?.data?.message || 'Incorrect code' }));
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onNotify?.('Logo file must be under 5 MB', 'error');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', 'logo');
      const { data } = await api.post('/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Only update the form preview — the logo is persisted (and reflected in
      // the sidebar) when the user clicks "Save changes".
      setProfile((prev) => ({ ...prev, logo: data.url }));
      onNotify?.('Logo ready — click "Save changes" to apply', 'info');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Logo upload failed', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings/hotel-profile', profile);
      const saved = data?.data || data?.hotelProfile || profile;
      updateSettingsTemporary('hotelProfile', { ...profile, ...saved });
      broadcastSettingsChange('hotelProfile', saved);
      reloadSettings?.();
      onNotify?.('Hotel profile saved', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 6
        }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={sectionPaper}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{
            alignItems: "center"
          }}>
            <Avatar
              src={profile.logo}
              alt="Hotel logo"
              variant="rounded"
              sx={{
                width: 96, height: 96, border: '1px solid', borderColor: 'divider',
                fontWeight: 800, fontSize: 26, letterSpacing: '0.5px', color: '#fff',
                bgcolor: profile.logo ? 'grey.100' : 'transparent',
                background: profile.logo ? undefined : 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.92), rgba(var(--app-primary-rgb),0.6))',
              }}
            >
              {!profile.logo && hotelInitials(profile.hotelName)}
            </Avatar>
            <Stack spacing={1} sx={{
              flex: 1
            }}>
              <Typography variant="subtitle1" sx={{
                fontWeight: 600
              }}>
                Hotel logo
              </Typography>
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                PNG, JPG, or SVG. Recommended: square, 512×512 or larger.
              </Typography>
              <Box>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={uploadingLogo ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                  <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
                </Button>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Business identity</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Hotel name" value={profile.hotelName} onChange={(e) => updateField('hotelName', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Legal name" value={profile.legalName} onChange={(e) => updateField('legalName', e.target.value)} />
            </Grid>
            <Grid size={12}>
              <RichTextField
                label="Description"
                placeholder="Describe your hotel — you can make text bold, coloured, sized, etc."
                value={profile.description}
                onChange={(html) => updateField('description', html)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Address</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Address line 1" value={profile.address.line1} onChange={(e) => updateField('address.line1', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Address line 2" value={profile.address.line2} onChange={(e) => updateField('address.line2', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Area / locality" value={profile.address.area} onChange={(e) => updateField('address.area', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 6,
                sm: 3
              }}>
              <TextField fullWidth label="City" value={profile.address.city} onChange={(e) => updateField('address.city', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 6,
                sm: 3
              }}>
              <TextField fullWidth label="State" value={profile.address.state} onChange={(e) => updateField('address.state', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 6,
                sm: 3
              }}>
              <TextField fullWidth label="Postal code" value={profile.address.postalCode} onChange={(e) => updateField('address.postalCode', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 6,
                sm: 3
              }}>
              <TextField fullWidth label="Country" value={profile.address.country} onChange={(e) => updateField('address.country', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Contact</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              {phoneField('Phone', 'contact.phone', profile.contact.phone)}
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              {phoneField('Alt phone', 'contact.altPhone', profile.contact.altPhone)}
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              {phoneField('Landline', 'contact.landline', profile.contact.landline)}
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField
                fullWidth label="Email" type="email"
                value={profile.contact.email}
                onChange={(e) => {
                  updateField('contact.email', e.target.value);
                  // Editing the email invalidates any prior verification.
                  setEmailOtp({ sent: false, code: '', sending: false, verifying: false, verified: false, error: '', dev: '' });
                }}
              />
              <Box sx={{ mt: 0.75, ml: 0.5, minHeight: 30 }}>
                {emailOtp.verified ? (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: '#16a34a', fontWeight: 700, fontSize: 13.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 20 }} /> Email verified
                  </Box>
                ) : !emailOtp.sent ? (
                  <Button size="small" onClick={sendEmailOtp} disabled={emailOtp.sending || !emailValid} sx={{ textTransform: 'none', fontWeight: 700, px: 0.5, minWidth: 0 }}>
                    {emailOtp.sending ? 'Sending…' : 'Verify email →'}
                  </Button>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                      size="small" placeholder="6-digit code" value={emailOtp.code}
                      onChange={(e) => setEmailOtp((p) => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' }))}
                      sx={{ width: 130 }}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6, 'aria-label': 'email verification code' } }}
                    />
                    <Button size="small" variant="contained" disableElevation onClick={verifyEmailOtp} disabled={emailOtp.code.length !== 6 || emailOtp.verifying} sx={{ textTransform: 'none' }}>
                      {emailOtp.verifying ? '…' : 'Verify'}
                    </Button>
                    <Button size="small" onClick={sendEmailOtp} disabled={emailOtp.sending} sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 0, px: 0.5 }}>Resend</Button>
                  </Stack>
                )}
                {emailOtp.error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{emailOtp.error}</Typography>}
                {emailOtp.dev && <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>Dev code: <b>{emailOtp.dev}</b></Typography>}
              </Box>
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Website" value={profile.contact.website} onChange={(e) => updateField('contact.website', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              {phoneField('WhatsApp business', 'contact.whatsappBusinessNumber', profile.contact.whatsappBusinessNumber)}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Business registration</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="GST number" value={profile.businessRegistration.gstNumber} onChange={(e) => updateField('businessRegistration.gstNumber', e.target.value.toUpperCase())} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="PAN number" value={profile.businessRegistration.panNumber} onChange={(e) => updateField('businessRegistration.panNumber', e.target.value.toUpperCase())} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Restaurant identity</Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            Used on the food bill page when the restaurant has its own GST registration.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Restaurant name" value={profile.restaurant.name} onChange={(e) => updateField('restaurant.name', e.target.value)} placeholder="e.g. Sandhya Kitchen" />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Restaurant GSTIN" value={profile.restaurant.gstNumber} onChange={(e) => updateField('restaurant.gstNumber', e.target.value.toUpperCase())} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField fullWidth label="Restaurant FSSAI" value={profile.restaurant.fssaiNumber} onChange={(e) => updateField('restaurant.fssaiNumber', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end"
        }}>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>
    </Stack>
  );
};

export default HotelProfileSection;
