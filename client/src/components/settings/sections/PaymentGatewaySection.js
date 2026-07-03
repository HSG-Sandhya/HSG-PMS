import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
  Bolt as BoltIcon,
  Science as ScienceIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import api from '../../../api';

const sectionPaper = {
  p: { xs: 2, md: 3 },
  borderRadius: 2,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundColor: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundImage: 'none',
  backdropFilter: 'var(--app-blur)',
  WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
  boxShadow:
    '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

const empty = {
  enabled: false,
  environment: 'test',
  keyId: '',
  keySecret: '',
  webhookSecret: '',
};

const isPlaceholder = (s) =>
  !s || /YOUR_KEY|YOUR_SECRET|rzp_test_demo_key/i.test(String(s).trim());

const PaymentGatewaySection = ({ onNotify }) => {
  const [form, setForm] = useState(empty);
  const [original, setOriginal] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/settings/section/payment');
        const payload = data?.data || data;
        const razor = payload?.razorpay || {};
        const next = {
          enabled: !!razor.enabled,
          environment: razor.environment || 'test',
          keyId: razor.keyId || '',
          keySecret: razor.keySecret || '',
          webhookSecret: razor.webhookSecret || '',
        };
        if (active) {
          setForm(next);
          setOriginal(next);
        }
      } catch (err) {
        onNotify?.(err.response?.data?.message || 'Failed to load payment settings', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onNotify]);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Send the whole razorpay object so partial updates don't drop fields.
      await api.put('/settings/section/payment', { razorpay: form });
      setOriginal(form);
      onNotify?.('Payment gateway settings saved · Razorpay re-initialised', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (label, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    onNotify?.(`${label} copied to clipboard`, 'info');
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);
  const isLive = form.environment === 'live' && !isPlaceholder(form.keyId) && !isPlaceholder(form.keySecret) && form.enabled;
  const isDemoFlow = !form.enabled || isPlaceholder(form.keyId) || isPlaceholder(form.keySecret);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Status banner */}
      <Card sx={sectionPaper}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 52, height: 52, borderRadius: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLive
                    ? 'linear-gradient(135deg, #10B981, #34D399)'
                    : 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #EC4899))',
                  color: '#fff',
                  boxShadow: '0 8px 24px -8px rgba(var(--app-primary-rgb, 99,102,241), 0.45)',
                }}
              >
                {isLive ? <BoltIcon /> : <ScienceIcon />}
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: 'var(--app-primary)' }}>
                  Razorpay
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isLive
                    ? 'Live mode — real payments are being processed.'
                    : isDemoFlow
                      ? 'Demo mode — payments are mocked. Add live keys to activate.'
                      : 'Test mode — payments use Razorpay test environment.'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                size="small"
                label={isLive ? 'Live' : isDemoFlow ? 'Demo' : 'Test'}
                sx={{
                  fontWeight: 700, letterSpacing: '0.08em',
                  color: '#fff',
                  background: isLive
                    ? 'linear-gradient(135deg, #10B981, #34D399)'
                    : isDemoFlow
                      ? 'linear-gradient(135deg, #94A3B8, #64748B)'
                      : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enabled}
                    onChange={(e) => update('enabled', e.target.checked)}
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>Gateway enabled</Typography>}
              />
            </Stack>
          </Stack>

          {isDemoFlow && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              The website's Booking page will show a <strong>"Demo mode — no real charges"</strong> badge
              until live keys are saved here and the gateway is enabled.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Credentials card */}
      <Card sx={sectionPaper}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 4, height: 22, borderRadius: 2, background: 'var(--app-primary)' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              API credentials
            </Typography>
          </Stack>

          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                fullWidth
                label="Environment"
                value={form.environment}
                onChange={(e) => update('environment', e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Key ID"
                placeholder="rzp_test_xxxxxxxxxxxxxx  or  rzp_live_xxxxxxxxxxxxxx"
                value={form.keyId}
                onChange={(e) => update('keyId', e.target.value.trim())}
                helperText="From Razorpay dashboard → Settings → API Keys"
                InputProps={{
                  endAdornment: form.keyId ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => handleCopy('Key ID', form.keyId)}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Key Secret"
                type={showSecret ? 'text' : 'password'}
                value={form.keySecret}
                onChange={(e) => update('keySecret', e.target.value.trim())}
                helperText="Razorpay shows this once when you generate the key — store it carefully."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowSecret((v) => !v)}>
                        {showSecret ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Webhook Secret (optional)"
                type={showWebhook ? 'text' : 'password'}
                value={form.webhookSecret}
                onChange={(e) => update('webhookSecret', e.target.value.trim())}
                helperText="Only required if you create a Razorpay webhook for payment status notifications."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowWebhook((v) => !v)}>
                        {showWebhook ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                component="a"
                href="https://dashboard.razorpay.com/app/keys"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Open Razorpay dashboard
              </Button>
              {isDirty && (
                <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, letterSpacing: '0.08em' }}>
                  Unsaved changes
                </Typography>
              )}
            </Stack>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !isDirty}
              sx={{
                px: 3, py: 1, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary, #EC4899) 100%)',
                boxShadow: '0 8px 24px -8px rgba(var(--app-primary-rgb, 99,102,241), 0.55)',
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Help card */}
      <Card sx={sectionPaper}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 4, height: 22, borderRadius: 2, background: 'var(--app-primary)' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              How to get your keys
            </Typography>
          </Stack>
          <Stack spacing={1.5} sx={{ color: 'text.secondary' }}>
            <Typography variant="body2">
              <strong>1.</strong> Sign in to{' '}
              <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--app-primary)', textDecoration: 'underline' }}>
                dashboard.razorpay.com
              </a>{' '}
              and complete KYC.
            </Typography>
            <Typography variant="body2">
              <strong>2.</strong> Switch the dashboard to <em>Live mode</em> (top-left) once you're approved.
            </Typography>
            <Typography variant="body2">
              <strong>3.</strong> Go to <em>Settings → API Keys → Generate Live Key</em>. Razorpay shows
              the Key ID and Key Secret <strong>only once</strong> — copy both.
            </Typography>
            <Typography variant="body2">
              <strong>4.</strong> Paste them above, set Environment to <em>Live</em>, toggle
              <em> Gateway enabled</em> on, and click Save. The website's "Demo mode" badge
              disappears automatically.
            </Typography>
            <Typography variant="body2">
              <strong>5.</strong> Make a small live test booking with your own card / UPI to confirm.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default PaymentGatewaySection;
