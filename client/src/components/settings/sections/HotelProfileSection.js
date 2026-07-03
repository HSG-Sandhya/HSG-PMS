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
} from '@mui/material';
import { CloudUpload as UploadIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../../../api';
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
    email: '',
    website: '',
    whatsappBusinessNumber: '',
  },
  businessRegistration: {
    gstNumber: '',
    panNumber: '',
    fssaiNumber: '',
    cin: '',
  },
  restaurant: {
    name: '',
    gstNumber: '',
    fssaiNumber: '',
  },
};

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
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={sectionPaper}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
            <Avatar
              src={profile.logo}
              alt="Hotel logo"
              variant="rounded"
              sx={{ width: 96, height: 96, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }}
            />
            <Stack spacing={1} flex={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Hotel logo
              </Typography>
              <Typography variant="body2" color="text.secondary">
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
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Hotel name" value={profile.hotelName} onChange={(e) => updateField('hotelName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Legal name" value={profile.legalName} onChange={(e) => updateField('legalName', e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2} value={profile.description} onChange={(e) => updateField('description', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Address</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Address line 1" value={profile.address.line1} onChange={(e) => updateField('address.line1', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Address line 2" value={profile.address.line2} onChange={(e) => updateField('address.line2', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Area / locality" value={profile.address.area} onChange={(e) => updateField('address.area', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="City" value={profile.address.city} onChange={(e) => updateField('address.city', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="State" value={profile.address.state} onChange={(e) => updateField('address.state', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Postal code" value={profile.address.postalCode} onChange={(e) => updateField('address.postalCode', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3}>
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
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={profile.contact.phone} onChange={(e) => updateField('contact.phone', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Alt phone" value={profile.contact.altPhone} onChange={(e) => updateField('contact.altPhone', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" type="email" value={profile.contact.email} onChange={(e) => updateField('contact.email', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Website" value={profile.contact.website} onChange={(e) => updateField('contact.website', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="WhatsApp business" value={profile.contact.whatsappBusinessNumber} onChange={(e) => updateField('contact.whatsappBusinessNumber', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Business registration</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="GST number" value={profile.businessRegistration.gstNumber} onChange={(e) => updateField('businessRegistration.gstNumber', e.target.value.toUpperCase())} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="PAN number" value={profile.businessRegistration.panNumber} onChange={(e) => updateField('businessRegistration.panNumber', e.target.value.toUpperCase())} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="FSSAI number" value={profile.businessRegistration.fssaiNumber} onChange={(e) => updateField('businessRegistration.fssaiNumber', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="CIN" value={profile.businessRegistration.cin} onChange={(e) => updateField('businessRegistration.cin', e.target.value.toUpperCase())} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={sectionPaper}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Restaurant identity</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Used on the food bill page when the restaurant has its own GST registration.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Restaurant name" value={profile.restaurant.name} onChange={(e) => updateField('restaurant.name', e.target.value)} placeholder="e.g. Sandhya Kitchen" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Restaurant GSTIN" value={profile.restaurant.gstNumber} onChange={(e) => updateField('restaurant.gstNumber', e.target.value.toUpperCase())} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Restaurant FSSAI" value={profile.restaurant.fssaiNumber} onChange={(e) => updateField('restaurant.fssaiNumber', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box display="flex" justifyContent="flex-end">
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
