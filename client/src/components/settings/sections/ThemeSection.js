import { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Switch,
  Slider,
  MenuItem,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  CloudUpload as UploadIcon,
  Close as DeleteIcon,
  ColorLens as ColorIcon,
  Palette as PaletteIcon,
  Wallpaper as WallpaperIcon,
  AutoAwesome as GlassIcon,
  TextFields as TypographyIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Visibility as PreviewIcon,
  Check as CheckIcon,
  FlashlightOn as TorchIcon,
  Animation as MotionIcon,
  TouchApp as ManualIcon,
  Brightness6 as AutoIcon,
  WbSunny as SunriseIcon,
  Bedtime as SunsetIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { useSettings } from '../../../contexts/SettingsContext';
import { broadcastSettingsChange } from '../settingsEvents';
import AnimatedModeToggle from '../AnimatedModeToggle';
import { getSunTimes, isNight, formatClock } from '../../../utils/daylight';

const DEFAULT_THEME = {
  darkMode: false,
  autoTheme: false,
  primaryColor: '#6366F1',
  secondaryColor: '#EC4899',
  accentColor: '#F59E42',
  darkTextColor: '#f3f4f6',
  borderRadius: 8,
  fontFamily: 'Nunito',
  surfaceOpacity: 0.05,
  blurStrength: 8,
  backgroundStyle: 'none',
  backgroundImage: '',
  solidColor: '#f8fafc',
  solidColorOpacity: 1,
  nightTorch: true,
  reduceMotion: false,
  darknessLevel: 60,
};

// Darkness comes in 20% steps; each step is a phase of the night. Mirrors the
// sky phases inside AnimatedModeToggle.
const DARKNESS_PHASES = {
  0: 'Sunset',
  20: 'Twilight',
  40: 'Evening',
  60: 'Night',
  80: 'Deep night',
  100: 'Midnight',
};

const BACKGROUND_STYLES = [
  { value: 'none',     label: 'Plain (flat colour)' },
  { value: 'image',    label: 'Photo' },
  { value: 'gradient', label: 'Primary → Secondary gradient' },
  { value: 'solid',    label: 'Solid colour' },
];

// Mix of locally-hosted photos and pure-CSS "scenes". The scene IDs are
// resolved to gradient strings by AppThemeProvider — no network, instant paint.
const IMAGE_PRESETS = [
  { url: '/images/background.jpg', label: 'House (default)', thumb: "url('/images/background.jpg') center/cover" },
  { url: '/images/Room101.jpg',    label: 'Room 101',        thumb: "url('/images/Room101.jpg') center/cover" },
  { url: 'scene:aurora',           label: 'Aurora',          thumb: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' },
  { url: 'scene:sunset',           label: 'Sunset',          thumb: 'linear-gradient(135deg, #f5a623 0%, #f5576c 60%, #c471f5 100%)' },
  { url: 'scene:ocean',            label: 'Ocean',           thumb: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { url: 'scene:forest',           label: 'Forest',          thumb: 'linear-gradient(135deg, #0f3443 0%, #34e89e 100%)' },
  { url: 'scene:midnight',         label: 'Midnight',        thumb: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { url: 'scene:peach',            label: 'Peach',           thumb: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { url: 'scene:lavender',         label: 'Lavender',        thumb: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { url: 'scene:nordic',           label: 'Nordic',          thumb: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { url: 'scene:rose',             label: 'Rose mist',       thumb: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)' },
  { url: 'scene:emerald',          label: 'Emerald',         thumb: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { url: 'scene:velvet',           label: 'Velvet',          thumb: 'linear-gradient(135deg, #cb356b 0%, #bd3f32 100%)' },
  { url: 'scene:monochrome',       label: 'Monochrome',      thumb: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
];

const SOLID_SWATCHES = [
  '#F8FAFC', '#FEF3C7', '#FCE7F3', '#DBEAFE', '#DCFCE7', '#EDE9FE',
  '#FFFFFF', '#0F172A', '#1F2937', '#FECACA', '#A7F3D0', '#FDE68A',
];

const FONT_OPTIONS = [
  'Nunito',
  'Inter',
  'Roboto',
  'Poppins',
  'Quicksand',
  'Rubik',
  'Lato',
  'Montserrat',
  'Open Sans',
];

const PRESETS = [
  { name: 'Indigo (default)', primaryColor: '#6366F1', secondaryColor: '#EC4899', accentColor: '#F59E42' },
  { name: 'Emerald',          primaryColor: '#10B981', secondaryColor: '#0EA5E9', accentColor: '#F59E0B' },
  { name: 'Rose',             primaryColor: '#F43F5E', secondaryColor: '#8B5CF6', accentColor: '#EAB308' },
  { name: 'Slate',            primaryColor: '#475569', secondaryColor: '#0F766E', accentColor: '#C2410C' },
  { name: 'Sunset',           primaryColor: '#F97316', secondaryColor: '#EC4899', accentColor: '#FACC15' },
  { name: 'Ocean',            primaryColor: '#0EA5E9', secondaryColor: '#14B8A6', accentColor: '#A855F7' },
  { name: 'Forest',           primaryColor: '#16A34A', secondaryColor: '#65A30D', accentColor: '#D97706' },
  { name: 'Lavender',         primaryColor: '#A855F7', secondaryColor: '#EC4899', accentColor: '#F59E0B' },
  { name: 'Midnight',         primaryColor: '#312E81', secondaryColor: '#0E7490', accentColor: '#F472B6' },
  { name: 'Coral',            primaryColor: '#FB7185', secondaryColor: '#FB923C', accentColor: '#06B6D4' },
];

const sectionPaper = (isDarkMode) => ({
  borderRadius: 3,
  p: { xs: 2.5, md: 3.5 },
  background: isDarkMode ? 'rgba(30,41,59,0.55)' : 'rgba(255,255,255,0.55)',
  border: '1px solid',
  borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.7)',
  backdropFilter: 'var(--app-blur)',
  WebkitBackdropFilter: 'var(--app-blur)',
  boxShadow: isDarkMode
    ? '0 8px 32px -16px rgba(0,0,0,0.5)'
    : '0 6px 26px -14px rgba(15,23,42,0.12)',
});

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <Stack direction="row" alignItems="center" spacing={1.75} mb={2.75}>
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb), 0.18), rgba(var(--app-primary-rgb), 0.08))',
        color: 'var(--app-primary)',
        border: '1px solid rgba(var(--app-primary-rgb), 0.18)',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
    </Box>
    <Box>
      <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  </Stack>
);

const ValueChip = ({ children }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 1.25,
      py: 0.25,
      borderRadius: 999,
      background: 'rgba(var(--app-primary-rgb), 0.14)',
      color: 'var(--app-primary)',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'monospace',
      letterSpacing: '-0.01em',
    }}
  >
    {children}
  </Box>
);

// A richer slider — gradient rail, a glowing draggable thumb with a halo on
// hover/focus, a floating value bubble, and tidy tick labels.
const glassSliderSx = {
  width: '100%',
  mx: 0,
  height: 8,
  py: 1.5,
  '& .MuiSlider-rail': {
    opacity: 1,
    height: 8,
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.25), rgba(148,163,184,0.4))',
  },
  '& .MuiSlider-track': {
    height: 8,
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(90deg, var(--app-primary), var(--app-secondary, #EC4899))',
  },
  '& .MuiSlider-thumb': {
    width: 22,
    height: 22,
    background: 'radial-gradient(circle at 35% 30%, #ffffff, #eef2ff 60%, var(--app-primary))',
    border: '2px solid #fff',
    boxShadow: '0 4px 12px -2px rgba(var(--app-primary-rgb), 0.6)',
    transition: 'box-shadow 0.2s ease, transform 0.15s ease',
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 8px rgba(var(--app-primary-rgb), 0.18), 0 6px 16px -2px rgba(var(--app-primary-rgb), 0.6)',
    },
    '&.Mui-active': { transform: 'scale(1.15)' },
  },
  '& .MuiSlider-valueLabel': {
    background: 'var(--app-primary)',
    borderRadius: 2,
    fontWeight: 700,
    fontSize: 11,
    '&::before': { display: 'none' },
  },
  '& .MuiSlider-mark': {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: 'rgba(148,163,184,0.6)',
    '&.MuiSlider-markActive': { backgroundColor: '#fff' },
  },
  '& .MuiSlider-markLabel': {
    fontSize: 11,
    fontWeight: 600,
    color: 'text.secondary',
  },
};

const SliderRow = ({ label, valueLabel, hint, sx, ...sliderProps }) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1.25}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
        {label}
      </Typography>
      <ValueChip>{valueLabel}</ValueChip>
    </Stack>
    <Slider
      valueLabelDisplay="auto"
      {...sliderProps}
      sx={{ ...glassSliderSx, ...(sx || {}) }}
    />
    {hint && (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
        {hint}
      </Typography>
    )}
  </Box>
);

