import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, TextField, Switch, FormControlLabel, Button, InputAdornment,
  IconButton, Divider, CircularProgress, Radio, Autocomplete, Chip,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import LanguageIcon from '@mui/icons-material/Language';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useSettings } from '../../../contexts/SettingsContext';
import api from '../../../api';
import { FormSection } from '../../forms/FormDialog';

const cardSx = {
  p: { xs: 2, md: 2.5 }, borderRadius: 3,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backdropFilter: 'var(--app-blur)', WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

const DEFAULTS = {
  enabled: true, wifiSsid: '', wifiPassword: '', wifiNetworks: [], websiteBaseUrl: '', countryCode: '91', messageTemplate: '',
};

const emptyNetwork = () => ({ ssid: '', password: '', rooms: '', isDefault: false });

// Split a stored "rooms" string into picker chip values, tolerant of the older
// free-text formats ("Room R-308 Room R-309", commas, ranges).
const parseRooms = (str) =>
  String(str || '')
    .split(/[,\n]+/)
    .flatMap((s) => s.split(/\s+/))
    .map((s) => s.trim().replace(/^room\s*/i, ''))
    .filter((s) => s && s.toLowerCase() !== 'room');

const GuestWelcomeSection = ({ onNotify }) => {
  const { settings, reload: reloadSettings } = useSettings();
  const [form, setForm] = useState(DEFAULTS);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomOptions, setRoomOptions] = useState([]);

  // Load the actual room numbers so coverage is chosen from real rooms instead
  // of typed free-hand (which silently broke room→network matching).
  useEffect(() => {
    let active = true;
    api.rooms
      .getAll()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const nums = list
          .map((r) => r.roomNumber)
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
        if (active) setRoomOptions(nums);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const gm = settings?.guestMessaging || {};
    let nets = Array.isArray(gm.wifiNetworks) ? gm.wifiNetworks : [];
    // Seed from the legacy single network so existing config isn't lost.
    if (!nets.length && (gm.wifiSsid || gm.wifiPassword)) {
      nets = [{ ssid: gm.wifiSsid || '', password: gm.wifiPassword || '', rooms: '', isDefault: true }];
    }
    setForm({
      ...DEFAULTS,
      ...gm,
      wifiNetworks: nets.map((n) => ({ ssid: n.ssid || '', password: n.password || '', rooms: n.rooms || '', isDefault: !!n.isDefault })),
    });
  }, [settings?.guestMessaging]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setNet = (i, patch) => setForm((f) => ({ ...f, wifiNetworks: f.wifiNetworks.map((n, idx) => (idx === i ? { ...n, ...patch } : n)) }));
  const addNet = () => setForm((f) => ({ ...f, wifiNetworks: [...(f.wifiNetworks || []), { ...emptyNetwork(), isDefault: (f.wifiNetworks || []).length === 0 }] }));
  const removeNet = (i) => setForm((f) => ({ ...f, wifiNetworks: f.wifiNetworks.filter((_, idx) => idx !== i) }));
  const setDefaultNet = (i) => setForm((f) => ({ ...f, wifiNetworks: f.wifiNetworks.map((n, idx) => ({ ...n, isDefault: idx === i })) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.updateSection('guestMessaging', form);
      await reloadSettings?.();
      onNotify?.('Guest welcome settings saved', 'success');
    } catch (e) {
      onNotify?.(e.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sampleNet = (form.wifiNetworks || []).find((n) => n.isDefault) || (form.wifiNetworks || [])[0] || {};
  const samplePreview = `Namaste Guest! 🙏 Welcome to ${settings?.hotelProfile?.hotelName || 'our hotel'}.\n\n📶 WiFi: ${sampleNet.ssid || '—'} / ${sampleNet.password || '—'}\n🍽️ Menu: ${(form.websiteBaseUrl || 'https://your-site').replace(/\/+$/, '')}/room-service/101`;

  return (
    <Stack spacing={2.5}>
      <Box sx={cardSx}>
        <FormControlLabel
          control={<Switch checked={!!form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />}
          label={
            <Box>
              <Typography sx={{
                fontWeight: 700
              }}>Send WiFi & menu on check-in</Typography>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                When a guest is checked in, pop up a one-tap WhatsApp message with the WiFi password and a food-menu QR/link.
              </Typography>
            </Box>
          }
        />
      </Box>
      <FormSection title="WiFi networks" icon={<WifiIcon fontSize="small" />} iconColor="#0ea5e9">
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center"
            }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                maxWidth: 520
              }}>
              Add each access point and the rooms it covers. On check-in, the guest is sent the network nearest their room (strongest signal). If no network matches, the default is used.
            </Typography>
            <IconButton size="small" onClick={() => setShowPwd((v) => !v)} title={showPwd ? 'Hide passwords' : 'Show passwords'}>
              {showPwd ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Stack>

          {(form.wifiNetworks || []).length === 0 && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>No networks yet — add one below.</Typography>
          )}

          {(form.wifiNetworks || []).map((n, i) => (
            <Box key={i} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: n.isDefault ? 'var(--app-primary)' : 'divider' }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField label="Network (SSID)" value={n.ssid} onChange={(e) => setNet(i, { ssid: e.target.value })} fullWidth />
                  <TextField
                    label="Password" type={showPwd ? 'text' : 'password'} value={n.password}
                    onChange={(e) => setNet(i, { password: e.target.value })} fullWidth
                  />
                </Stack>
                <Autocomplete
                  multiple
                  freeSolo
                  options={roomOptions}
                  value={parseRooms(n.rooms)}
                  onChange={(_e, val) => setNet(i, { rooms: val.join(', ') })}
                  renderValue={(value, getItemProps) =>
                    value.map((option, index) => (
                      <Chip size="small" label={option} {...getItemProps({ index })} key={option + index} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Rooms covered"
                      placeholder="Choose rooms…"
                      helperText="Pick the rooms this access point covers (you can also type a range like 101-110)"
                    />
                  )}
                />
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}>
                  <FormControlLabel
                    control={<Radio size="small" checked={!!n.isDefault} onChange={() => setDefaultNet(i)} />}
                    label={<Typography variant="body2">Default (used when no room matches)</Typography>}
                  />
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => removeNet(i)}
                    sx={{ textTransform: 'none' }}>
                    Remove
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}

          <Button startIcon={<AddIcon />} onClick={addNet} variant="outlined"
            sx={{ alignSelf: 'flex-start', borderRadius: '999px', textTransform: 'none', fontWeight: 700 }}>
            Add network
          </Button>
        </Stack>
      </FormSection>
      <FormSection title="Menu link & WhatsApp" icon={<LanguageIcon fontSize="small" />} iconColor="#10b981">
        <Stack spacing={2}>
          <TextField
            label="Website address" value={form.websiteBaseUrl} onChange={(e) => set({ websiteBaseUrl: e.target.value })}
            placeholder="https://sandhyagrand.in" fullWidth
            helperText="Used to build the room-service link: <website>/room-service/<room number>"
          />
          <TextField
            label="WhatsApp country code" value={form.countryCode}
            onChange={(e) => set({ countryCode: e.target.value.replace(/\D/g, '') })}
            sx={{ maxWidth: 220 }}
            helperText="Default 91 (India)"
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">+</InputAdornment> }
            }}
          />
        </Stack>
      </FormSection>
      <FormSection title="Message (optional)" icon={<WhatsAppIcon fontSize="small" />} iconColor="#25D366">
        <Stack spacing={1.5}>
          <TextField
            label="Custom message template" value={form.messageTemplate} onChange={(e) => set({ messageTemplate: e.target.value })}
            multiline minRows={4} fullWidth
            placeholder="Leave blank to use the built-in message."
            helperText="Placeholders: {guestName} {hotelName} {roomNumber} {wifiSsid} {wifiPassword} {menuUrl}"
          />
          <Box sx={{ ...cardSx, p: 2 }}>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>Preview</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>{samplePreview}</Typography>
          </Box>
        </Stack>
      </FormSection>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{
            borderRadius: '999px', px: 3, fontWeight: 700,
            background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-secondary, #8B5CF6) 100%)',
            '&:hover': { background: 'linear-gradient(135deg, var(--app-primary), var(--app-secondary, #8B5CF6))' },
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Stack>
  );
};

export default GuestWelcomeSection;
