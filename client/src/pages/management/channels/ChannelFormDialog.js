import { useState, useEffect } from 'react';
import { Alert, Avatar, Box, Chip, Divider, FormControl, FormControlLabel, Grid, InputAdornment, InputLabel, MenuItem, Select, Switch, TextField, Typography } from '@mui/material';
import { Storefront as StorefrontIcon, Tune as TuneIcon, PaymentsOutlined as PaymentsOutlinedIcon, SettingsEthernet as SettingsEthernetIcon, RuleOutlined as RuleOutlinedIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../components/forms/FormDialog';
import { CHANNEL_TYPES, CHANNEL_STATUSES, CHANNEL_PRESETS, typeLabel, channelInitials, emptyForm } from './channelHelpers';
import { currencySym } from '../../../utils/billing';

const ChannelFormDialog = ({ open, channel, onClose, onSave }) => {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(channel ? { ...emptyForm(), ...channel, settings: { ...emptyForm().settings, ...channel.settings }, apiConfig: { ...emptyForm().apiConfig, ...channel.apiConfig }, syncSettings: { ...emptyForm().syncSettings, ...channel.syncSettings }, rateSettings: { ...emptyForm().rateSettings, ...channel.rateSettings }, bookingRules: { ...emptyForm().bookingRules, ...channel.bookingRules }, contact: { ...emptyForm().contact, ...channel.contact } } : emptyForm());
      setErrors({});
    }
  }, [open, channel]);

  const set = (path, value) =>
    setForm((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let ref = next;
      for (let i = 0; i < keys.length - 1; i++) {
        ref[keys[i]] = { ...ref[keys[i]] };
        ref = ref[keys[i]];
      }
      ref[keys[keys.length - 1]] = value;
      return next;
    });

  const applyPreset = (preset) => {
    set('name', preset.name);
    set('type', preset.type);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Channel name is required';
    if (form.apiConfig.isActive && !form.apiConfig.endpoint.trim()) e.endpoint = 'Endpoint required when API is active';
    if (form.contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact.email)) e.email = 'Invalid email';
    setErrors(e);
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      // Validation errors are shown inline on each field's section.
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        settings: {
          ...form.settings,
          commission: Number(form.settings.commission) || 0,
          markup: Number(form.settings.markup) || 0,
        },
        rateSettings: {
          ...form.rateSettings,
          baseRateMultiplier: Number(form.rateSettings.baseRateMultiplier) || 1,
          minRate: form.rateSettings.minRate === '' ? undefined : Number(form.rateSettings.minRate),
          maxRate: form.rateSettings.maxRate === '' ? undefined : Number(form.rateSettings.maxRate),
        },
      };
      await onSave(channel?._id, payload);
      onClose();
    } catch {
      /* parent surfaces the error toast */
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); handleSubmit(); }}
      maxWidth="md"
      icon={<StorefrontIcon />}
      eyebrow={`${form.name || 'Untitled channel'} · ${typeLabel(form.type)}`}
      title={channel ? 'Edit Channel' : 'Add New Channel'}
      submitDisabled={saving}
      submitLabel={saving ? 'Saving…' : channel ? 'Save Changes' : 'Create Channel'}
    >
      {/* ---- General ---- */}
      <FormSection title="General" icon={<TuneIcon fontSize="small" />} iconColor="#6366f1">
        <Box>
          {!channel && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Quick start — pick a channel
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {CHANNEL_PRESETS.map((p) => (
                  <Chip
                    key={p.name}
                    label={p.name}
                    onClick={() => applyPreset(p)}
                    variant={form.name === p.name ? 'filled' : 'outlined'}
                    avatar={<Avatar sx={{ bgcolor: p.color, color: '#fff !important', fontSize: 11 }}>{channelInitials(p.name)}</Avatar>}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
              <Divider sx={{ mt: 2.5 }} />
            </Box>
          )}
          <Grid container spacing={2.5}>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <TextField
                fullWidth
                required
                label="Channel Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
              />
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 3
              }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {CHANNEL_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 3
              }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {CHANNEL_STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 1 }}>
                Contact person
              </Typography>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <TextField fullWidth label="Contact Name" value={form.contact.name} onChange={(e) => set('contact.name', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <TextField
                fullWidth
                label="Email"
                value={form.contact.email}
                onChange={(e) => set('contact.email', e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <TextField fullWidth label="Phone" value={form.contact.phone} onChange={(e) => set('contact.phone', e.target.value)} />
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <TextField fullWidth label="Address" value={form.contact.address} onChange={(e) => set('contact.address', e.target.value)} />
            </Grid>
          </Grid>
        </Box>
      </FormSection>
      {/* ---- Commercials ---- */}
      <FormSection title="Commercials" icon={<PaymentsOutlinedIcon fontSize="small" />} iconColor="#10b981">
        <Grid container spacing={2.5}>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <TextField
              fullWidth
              type="number"
              label="Commission (%)"
              value={form.settings.commission}
              onChange={(e) => set('settings.commission', e.target.value)}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                htmlInput: { min: 0, max: 100, step: 0.1 }
              }} />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <TextField
              fullWidth
              type="number"
              label="Markup (%)"
              value={form.settings.markup}
              onChange={(e) => set('settings.markup', e.target.value)}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                htmlInput: { min: 0, step: 0.1 }
              }} />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select label="Currency" value={form.settings.currency} onChange={(e) => set('settings.currency', e.target.value)}>
                {['INR', 'USD', 'EUR', 'GBP', 'AED'].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={12}>
            <Divider />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 2 }}>
              Rate controls
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <TextField
              fullWidth
              type="number"
              label="Base Rate Multiplier"
              value={form.rateSettings.baseRateMultiplier}
              onChange={(e) => set('rateSettings.baseRateMultiplier', e.target.value)}
              helperText="× applied to base room rate"
              slotProps={{
                htmlInput: { min: 0.1, step: 0.05 }
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <TextField
              fullWidth
              type="number"
              label="Min Rate"
              value={form.rateSettings.minRate}
              onChange={(e) => set('rateSettings.minRate', e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
              }}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <TextField
              fullWidth
              type="number"
              label="Max Rate"
              value={form.rateSettings.maxRate}
              onChange={(e) => set('rateSettings.maxRate', e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
              }}
            />
          </Grid>
          <Grid size={12}>
            <FormControlLabel
              control={<Switch checked={form.rateSettings.dynamicPricing} onChange={(e) => set('rateSettings.dynamicPricing', e.target.checked)} />}
              label="Enable dynamic pricing"
            />
          </Grid>
          <Grid size={12}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Sell rate ≈ base × multiplier, plus markup, grossed up for commission. Use the Rate Calculator on any channel to preview exact figures.
            </Alert>
          </Grid>
        </Grid>
      </FormSection>
      {/* ---- Connection ---- */}
      <FormSection title="Connection" icon={<SettingsEthernetIcon fontSize="small" />} iconColor="#0ea5e9">
        <Grid container spacing={2.5}>
          <Grid size={12}>
            <FormControlLabel
              control={<Switch checked={form.apiConfig.isActive} onChange={(e) => set('apiConfig.isActive', e.target.checked)} />}
              label="API connection active"
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Turn on to enable live inventory & rate sync with this channel.
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              label="API Endpoint"
              value={form.apiConfig.endpoint}
              onChange={(e) => set('apiConfig.endpoint', e.target.value)}
              disabled={!form.apiConfig.isActive}
              error={!!errors.endpoint}
              helperText={errors.endpoint}
              placeholder="https://api.partner.com/v1"
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField fullWidth label="API Key" value={form.apiConfig.apiKey} onChange={(e) => set('apiConfig.apiKey', e.target.value)} disabled={!form.apiConfig.isActive} />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              type="password"
              label="Secret Key"
              value={form.apiConfig.secretKey}
              onChange={(e) => set('apiConfig.secretKey', e.target.value)}
              disabled={!form.apiConfig.isActive}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField fullWidth label="Username" value={form.apiConfig.username} onChange={(e) => set('apiConfig.username', e.target.value)} disabled={!form.apiConfig.isActive} />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={form.apiConfig.password}
              onChange={(e) => set('apiConfig.password', e.target.value)}
              disabled={!form.apiConfig.isActive}
            />
          </Grid>
        </Grid>
      </FormSection>
      {/* ---- Sync & Rules ---- */}
      <FormSection title="Sync & Rules" icon={<RuleOutlinedIcon fontSize="small" />} iconColor="#a21caf">
        <Grid container spacing={2.5}>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <FormControlLabel
              control={<Switch checked={form.syncSettings.autoSync} onChange={(e) => set('syncSettings.autoSync', e.target.checked)} />}
              label="Auto sync"
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              type="number"
              label="Sync Interval (minutes)"
              value={form.syncSettings.syncInterval}
              onChange={(e) => set('syncSettings.syncInterval', Number(e.target.value) || 30)}
              disabled={!form.syncSettings.autoSync}
              slotProps={{
                htmlInput: { min: 5, max: 1440 }
              }}
            />
          </Grid>
          <Grid size={12}>
            <Divider />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 2 }}>
              Booking rules
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              type="number"
              label="Min advance booking (days)"
              value={form.bookingRules.minAdvanceBooking}
              onChange={(e) => set('bookingRules.minAdvanceBooking', Number(e.target.value) || 0)}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <TextField
              fullWidth
              type="number"
              label="Max advance booking (days)"
              value={form.bookingRules.maxAdvanceBooking}
              onChange={(e) => set('bookingRules.maxAdvanceBooking', Number(e.target.value) || 0)}
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <FormControlLabel
              control={<Switch checked={form.bookingRules.allowSameDayBooking} onChange={(e) => set('bookingRules.allowSameDayBooking', e.target.checked)} />}
              label="Allow same-day booking"
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <FormControlLabel
              control={<Switch checked={form.bookingRules.allowOverbooking} onChange={(e) => set('bookingRules.allowOverbooking', e.target.checked)} />}
              label="Allow overbooking"
            />
          </Grid>
        </Grid>
      </FormSection>
    </FormDialog>
  );
};

export default ChannelFormDialog;