const ColorRow = ({ label, value, onChange, hint }) => (
  <Box>
    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'text.secondary' }}>
      {label}
    </Typography>
    <Stack direction="row" spacing={1.5} alignItems="center" mt={0.75}>
      <Box
        component="input"
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          width: 44,
          height: 44,
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: 1.5,
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
        }}
      />
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
      />
      {hint && (
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      )}
    </Stack>
  </Box>
);

// A labelled switch row with an icon and helper text — used for the on/off
// ambience options.
const ToggleRow = ({ icon: Icon, label, hint, checked, onChange, disabled }) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    sx={{ py: 1, opacity: disabled ? 0.5 : 1, transition: 'opacity .2s ease' }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      {Icon && (
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2,
            display: 'grid', placeItems: 'center',
            background: 'rgba(var(--app-primary-rgb), 0.12)',
            color: 'var(--app-primary)',
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
      )}
      <Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: 'text.primary' }}>{label}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
    </Stack>
    <Switch
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  </Stack>
);

const ThemeSection = ({ onNotify }) => {
  const muiTheme = useTheme();
  const isDarkMode = muiTheme.palette.mode === 'dark';
  const { settings, updateSettingsTemporary, reload: reloadSettings } = useSettings();

  const [themeData, setThemeData] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [userBackgrounds, setUserBackgrounds] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const refreshUserBackgrounds = async () => {
    try {
      const { data } = await api.images.list('background');
      setUserBackgrounds(Array.isArray(data) ? data : []);
    } catch {
      // non-fatal — the preset grid still works
    }
  };

  useEffect(() => {
    refreshUserBackgrounds();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.settings.getSection('theme');
        const payload = data?.data || data || {};
        if (active) {
          setThemeData({ ...DEFAULT_THEME, ...payload });
        }
      } catch (err) {
        // Fall back to whatever the context already has.
        if (active && settings?.theme) {
          setThemeData({ ...DEFAULT_THEME, ...settings.theme });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // settings is intentionally not in deps — we only want the initial seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (field, value) => setThemeData((prev) => ({ ...prev, [field]: value }));

  // Darkness level snapped to the 20% steps the toggle uses.
  const darknessValue = (() => {
    const n = Number(themeData.darknessLevel);
    if (!Number.isFinite(n)) return 60;
    return Math.min(100, Math.max(0, Math.round(n / 20) * 20));
  })();

  // Mode strategy + the live day/night state used to render the Mode section.
  const autoMode = Boolean(themeData.autoTheme);
  const currentlyDark = autoMode ? isNight() : Boolean(themeData.darkMode);
  const sunToday = getSunTimes(new Date());

  const applyPreset = (preset) => {
    setThemeData((prev) => ({
      ...prev,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
    }));
  };

  const handleReset = () => {
    setThemeData(DEFAULT_THEME);
  };

  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.type)) {
      onNotify?.('Please pick a JPG, PNG, WebP or GIF image', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onNotify?.('Background image must be under 8 MB', 'error');
      return;
    }

    setUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', 'background');
      const { data } = await api.post('/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // The server returns { url: '/api/images/<id>' }. Persists in MongoDB so
      // it works across machines without any local file dependency.
      if (data?.url) {
        setThemeData((prev) => ({
          ...prev,
          backgroundStyle: 'image',
          backgroundImage: data.url,
        }));
        // Surface the new upload in the picker grid immediately.
        await refreshUserBackgrounds();
        onNotify?.('Background uploaded — click "Save & apply" to use it', 'info');
      } else {
        throw new Error('No URL returned by server');
      }
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleDeleteBackground = async (id, url) => {
    if (!window.confirm('Delete this uploaded background permanently?')) return;
    setDeletingId(id);
    try {
      await api.images.delete(id);
      // If it was the currently chosen background, clear the field so the
      // user picks another one before saving.
      if (themeData.backgroundImage === url) {
        setThemeData((prev) => ({ ...prev, backgroundImage: '' }));
      }
      await refreshUserBackgrounds();
      onNotify?.('Background deleted', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Dragging the toggle knob through the night zone previews the darkness
  // level live (throttled inside the toggle). Only while already in dark mode
  // — switching modes mid-drag would rebuild the whole MUI theme per tick.
  const handleToggleScrub = (level) => {
    if (!themeData.darkMode) return;
    const nextTheme = { ...themeData, darknessLevel: level };
    setThemeData(nextTheme);
    updateSettingsTemporary('theme', nextTheme);
  };

  // Click-step or knob release: the mode + darkness level apply across the app
  // instantly via the shared settings context, then persist quietly in one
  // write. We deliberately do NOT broadcast/reload here: SettingsContext
  // refetches on broadcast, and a refetch racing the server write flashes the
  // previous mode for a frame.
  const handleToggleCommit = async ({ dark, level }) => {
    const nextTheme = {
      ...themeData,
      darkMode: dark,
      ...(level == null ? {} : { darknessLevel: level }),
    };
    setThemeData(nextTheme);
    updateSettingsTemporary('theme', nextTheme);
    try {
      await api.settings.updateSection('theme', nextTheme);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to update mode', 'error');
    }
  };

  // Switch between manual and automatic (sunset → sunrise) mode. Persists
  // immediately so it applies live, like the day/night toggle. When turning
  // automatic on, we set the correct mode for right now straight away.
  const handleModeStrategyChange = async (auto) => {
    const next = { ...themeData, autoTheme: auto };
    if (auto) next.darkMode = isNight();
    setThemeData(next);
    updateSettingsTemporary('theme', next);
    try {
      await api.settings.updateSection('theme', next);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to update mode', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In automatic mode the live darkMode is owned by the sunset/sunrise
      // controller — don't overwrite it with this section's (possibly stale) copy.
      const payload = { ...themeData };
      if (payload.autoTheme) payload.darkMode = Boolean(settings?.theme?.darkMode);
      await api.settings.updateSection('theme', payload);
      updateSettingsTemporary('theme', payload);
      broadcastSettingsChange('theme', payload);
      reloadSettings?.();
      onNotify?.('Appearance updated — applied across the app', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to save theme', 'error');
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
    <Stack spacing={2.5}>
      {/* Mode */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={currentlyDark ? DarkModeIcon : LightModeIcon}
          title="Mode"
          subtitle="Set light/dark yourself, or follow sunrise & sunset automatically"
        />

        {/* Manual vs Automatic strategy */}
        <ToggleButtonGroup
          exclusive
          value={autoMode ? 'auto' : 'manual'}
          onChange={(_, v) => { if (v) handleModeStrategyChange(v === 'auto'); }}
          sx={{
            mb: 2.5,
            '& .MuiToggleButton-root': {
              flex: 1,
              gap: 1,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)',
              '&.Mui-selected': {
                background: 'rgba(var(--app-primary-rgb), 0.16)',
                color: 'var(--app-primary)',
                borderColor: 'var(--app-primary)',
                '&:hover': { background: 'rgba(var(--app-primary-rgb), 0.22)' },
              },
            },
          }}
          fullWidth
        >
          <ToggleButton value="manual"><ManualIcon sx={{ fontSize: 18 }} /> Manual</ToggleButton>
          <ToggleButton value="auto"><AutoIcon sx={{ fontSize: 18 }} /> Automatic</ToggleButton>
        </ToggleButtonGroup>

        {autoMode ? (
          <Box
            sx={{
              p: 2.25,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.9)',
              background: isDarkMode ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,252,0.8)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25} mb={1.5}>
              <Box
                sx={{
                  width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: currentlyDark ? 'rgba(30,41,59,0.9)' : 'rgba(var(--app-primary-rgb),0.14)',
                  color: currentlyDark ? '#fbbf24' : 'var(--app-primary)',
                }}
              >
                {currentlyDark ? <SunsetIcon sx={{ fontSize: 18 }} /> : <SunriseIcon sx={{ fontSize: 18 }} />}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                  {currentlyDark ? 'Currently dark — night' : 'Currently light — day'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Follows the system clock: dark from sunset to sunrise.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5, background: isDarkMode ? 'rgba(30,41,59,0.5)' : '#fff', border: '1px solid', borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : 'rgba(226,232,240,0.8)' }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <SunriseIcon sx={{ fontSize: 15, color: '#f59e0b' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>SUNRISE</Typography>
                </Stack>
                <Typography sx={{ fontSize: 16, fontWeight: 700, mt: 0.25 }}>{formatClock(sunToday.sunrise)}</Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5, background: isDarkMode ? 'rgba(30,41,59,0.5)' : '#fff', border: '1px solid', borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : 'rgba(226,232,240,0.8)' }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <SunsetIcon sx={{ fontSize: 15, color: '#6366f1' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>SUNSET</Typography>
                </Stack>
                <Typography sx={{ fontSize: 16, fontWeight: 700, mt: 0.25 }}>{formatClock(sunToday.sunset)}</Typography>
              </Box>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            <AnimatedModeToggle
              value={themeData.darkMode}
              darkness={darknessValue}
              onScrub={handleToggleScrub}
              onCommit={handleToggleCommit}
            />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                {themeData.darkMode
                  ? `${DARKNESS_PHASES[darknessValue] || 'Night'} — ${darknessValue}% darkness`
                  : 'Light mode — Day'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {themeData.darkMode
                  ? 'Each click steps 20% deeper into the night (midnight wraps back to day) — the torch follows'
                  : 'Click to step into dusk, or drag the knob toward night'}
              </Typography>
            </Box>
          </Stack>
        )}

        {currentlyDark && (
          <Box
            sx={{
              mt: 3,
              pt: 2.5,
              borderTop: '1px solid',
              borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.8)',
            }}
          >
            <ColorRow
              label="Dark mode text colour"
              value={themeData.darkTextColor || '#f3f4f6'}
              onChange={(v) => setField('darkTextColor', v)}
              hint="Applied to all app text while dark mode is on"
            />
          </Box>
        )}
      </Box>

      {/* Presets */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={PaletteIcon}
          title="Colour presets"
          subtitle="Curated palettes — one click applies primary, secondary and accent together"
        />
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          }}
        >
          {PRESETS.map((preset) => {
            const selected =
              themeData.primaryColor?.toLowerCase() === preset.primaryColor.toLowerCase() &&
              themeData.secondaryColor?.toLowerCase() === preset.secondaryColor.toLowerCase();
            return (
              <Box
                key={preset.name}
                component="button"
                type="button"
                onClick={() => applyPreset(preset)}
                sx={{
                  position: 'relative',
                  p: 1.25,
                  border: '1.5px solid',
                  borderColor: selected ? preset.primaryColor : 'rgba(148,163,184,0.22)',
                  borderRadius: 2,
                  background: isDarkMode ? 'rgba(15,23,42,0.35)' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all .2s ease',
                  boxShadow: selected ? `0 8px 20px -8px ${preset.primaryColor}66` : 'none',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: preset.primaryColor,
                  },
                }}
              >
                {selected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: preset.primaryColor,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 12 }} />
                  </Box>
                )}
                <Box
                  sx={{
                    height: 38,
                    borderRadius: 1.25,
                    background: `linear-gradient(135deg, ${preset.primaryColor} 0%, ${preset.secondaryColor} 60%, ${preset.accentColor} 100%)`,
                    mb: 1,
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>
                  {preset.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Brand colours */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={ColorIcon}
          title="Brand colours"
          subtitle="Pick custom values or fine-tune any preset above"
        />
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          }}
        >
          {[
            { key: 'primaryColor',   label: 'Primary',   hint: 'Buttons · highlights · headings' },
            { key: 'secondaryColor', label: 'Secondary', hint: 'Tags · badges · subtle accents' },
            { key: 'accentColor',    label: 'Accent',    hint: 'Links · small highlights' },
          ].map(({ key, label, hint }) => (
            <Box
              key={key}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.7)',
                background: isDarkMode ? 'rgba(15,23,42,0.35)' : 'rgba(248,250,252,0.7)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1.25}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1.5,
                    background: themeData[key],
                    border: '1px solid rgba(148,163,184,0.35)',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'text.secondary' }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', mt: 0.25 }}>
                    {(themeData[key] || '').toUpperCase()}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  component="input"
                  type="color"
                  value={themeData[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  sx={{
                    width: 36,
                    height: 36,
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: 1.25,
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
                <TextField
                  size="small"
                  value={themeData[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.25, fontFamily: 'monospace', fontSize: 13 } }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {hint}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Glass effect — transparency + blur */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={GlassIcon}
          title="Glass effect"
          subtitle="Two sliders control every glass card, table and dialog at once"
        />
        <Stack spacing={4.5}>
          <SliderRow
            label="Transparency"
            valueLabel={`${((Number(themeData.surfaceOpacity) || 0.05) * 100).toFixed(0)}% fill`}
            value={Number(themeData.surfaceOpacity) || 0.05}
            onChange={(_, v) => setField('surfaceOpacity', v)}
            min={0.02}
            max={0.30}
            step={0.01}
            marks={[
              { value: 0.02, label: 'Clear' },
              { value: 0.10, label: '10%' },
              { value: 0.20, label: '20%' },
              { value: 0.30, label: 'Solid' },
            ]}
            hint="How visible every glass card / table / dialog appears."
          />

          <SliderRow
            label="Blur strength"
            valueLabel={`${Number(themeData.blurStrength) || 8}px`}
            value={Number(themeData.blurStrength) || 8}
            onChange={(_, v) => setField('blurStrength', v)}
            min={0}
            max={24}
            step={1}
            marks={[
              { value: 0, label: 'Off' },
              { value: 8, label: 'Soft' },
              { value: 16, label: 'Strong' },
              { value: 24, label: 'Max' },
            ]}
            hint="Controls the frosted-glass blur behind every panel."
          />
        </Stack>
      </Box>

      {/* Motion & ambience — night torch + reduce motion */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={MotionIcon}
          title="Motion & ambience"
          subtitle="Decorative animations and the dark-mode torch light"
        />
        <Stack spacing={1}>
          <ToggleRow
            icon={TorchIcon}
            label="Night torch"
            hint="In dark mode, a warm light follows your cursor like a flashlight."
            checked={themeData.nightTorch !== false}
            disabled={Boolean(themeData.reduceMotion)}
            onChange={(v) => setField('nightTorch', v)}
          />
          <ToggleRow
            icon={MotionIcon}
            label="Reduce motion"
            hint="Turns off decorative animations, including the night torch."
            checked={Boolean(themeData.reduceMotion)}
            onChange={(v) => setField('reduceMotion', v)}
          />
        </Stack>
      </Box>

      {/* Background — style + image picker */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={WallpaperIcon}
          title="Page background"
          subtitle="Pick a photo, gradient, scene or a solid colour for the whole app"
        />
        <Stack spacing={3}>
          <TextField
            select
            label="Style"
            value={themeData.backgroundStyle || 'none'}
            onChange={(e) => setField('backgroundStyle', e.target.value)}
            sx={{ maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            SelectProps={{ MenuProps: { PaperProps: { sx: { backgroundColor: isDarkMode ? '#1e293b' : '#fff' } } } }}
          >
            {BACKGROUND_STYLES.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          {themeData.backgroundStyle === 'solid' && (
            <>
              <Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'text.secondary', mb: 1.25, display: 'block' }}>
                  Pick a colour
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Box
                    component="input"
                    type="color"
                    value={themeData.solidColor || '#f8fafc'}
                    onChange={(e) => setField('solidColor', e.target.value)}
                    sx={{
                      width: 48,
                      height: 48,
                      border: '1px solid rgba(148,163,184,0.35)',
                      borderRadius: 1.5,
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                  <TextField
                    size="small"
                    value={themeData.solidColor || '#f8fafc'}
                    onChange={(e) => setField('solidColor', e.target.value)}
                    sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
                  />
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {SOLID_SWATCHES.map((c) => {
                      const selected = (themeData.solidColor || '').toLowerCase() === c.toLowerCase();
                      return (
                        <Box
                          key={c}
                          component="button"
                          type="button"
                          onClick={() => setField('solidColor', c)}
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: selected ? 'var(--app-primary)' : 'rgba(148,163,184,0.35)',
                            background: c,
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'transform .15s ease',
                            '&:hover': { transform: 'scale(1.1)' },
                          }}
                          title={c}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </Box>

              <SliderRow
                label="Fade level"
                valueLabel={`${Math.round(((Number(themeData.solidColorOpacity) ?? 1)) * 100)}%`}
                value={Number(themeData.solidColorOpacity) ?? 1}
                onChange={(_, v) => setField('solidColorOpacity', v)}
                min={0}
                max={1}
                step={0.05}
                marks={[
                  { value: 0,    label: 'Off' },
                  { value: 0.25, label: 'Faded' },
                  { value: 0.5,  label: '50%' },
                  { value: 1,    label: 'Full' },
                ]}
                hint="Lower the fade for a tinted look; raise it for an opaque background."
              />
            </>
          )}

          {themeData.backgroundStyle === 'image' && (
            <>
              <Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'text.secondary', mb: 1.25, display: 'block' }}>
                  Choose a background
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                  }}
                >
                  {IMAGE_PRESETS.map((img) => {
                    const selected = (themeData.backgroundImage || '') === img.url;
                    return (
                      <Box
                        key={img.url}
                        component="button"
                        type="button"
                        onClick={() => setField('backgroundImage', img.url)}
                        sx={{
                          position: 'relative',
                          aspectRatio: '4 / 3',
                          border: '2px solid',
                          borderColor: selected ? 'var(--app-primary)' : 'rgba(148,163,184,0.25)',
                          borderRadius: 2,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          padding: 0,
                          background: img.thumb || `url('${img.url}') center/cover no-repeat`,
                          transition: 'all .2s ease',
                          boxShadow: selected ? '0 6px 18px -8px rgba(var(--app-primary-rgb), 0.55)' : 'none',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: 'var(--app-primary)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            insetInline: 0,
                            bottom: 0,
                            px: 1.25,
                            py: 0.75,
                            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'left',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {img.label}
                        </Box>
                      </Box>
                    );
                  })}

                  {/* User-uploaded backgrounds — clickable + deletable */}
                  {userBackgrounds.map((img) => {
                    const selected = (themeData.backgroundImage || '') === img.url;
                    const isDeleting = deletingId === img.id;
                    return (
                      <Box
                        key={img.id}
                        sx={{
                          position: 'relative',
                          aspectRatio: '4 / 3',
                          border: '2px solid',
                          borderColor: selected ? 'var(--app-primary)' : 'rgba(148,163,184,0.25)',
                          borderRadius: 2,
                          overflow: 'hidden',
                          background: `url('${img.url}') center/cover no-repeat`,
                          transition: 'all .2s ease',
                          boxShadow: selected ? '0 6px 18px -8px rgba(var(--app-primary-rgb), 0.55)' : 'none',
                          opacity: isDeleting ? 0.5 : 1,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: 'var(--app-primary)',
                          },
                          '&:hover .bg-delete-btn': { opacity: 1 },
                        }}
                      >
                        <Box
                          component="button"
                          type="button"
                          onClick={() => setField('backgroundImage', img.url)}
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          aria-label={`Use ${img.filename || 'uploaded background'}`}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            px: 0.85,
                            py: 0.25,
                            background: 'rgba(99,102,241,0.95)',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            borderRadius: 0.75,
                          }}
                        >
                          Uploaded
                        </Box>
                        <Box
                          component="button"
                          type="button"
                          className="bg-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBackground(img.id, img.url);
                          }}
                          disabled={isDeleting}
                          aria-label="Delete uploaded background"
                          sx={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 24,
                            height: 24,
                            border: 'none',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: { xs: 1, md: 0 },
                            transition: 'opacity .15s ease, background .15s ease',
                            '&:hover': { background: '#dc2626' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            insetInline: 0,
                            bottom: 0,
                            px: 1.25,
                            py: 0.75,
                            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'left',
                            letterSpacing: '0.04em',
                            pointerEvents: 'none',
                          }}
                        >
                          {img.filename || 'Custom upload'}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                {userBackgrounds.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block' }}>
                    Your uploaded backgrounds appear here — hover any to delete.
                  </Typography>
                )}
              </Box>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={uploadingBg ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={uploadingBg}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: 'var(--app-primary)',
                    color: 'var(--app-primary)',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      borderColor: 'var(--app-primary)',
                      backgroundColor: 'rgba(var(--app-primary-rgb), 0.08)',
                    },
                  }}
                >
                  {uploadingBg ? 'Uploading…' : 'Upload your own'}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleBackgroundUpload}
                  />
                </Button>
                <TextField
                  fullWidth
                  label="Or paste an image URL"
                  value={themeData.backgroundImage || ''}
                  onChange={(e) => setField('backgroundImage', e.target.value)}
                  placeholder="https://…  or  /api/images/abc123"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Uploads are stored on the server (in the cloud database) and load
                instantly on any machine — JPG / PNG / WebP / GIF, up to 8 MB.
              </Typography>
            </>
          )}
        </Stack>
      </Box>

      {/* Shape + typography */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={TypographyIcon}
          title="Shape & typography"
          subtitle="Tune corner sharpness and the global font"
        />
        <Stack spacing={4.5}>
          <SliderRow
            label="Corner radius"
            valueLabel={`${themeData.borderRadius}px`}
            value={Number(themeData.borderRadius) || 8}
            onChange={(_, v) => setField('borderRadius', v)}
            min={0}
            max={24}
            step={1}
            marks={[
              { value: 0, label: 'Square' },
              { value: 8, label: '8' },
              { value: 16, label: '16' },
              { value: 24, label: 'Round' },
            ]}
            hint="Applies to every button, card and input across the app."
          />
          <TextField
            select
            label="Font family"
            value={themeData.fontFamily || 'Nunito'}
            onChange={(e) => setField('fontFamily', e.target.value)}
            sx={{ maxWidth: 320, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            SelectProps={{ MenuProps: { PaperProps: { sx: { backgroundColor: isDarkMode ? '#1e293b' : '#fff' } } } }}
          >
            {FONT_OPTIONS.map((font) => (
              <MenuItem key={font} value={font} sx={{ fontFamily: `"${font}", sans-serif` }}>
                {font}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Box>

      {/* Live preview */}
      <Box sx={sectionPaper(isDarkMode)}>
        <SectionHeader
          icon={PreviewIcon}
          title="Live preview"
          subtitle="A miniature snapshot of how your theme will render across the app"
        />
        <Box
          sx={{
            borderRadius: `${themeData.borderRadius}px`,
            p: 3,
            backgroundColor: currentlyDark ? '#1e293b' : '#fff',
            color: currentlyDark ? (themeData.darkTextColor || '#f3f4f6') : '#1e293b',
            border: '1px solid rgba(148,163,184,0.2)',
            fontFamily: `"${themeData.fontFamily}", sans-serif`,
            transition: 'all .2s ease',
          }}
        >
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, mb: 1.5 }}>
            Hotel Sandhya Grand
          </Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: 14, mb: 2, opacity: 0.8 }}>
            Sample content rendered with the chosen font, mode and radius.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Box
              component="button"
              type="button"
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: `${themeData.borderRadius}px`,
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontWeight: 600,
                background: themeData.primaryColor,
                fontFamily: 'inherit',
              }}
            >
              Primary action
            </Box>
            <Box
              component="button"
              type="button"
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: `${themeData.borderRadius}px`,
                border: `1px solid ${themeData.secondaryColor}`,
                cursor: 'pointer',
                color: themeData.secondaryColor,
                fontWeight: 600,
                background: 'transparent',
                fontFamily: 'inherit',
              }}
            >
              Secondary
            </Box>
            <Box
              component="a"
              href="#preview"
              onClick={(e) => e.preventDefault()}
              sx={{
                alignSelf: 'center',
                color: themeData.accentColor,
                fontWeight: 600,
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Accent link
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Sticky action bar — always visible while scrolling the section */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 12,
          mt: 1.5,
          p: 1.5,
          borderRadius: 3,
          background: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'var(--app-blur-strong)',
          WebkitBackdropFilter: 'var(--app-blur-strong)',
          border: '1px solid',
          borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(226,232,240,0.8)',
          boxShadow: '0 12px 32px -16px rgba(15,23,42,0.35)',
          zIndex: 5,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', pl: { sm: 1 } }}>
            Changes preview live above — click Save & apply to push them to every screen.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ResetIcon />}
              onClick={handleReset}
              sx={{ borderRadius: 999, textTransform: 'none', px: 2.5 }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                px: 3,
                background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-primary) 100%)',
                boxShadow: '0 8px 22px -10px rgba(var(--app-primary-rgb), 0.7)',
                '&:hover': {
                  background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-primary) 100%)',
                  filter: 'brightness(1.08)',
                },
              }}
            >
              {saving ? 'Saving…' : 'Save & apply'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};

export default ThemeSection;
