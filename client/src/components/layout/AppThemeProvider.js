import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useSettings } from '../../contexts/SettingsContext';
import CssBaseline from '@mui/material/CssBaseline';
import NightTorch from './NightTorch';
import { nightProgress } from '../../utils/daylight';

// Curated CSS-only scene backgrounds. Pure gradients = zero load time,
// no network round-trip, and they scale to any viewport.
// NOTE: no `background-attachment: fixed` here — the page background is
// painted on a viewport-fixed `body::before` underlay instead (see the
// CssBaseline overrides below). Fixed-attachment backgrounds force Chrome to
// repaint the whole viewport on every animation frame, which made the screen
// flicker whenever the sidebar opened/collapsed over backdrop-filter glass.
const SCENES = {
  aurora:   'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  sunset:   'linear-gradient(135deg, #f5a623 0%, #f5576c 60%, #c471f5 100%)',
  ocean:    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  forest:   'linear-gradient(135deg, #0f3443 0%, #34e89e 100%)',
  midnight: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  peach:    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  lavender: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  nordic:   'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  rose:     'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
  emerald:  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  velvet:   'linear-gradient(135deg, #cb356b 0%, #bd3f32 100%)',
  monochrome:'linear-gradient(135deg, #232526 0%, #414345 100%)',
};

// Blend two hex colours: t=0 → a, t=1 → b. Used to scale how deep the dark
// palette goes from the "Darkness level" slider.
const mixHex = (a, b, t) => {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ch = (i) => {
    const va = parseInt(pa.slice(i, i + 2), 16);
    const vb = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return '99, 102, 241';
  const h = hex.replace('#', '').trim();
  const expanded = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (expanded.length !== 6) return '99, 102, 241';
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '99, 102, 241';
  return `${r}, ${g}, ${b}`;
};

const AppThemeProvider = ({ children }) => {
  const settingsContext = useSettings();
  const isDarkMode = settingsContext?.settings?.theme?.darkMode;
  // Decorative ambience — a mouse-follow torch in dark mode. Defaults on, and is
  // suppressed when the user has asked to reduce motion.
  const nightTorchEnabled = settingsContext?.settings?.theme?.nightTorch !== false;
  const reduceMotion = Boolean(settingsContext?.settings?.theme?.reduceMotion);
  const torchActive = Boolean(isDarkMode) && nightTorchEnabled && !reduceMotion;
  // Darkness level (0–100): how deep the dark palette goes. Soft charcoal at
  // 0, near-black at 100. The night torch scales with it — a softer dark mode
  // gets a gentler torch, a deeper one a stronger torch.
  const rawDarkness = Number(settingsContext?.settings?.theme?.darknessLevel);
  const savedDarkness = Number.isFinite(rawDarkness)
    ? Math.min(100, Math.max(0, rawDarkness)) / 100
    : 0.6;
  // In Automatic mode the darkness DEEPENS across the night instead of sitting
  // at one level: 20% just after sunset ramping to 100% by sunrise (mirrors the
  // manual slider range). Manual mode and daytime use the saved slider value.
  // The saved darknessLevel is never mutated — this is a render-only override.
  const autoTheme = Boolean(settingsContext?.settings?.theme?.autoTheme);
  const [autoDarkTick, setAutoDarkTick] = React.useState(0);
  React.useEffect(() => {
    if (!autoTheme) return undefined;
    // Re-evaluate the ramp every 3 min so the darkness eases through the night.
    const id = setInterval(() => setAutoDarkTick((t) => t + 1), 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoTheme]);
  const darkness = React.useMemo(() => {
    if (autoTheme && isDarkMode) {
      const p = nightProgress();
      if (p != null) return Math.min(1, Math.max(0.2, 0.2 + 0.8 * p));
    }
    return savedDarkness;
    // autoDarkTick advances the ramp over time; nightProgress() reads the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTheme, isDarkMode, savedDarkness, autoDarkTick]);
  const darkBase = mixHex('#2a2e37', '#08090c', darkness);
  const primaryColor = settingsContext?.settings?.theme?.primaryColor || '#6366F1';
  const secondaryColor = settingsContext?.settings?.theme?.secondaryColor || '#EC4899';
  const accentColor = settingsContext?.settings?.theme?.accentColor || '#F59E42';

  // App text colours — the SINGLE SOURCE OF TRUTH for both the MUI palette and
  // the `--app-text-*` CSS variables (set in the effect below), so the global
  // dark-mode text override in index.css follows the theme instead of hardcoding
  // a literal. `darkTextColor` is user-selectable in Appearance → Mode and only
  // applies in dark mode — light mode keeps the standard slate so a light custom
  // value can't blank out the text there.
  const darkTextColor = settingsContext?.settings?.theme?.darkTextColor || '#f3f4f6';
  const textPrimary = isDarkMode ? darkTextColor : '#1e293b';
  const textSecondary = isDarkMode ? '#bdbdbd' : '#64748b';

  // Always call the hook
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Surface tokens — glass-card opacity, blur strength, and the page background.
  // Centralising them here lets one slider in Appearance restyle every panel.
  const surfaceOpacity = Number(settingsContext?.settings?.theme?.surfaceOpacity);
  const safeSurfaceOpacity = Number.isFinite(surfaceOpacity) && surfaceOpacity >= 0 && surfaceOpacity <= 1
    ? surfaceOpacity
    : 0.05;
  const blurStrength = Number(settingsContext?.settings?.theme?.blurStrength);
  const safeBlur = Number.isFinite(blurStrength) && blurStrength >= 0 && blurStrength <= 40
    ? blurStrength
    : 8;
  const backgroundStyle = settingsContext?.settings?.theme?.backgroundStyle || 'none';
  const backgroundImage = settingsContext?.settings?.theme?.backgroundImage || '';
  const solidColor = settingsContext?.settings?.theme?.solidColor || (isDarkMode ? '#0f172a' : '#f8fafc');
  const solidOpacity = (() => {
    const o = Number(settingsContext?.settings?.theme?.solidColorOpacity);
    return Number.isFinite(o) && o >= 0 && o <= 1 ? o : 1;
  })();

  const hexToRgbaWith = (hex, alpha) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb}, ${alpha})`;
  };

  const computeBackground = () => {
    if (backgroundStyle === 'solid') {
      // Layer chosen colour at chosen opacity over a neutral base so reducing
      // the fade reveals a soft mode-appropriate underlay.
      const baseUnder = isDarkMode ? darkBase : '#f8f9fa';
      return `linear-gradient(${hexToRgbaWith(solidColor, solidOpacity)}, ${hexToRgbaWith(solidColor, solidOpacity)}), ${baseUnder}`;
    }
    if (backgroundStyle === 'gradient') {
      return `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    }
    if (backgroundStyle === 'image' && backgroundImage) {
      // Scene IDs resolve to a pre-built CSS gradient — no image load needed.
      if (backgroundImage.startsWith('scene:')) {
        const id = backgroundImage.slice(6);
        return SCENES[id] || (isDarkMode ? darkBase : '#f8f9fa');
      }
      return `url('${backgroundImage}') center center / cover no-repeat`;
    }
    // 'none' or 'image' with no URL chosen → flat neutral page
    return isDarkMode ? darkBase : '#f8f9fa';
  };

  // Expose the chosen palette and surface tokens as CSS variables so any
  // component can react — including the many surfaces that historically
  // hardcoded `#6366F1` and `rgba(255,255,255,0.05)`.
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-primary', primaryColor);
    root.style.setProperty('--app-primary-rgb', hexToRgb(primaryColor));
    root.style.setProperty('--app-secondary', secondaryColor);
    root.style.setProperty('--app-secondary-rgb', hexToRgb(secondaryColor));
    root.style.setProperty('--app-accent', accentColor);
    root.style.setProperty('--app-accent-rgb', hexToRgb(accentColor));
    // Text colours consumed by the global dark-mode text override in index.css.
    root.style.setProperty('--app-text-primary', textPrimary);
    root.style.setProperty('--app-text-secondary', textSecondary);
    root.style.setProperty('--app-surface-alpha', String(safeSurfaceOpacity));
    // Border slightly stronger than fill so panels stay legible at low opacity.
    root.style.setProperty('--app-surface-border-alpha', String(Math.min(1, safeSurfaceOpacity * 1.6)));
    // CLEAR "mirror glass" intensity. We deliberately keep the blur LOW (so you
    // can see through the glass instead of frosting it) but push saturation HIGH
    // so the colour behind the panel reflects vividly — that's what reads as a
    // polished mirror rather than milky frost.
    const clearBlur = Math.min(10, Math.max(2, Math.round(safeBlur * 0.55)));
    const saturate = 130 + Math.min(120, safeBlur * 9); // vivid reflection, capped
    root.style.setProperty('--app-blur', `blur(${clearBlur}px) saturate(${saturate}%)`);
    // "strong" surfaces (stat cards, sidebar) used to be the milkiest — keep them
    // only slightly heavier than base so they stay clear and see-through.
    const strongBlur = Math.min(14, Math.max(3, Math.round(safeBlur * 0.9)));
    const strongSaturate = 140 + Math.min(140, strongBlur * 8);
    root.style.setProperty('--app-blur-strong', `blur(${strongBlur}px) saturate(${strongSaturate}%)`);

    // ─── Liquid-Glass tokens: the SINGLE SOURCE OF TRUTH for the app's glass look ───
    // Every card, table, tab, dialog, menu and the sidebar reference these
    // variables instead of hardcoding rgba()s. Adjust the look here, once.
    // Clear translucent fill (see-through). Overlays use a heavier fill so text
    // stays legible over arbitrary content behind them.
    root.style.setProperty('--app-glass-fill', isDarkMode ? 'rgba(22, 26, 34, 0.22)' : 'rgba(255, 255, 255, 0.14)');
    root.style.setProperty('--app-glass-fill-strong', isDarkMode ? 'rgba(20, 24, 32, 0.55)' : 'rgba(255, 255, 255, 0.52)');
    // Crisp lit edge — both the full shorthand and the bare colour.
    root.style.setProperty('--app-glass-border-color', isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)');
    root.style.setProperty('--app-glass-border', `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)'}`);
    // Specular top-edge highlight colour (used in inset box-shadows).
    root.style.setProperty('--app-glass-highlight', isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)');
    // Full layered depth shadow + inner ring + top highlight.
    root.style.setProperty('--app-glass-shadow', isDarkMode
      ? 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(255,255,255,0.05), 0 12px 40px -16px rgba(0,0,0,0.65)'
      : 'inset 0 1px 0 rgba(255,255,255,1), inset 0 0 0 1px rgba(255,255,255,0.35), 0 12px 40px -16px rgba(15,23,42,0.22)');
    // Crystal glow — a soft prismatic pool of coloured light that spills from
    // the BOTTOM edge of every card. Two tinted layers (primary + secondary)
    // give it a crystalline, refracted feel; it follows the chosen palette via
    // the --app-*-rgb variables and is a touch brighter in dark mode.
    root.style.setProperty('--app-card-glow', isDarkMode
      ? '0 18px 34px -14px rgba(var(--app-primary-rgb), 0.6), 0 30px 60px -26px rgba(var(--app-secondary-rgb), 0.5)'
      : '0 16px 30px -14px rgba(var(--app-primary-rgb), 0.45), 0 28px 52px -26px rgba(var(--app-secondary-rgb), 0.35)');
    // Diagonal mirror sheen, layered over the fill via backgroundImage.
    root.style.setProperty('--app-glass-sheen', isDarkMode
      ? 'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 24%, rgba(255,255,255,0) 46%, rgba(255,255,255,0.03) 100%)'
      : 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.14) 24%, rgba(255,255,255,0) 46%, rgba(255,255,255,0.10) 100%)');
    root.style.setProperty('--app-bg', computeBackground());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryColor, secondaryColor, accentColor, textPrimary, textSecondary, safeSurfaceOpacity, safeBlur, backgroundStyle, backgroundImage, solidColor, solidOpacity, isDarkMode, darkness]);

  // Handle case when settings context is not yet available
  if (!settingsContext) {
    // Return a default light theme while settings are loading
    const defaultTheme = createTheme({
      palette: {
        mode: 'light',
        primary: {
          main: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#EC4899',
          light: '#F472B6',
          dark: '#DB2777',
          contrastText: '#ffffff',
        },
        background: {
          default: '#f8f9fa',
          paper: '#ffffff',
        },
        text: {
          primary: '#1e293b',
          secondary: '#64748b',
        },
      },
      shape: {
        borderRadius: 8,
      },
    });
    
    return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
  }

  const { settings } = settingsContext;

  // Helper function to format font family
  const formatFontFamily = (fontName) => {
    if (!fontName || fontName === 'Nunito') {
      return '"Nunito", "Quicksand", "Rubik", Arial, sans-serif';
    }
    // If it's already a formatted string, return as is
    if (fontName.includes(',')) {
      return fontName;
    }
    // Format single font name with fallbacks
    return `"${fontName}", "Nunito", Arial, sans-serif`;
  };

  // Liquid-Glass surface tokens for the MUI theme. These simply POINT at the
  // `--app-glass-*` CSS variables defined once in the effect above (the single
  // source of truth). The per-mode literal fallbacks only cover the very first
  // paint before the effect runs; after that the variables drive everything.
  const glassFill = `var(--app-glass-fill, ${isDarkMode ? 'rgba(22,26,34,0.22)' : 'rgba(255,255,255,0.14)'})`;
  const glassFillStrong = `var(--app-glass-fill-strong, ${isDarkMode ? 'rgba(20,24,32,0.55)' : 'rgba(255,255,255,0.52)'})`;
  const glassBlur = `var(--app-blur, blur(5px) saturate(180%))`;
  const glassBlurStrong = `var(--app-blur-strong, blur(9px) saturate(185%))`;
  const glassSheen = 'var(--app-glass-sheen)';
  const glassBorder = `var(--app-glass-border, 1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)'})`;
  const glassShadow = `var(--app-glass-shadow, ${isDarkMode
    ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 40px -16px rgba(0,0,0,0.65)'
    : 'inset 0 1px 0 rgba(255,255,255,1), 0 12px 40px -16px rgba(15,23,42,0.22)'})`;

  // Create theme based on current mode and settings
  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: settings?.theme?.primaryColor || '#6366F1',
        light: '#818CF8',
        dark: '#4F46E5',
        contrastText: '#ffffff',
      },
      secondary: {
        main: settings?.theme?.secondaryColor || '#EC4899',
        light: '#F472B6',
        dark: '#DB2777',
        contrastText: '#ffffff',
      },
      error: {
        main: '#EF4444',
        light: '#F87171',
        dark: '#DC2626',
        contrastText: '#ffffff',
      },
      warning: {
        main: '#F59E0B',
        light: '#FBBF24',
        dark: '#D97706',
        contrastText: '#ffffff',
      },
      info: {
        main: '#3B82F6',
        light: '#60A5FA',
        dark: '#2563EB',
        contrastText: '#ffffff',
      },
      success: {
        main: '#10B981',
        light: '#34D399',
        dark: '#059669',
        contrastText: '#ffffff',
      },
      background: {
        // Transparent so MUI's CssBaseline doesn't paint over the chosen
        // page background (image / gradient / solid). The real page bg
        // is set via `var(--app-bg)` on html/body/#root below.
        default: 'transparent',
        paper: isDarkMode ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        disabled: isDarkMode ? 'rgba(255, 255, 255, 0.38)' : 'rgba(0, 0, 0, 0.38)',
      },
      divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    },
    shape: {
      borderRadius: settings?.theme?.borderRadius || 8,
    },
    typography: {
      fontFamily: formatFontFamily(settings?.theme?.fontFamily),
      fontSize: 14, // Fixed font size to prevent changes during saves
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            fontFamily: formatFontFamily(settings?.theme?.fontFamily),
            fontSize: '14px', // Fixed font size to prevent changes during saves
            // Flat fallback only — the real page background lives on the
            // body::before underlay so nothing uses background-attachment:fixed
            // (which forces full-viewport repaints during animations → flicker).
            background: isDarkMode ? darkBase : '#f8f9fa',
            color: isDarkMode ? '#f3f4f6' : '#23272f',
            minHeight: '100vh',
            transition: 'background 0.3s, color 0.3s',
          },
          body: {
            fontFamily: formatFontFamily(settings?.theme?.fontFamily),
            fontSize: '14px', // Fixed font size to prevent changes during saves
            background: 'transparent',
            color: isDarkMode ? '#f3f4f6' : '#23272f',
            minHeight: '100vh',
            transition: 'color 0.3s',
          },
          // Viewport-fixed underlay carrying the chosen page background. It
          // never scrolls or moves, so the browser can keep it on its own
          // compositor layer instead of repainting it under every
          // backdrop-filter surface each animation frame.
          'body::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            background: 'var(--app-bg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'translateZ(0)',
            transition: 'background 0.3s',
            pointerEvents: 'none',
          },
          '#root': {
            fontFamily: formatFontFamily(settings?.theme?.fontFamily),
            fontSize: '14px', // Fixed font size to prevent changes during saves
            background: 'transparent',
            color: isDarkMode ? '#f3f4f6' : '#23272f',
            minHeight: '100vh',
            transition: 'color 0.3s',
          },
          a: {
            color: settings?.theme?.accentColor || '#F59E42',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: glassFill,
            backgroundImage: glassSheen,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            border: glassBorder,
            // Depth shadow + the crystal glow spilling from the bottom edge.
            boxShadow: `${glassShadow}, var(--app-card-glow)`,
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: glassFill,
            backgroundImage: glassSheen,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            boxShadow: glassShadow,
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          },
          // Flat variant opts out of the glass (e.g. inline table containers).
          outlined: {
            boxShadow: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          // Forms/dialogs are fully opaque (no see-through) so they read like a
          // solid surface over the page — the rest of the app keeps its glass.
          paper: {
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            backgroundImage: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: isDarkMode ? '1px solid rgba(148,163,184,0.22)' : '1px solid rgba(226,232,240,0.9)',
            boxShadow: glassShadow,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: glassFill,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            borderBottom: glassBorder,
            boxShadow: isDarkMode
              ? 'inset 0 -1px 0 rgba(255,255,255,0.06), 0 8px 24px -16px rgba(0,0,0,0.7)'
              : 'inset 0 -1px 0 rgba(255,255,255,0.4), 0 8px 24px -16px rgba(15,23,42,0.25)',
            color: isDarkMode ? '#f3f4f6' : '#1e293b',
          },
        },
      },
      // Tabs become a Liquid-Glass pill bar: the container is clear glass and
      // the selection "indicator" is repurposed into a full-height glass pill
      // that slides behind the active tab (instead of an underline).
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 46,
            padding: 5,
            borderRadius: 16,
            backgroundColor: glassFill,
            backgroundImage: glassSheen,
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            border: glassBorder,
            boxShadow: glassShadow,
          },
          indicator: {
            height: '100%',
            borderRadius: 11,
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            border: glassBorder,
            boxShadow: isDarkMode
              ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 6px 18px -8px rgba(0,0,0,0.55)'
              : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px -8px rgba(15,23,42,0.2)',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            zIndex: 1, // ride above the glass pill indicator
            minHeight: 36,
            borderRadius: 11,
            textTransform: 'none',
            fontWeight: 600,
            transition: 'color 0.2s ease',
          },
        },
      },
      // Overlay surfaces (dropdowns, popovers, the sidebar) use the stronger,
      // more opaque glass so text stays readable over whatever's behind them
      // while still picking up the frosted Liquid-Glass blur and edge highlight.
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            border: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            border: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            border: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
      // ── Date / time pickers (MUI X) ──────────────────────────────────────
      // One global theme so every <DatePicker> popup is a modern glass card
      // with smooth, rounded day cells that follow the chosen primary colour.
      MuiPickersPopper: {
        styleOverrides: {
          paper: {
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            border: glassBorder,
            boxShadow: glassShadow,
            borderRadius: 18,
            marginTop: 6,
            overflow: 'hidden',
          },
        },
      },
      MuiPickersDay: {
        styleOverrides: {
          root: {
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 12,
            transition: 'background-color .18s ease, color .18s ease, transform .12s ease, box-shadow .18s ease',
            '&:hover': {
              backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.14)',
              transform: 'translateY(-1px)',
            },
            '&.Mui-selected': {
              background: 'var(--app-primary)',
              color: '#fff',
              boxShadow: '0 6px 16px -6px rgba(var(--app-primary-rgb,99,102,241),0.7)',
              '&:hover, &:focus': {
                background: 'var(--app-primary)',
                transform: 'translateY(-1px)',
              },
            },
            '&.MuiPickersDay-today': {
              borderColor: 'rgba(var(--app-primary-rgb,99,102,241),0.55)',
            },
          },
        },
      },
      MuiDayCalendar: {
        styleOverrides: {
          weekDayLabel: {
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--app-primary)',
            opacity: 0.7,
          },
        },
      },
      MuiPickersCalendarHeader: {
        styleOverrides: {
          label: { fontWeight: 800 },
          switchViewButton: { color: 'var(--app-primary)' },
        },
      },
      MuiPickersArrowSwitcher: {
        styleOverrides: {
          button: {
            color: 'var(--app-primary)',
            transition: 'background-color .15s ease, transform .15s ease',
            '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.12)' },
          },
        },
      },
      MuiPickersYear: {
        styleOverrides: {
          yearButton: {
            borderRadius: 10,
            fontWeight: 600,
            transition: 'background-color .15s ease, color .15s ease',
            '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.12)' },
            '&.Mui-selected': {
              background: 'var(--app-primary)',
              color: '#fff',
              '&:hover, &:focus': { background: 'var(--app-primary)' },
            },
          },
        },
      },
      MuiPickersMonth: {
        styleOverrides: {
          monthButton: {
            borderRadius: 10,
            fontWeight: 600,
            transition: 'background-color .15s ease, color .15s ease',
            '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.12)' },
            '&.Mui-selected': {
              background: 'var(--app-primary)',
              color: '#fff',
              '&:hover, &:focus': { background: 'var(--app-primary)' },
            },
          },
        },
      },
      // Time pickers — digital-clock columns and the analog clock both follow
      // the chosen primary colour, with smooth, rounded selected items.
      MuiMultiSectionDigitalClockSection: {
        styleOverrides: {
          item: {
            borderRadius: 10,
            fontWeight: 600,
            transition: 'background-color .15s ease, color .15s ease',
            '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.12)' },
            '&.Mui-selected': {
              background: 'var(--app-primary)',
              color: '#fff',
              '&:hover, &:focus': { background: 'var(--app-primary)' },
            },
          },
        },
      },
      MuiDigitalClock: {
        styleOverrides: {
          item: {
            borderRadius: 10,
            transition: 'background-color .15s ease, color .15s ease',
            '&:hover': { backgroundColor: 'rgba(var(--app-primary-rgb,99,102,241),0.12)' },
            '&.Mui-selected': {
              background: 'var(--app-primary)',
              color: '#fff',
              '&:hover, &:focus': { background: 'var(--app-primary)' },
            },
          },
        },
      },
      MuiClock: {
        styleOverrides: {
          pin: { backgroundColor: 'var(--app-primary)' },
        },
      },
      MuiClockPointer: {
        styleOverrides: {
          root: { backgroundColor: 'var(--app-primary)' },
          thumb: { backgroundColor: 'var(--app-primary)', borderColor: 'var(--app-primary)' },
        },
      },
      MuiClockNumber: {
        styleOverrides: {
          root: {
            '&.Mui-selected': { backgroundColor: 'var(--app-primary)', color: '#fff' },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: glassFillStrong,
            backgroundImage: glassSheen,
            backdropFilter: glassBlurStrong,
            WebkitBackdropFilter: glassBlurStrong,
            borderRight: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
      <NightTorch active={torchActive} intensity={darkness} />
    </ThemeProvider>
  );
};

export default AppThemeProvider; 