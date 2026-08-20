// Presentation helpers for the Rooms page: the amenity → icon map and the
// status colour styles. Both are pure (no component state).
import {
  AcUnit as AcIcon,
  Star as StarIcon,
  Wifi as WifiIcon,
  Restaurant as RestaurantIcon,
  KingBed as KingBedIcon,
  SingleBed as SingleBedIcon,
  Balcony as BalconyIcon,
  Visibility as ViewIcon,
  Spa as SpaIcon,
  Security as SecurityIcon,
  LocalParking as ParkingIcon,
  Checkroom as CheckroomIcon,
  Weekend as SofaIcon,
  Groups as FamilyBedIcon,
} from '@mui/icons-material';

export const amenityIcons = {
  'Air Conditioning': <AcIcon fontSize="small" />,
  TV: <StarIcon fontSize="small" />,
  WiFi: <WifiIcon fontSize="small" />,
  'Room Service': <RestaurantIcon fontSize="small" />,
  'King Bed': <KingBedIcon fontSize="small" />,
  'Twin Beds': <SingleBedIcon fontSize="small" />,
  'Grand Family Bed': <FamilyBedIcon fontSize="small" />,
  Sofa: <SofaIcon fontSize="small" />,
  Balcony: <BalconyIcon fontSize="small" />,
  'City View': <ViewIcon fontSize="small" />,
  Bathtub: <SpaIcon fontSize="small" />,
  Shower: <SpaIcon fontSize="small" />,
  'Coffee Maker': <RestaurantIcon fontSize="small" />,
  Safe: <SecurityIcon fontSize="small" />,
  Restaurant: <RestaurantIcon fontSize="small" />,
  Parking: <ParkingIcon fontSize="small" />,
  Wardrobe: <CheckroomIcon fontSize="small" />,
};

// One hue per status, as "r,g,b" so every shade below can be mixed at whatever
// alpha it needs. Dark mode gets a lighter, less saturated variant of the same
// hue: the deep light-mode colours turn to mud against a dark glass surface.
const STATUS_HUES = {
  available: { light: '46,125,50', dark: '102,187,106' },   // green
  occupied: { light: '198,40,40', dark: '239,110,110' },    // red
  cleaning: { light: '21,101,192', dark: '100,181,246' },   // blue
  maintenance: { light: '230,110,0', dark: '255,183,77' },  // amber
  unknown: { light: '110,116,128', dark: '158,164,176' },   // neutral grey
};

// The full set of shades a room card needs to read as "this status" at a glance:
// a tint washed over the glass, a matching rim, a coloured glow, the top accent
// bar and the status pill. Returned as one object so the card can never end up
// with, say, a green rim and a red pill.
//
// Everything is alpha-composited over the existing glass surface rather than
// replacing it — the card keeps its blur, its --app-surface-alpha and the
// user's theme, and only picks up a hue. `--app-card-glow` is respected so the
// Theme settings' "card glow" toggle still governs the outer glow.
export const getStatusCardTheme = (status, isDarkMode) => {
  const hue = STATUS_HUES[status] || STATUS_HUES.unknown;
  const rgb = isDarkMode ? hue.dark : hue.light;

  // Dark surfaces swallow colour, so they take a stronger wash than light ones.
  const a = isDarkMode
    ? { top: 0.20, mid: 0.07, rim: 0.38, glow: 0.22, hoverGlow: 0.34, pillBg: 0.24, pillText: 1 }
    : { top: 0.14, mid: 0.05, rim: 0.30, glow: 0.16, hoverGlow: 0.28, pillBg: 0.18, pillText: 1 };

  return {
    accent: `rgb(${rgb})`,
    // Diagonal wash: strongest at the top-left corner where the status bar and
    // pill sit, fading out before it reaches the price and amenities.
    tint: `linear-gradient(150deg, rgba(${rgb},${a.top}) 0%, rgba(${rgb},${a.mid}) 45%, rgba(${rgb},0) 78%)`,
    border: `1px solid rgba(${rgb},${a.rim})`,
    shadow: `0 4px 24px rgba(0,0,0,0.05), 0 0 24px rgba(${rgb},${a.glow}), `
      + 'inset 0 1px 0 rgba(255,255,255,var(--app-surface-border-alpha, 0.08))',
    hoverShadow: `0 18px 32px -8px rgba(0,0,0,0.18), 0 0 28px rgba(${rgb},${a.hoverGlow}), `
      + 'inset 0 1px 0 rgba(255,255,255,var(--app-surface-border-alpha, 0.12)), var(--app-card-glow)',
    pill: {
      backgroundColor: `rgba(${rgb},${a.pillBg})`,
      color: isDarkMode ? `rgb(${rgb})` : `rgba(${rgb},${a.pillText})`,
      border: `1px solid rgba(${rgb},${a.rim})`,
    },
  };
};
