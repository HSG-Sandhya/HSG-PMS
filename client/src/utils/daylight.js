// Sunrise / sunset for "Automatic" appearance mode.
//
// Computes today's sunrise and sunset using the standard NOAA sunrise equation
// (official zenith 90.833°) and returns them as Date objects in the device's
// local timezone — so the light/dark switch tracks the *system clock*. The app
// is dark from sunset until the next sunrise.
//
// Coordinates default to the hotel's location (Munger, Bihar). They can be
// overridden per call if we ever expose lat/long in settings.
export const DEFAULT_LAT = 25.3708;
export const DEFAULT_LNG = 86.4735;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const range = (x, m) => ((x % m) + m) % m;

// Core solar-hour computation. `which` is 'sunrise' or 'sunset'.
// Returns the event's fractional hour in UTC, or null for polar day/night.
const solarHourUTC = (date, lat, lng, which) => {
  const ZENITH = 90.833;
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
  const N = Math.floor(diff / 86400000); // day of the year

  const lngHour = lng / 15;
  const t = which === 'sunrise' ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;

  const M = 0.9856 * t - 3.289; // sun's mean anomaly
  let L = M + 1.916 * Math.sin(rad(M)) + 0.020 * Math.sin(rad(2 * M)) + 282.634;
  L = range(L, 360); // sun's true longitude

  let RA = deg(Math.atan(0.91764 * Math.tan(rad(L))));
  RA = range(RA, 360);
  // Right ascension must be in the same quadrant as L
  const Lquad = Math.floor(L / 90) * 90;
  const RAquad = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquad - RAquad)) / 15;

  const sinDec = 0.39782 * Math.sin(rad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(ZENITH)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
  if (cosH > 1 || cosH < -1) return null; // sun never rises / never sets here today

  const H = (which === 'sunrise' ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH))) / 15;
  const T = H + RA - 0.06571 * t - 6.622; // local mean time
  return range(T - lngHour, 24); // → UTC hour
};

// Build a Date for a UTC fractional hour, anchored to `date`'s LOCAL day.
// The event's UTC instant can fall on the previous/next UTC calendar day (e.g.
// an early local sunrise east of Greenwich is the prior UTC day), so we shift
// by ±1 day until the result's local date matches the target local date.
const utcHourToLocalDate = (date, utcHour) => {
  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let dt = new Date(base + utcHour * 3600000);
  const targetMid = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  for (let i = 0; i < 2; i += 1) {
    const dtMid = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    if (dtMid === targetMid) break;
    dt = new Date(dt.getTime() + (dtMid > targetMid ? -86400000 : 86400000));
  }
  return dt;
};

// { sunrise: Date, sunset: Date } in local time for `date`'s day.
// Falls back to 06:00 / 18:00 local if the solar calc is undefined.
export const getSunTimes = (date = new Date(), lat = DEFAULT_LAT, lng = DEFAULT_LNG) => {
  const riseUTC = solarHourUTC(date, lat, lng, 'sunrise');
  const setUTC = solarHourUTC(date, lat, lng, 'sunset');
  const fallback = (h) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0);
  return {
    sunrise: riseUTC == null ? fallback(6) : utcHourToLocalDate(date, riseUTC),
    sunset: setUTC == null ? fallback(18) : utcHourToLocalDate(date, setUTC),
  };
};

// True when `now` is before today's sunrise or at/after today's sunset.
export const isNight = (now = new Date(), lat = DEFAULT_LAT, lng = DEFAULT_LNG) => {
  const { sunrise, sunset } = getSunTimes(now, lat, lng);
  return now < sunrise || now >= sunset;
};

// Progress through the current night as a fraction 0→1: 0 right at sunset,
// 1 at the coming sunrise. Returns null during the day. Automatic appearance
// mode uses this to deepen the darkness as the night wears on (see
// AppThemeProvider): 20% just after sunset ramping to 100% by sunrise.
export const nightProgress = (now = new Date(), lat = DEFAULT_LAT, lng = DEFAULT_LNG) => {
  const { sunrise, sunset } = getSunTimes(now, lat, lng);
  let start;
  let end;
  if (now >= sunset) {
    // Evening / first half of the night: tonight's sunset → tomorrow's sunrise.
    start = sunset;
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    end = getSunTimes(tomorrow, lat, lng).sunrise;
  } else if (now < sunrise) {
    // After midnight before sunrise: last night's sunset → today's sunrise.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    start = getSunTimes(yesterday, lat, lng).sunset;
    end = sunrise;
  } else {
    return null; // daytime
  }
  const span = end.getTime() - start.getTime();
  if (span <= 0) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
};

// Milliseconds until the next day↔night transition, so a timer can flip the
// theme exactly at sunrise/sunset instead of polling constantly.
export const msUntilNextTransition = (now = new Date(), lat = DEFAULT_LAT, lng = DEFAULT_LNG) => {
  const { sunrise, sunset } = getSunTimes(now, lat, lng);
  const candidates = [sunrise.getTime(), sunset.getTime()];
  // Tomorrow's sunrise, as a backstop once today's events have passed.
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  candidates.push(getSunTimes(tomorrow, lat, lng).sunrise.getTime());
  const next = candidates.filter((t) => t > now.getTime()).sort((a, b) => a - b)[0];
  return next ? Math.max(30000, next - now.getTime()) : 60 * 60 * 1000;
};

// Small helper for the settings UI: "5:41 AM".
export const formatClock = (date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
