/**
 * Session cookie for the admin SPA.
 *
 * The JWT used to live only in localStorage, which means any successful XSS
 * could read a 30-day credential and exfiltrate it. Holding it in an HttpOnly
 * cookie takes it out of JavaScript's reach entirely — script running on the
 * page can still *act* as the user, but it can no longer steal a token that
 * keeps working from anywhere else, for a month, after the page is closed.
 *
 * SameSite=Lax is what stands in for CSRF tokens here: it blocks the cookie on
 * cross-site POST/PUT/PATCH/DELETE (every state-changing verb) while still
 * allowing top-level GET navigation, so deep links into the admin keep working.
 * The admin SPA and the API are served from the SAME origin (see
 * deploy/nginx/admin.sandhyagrand.in.conf), so nothing legitimate needs the
 * cookie cross-site.
 */
export const AUTH_COOKIE = 'pms_session';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Mirrors the JWT lifetime so the cookie cannot outlive the token it carries.
const maxAgeMs = () => {
  const raw = process.env.JWT_EXPIRES_IN || '30d';
  const m = /^(\d+)([smhd])$/.exec(String(raw).trim());
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
};

const baseOptions = () => ({
  httpOnly: true,
  // Secure requires HTTPS; local development runs on plain http.
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  path: '/',
});

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE, token, { ...baseOptions(), maxAge: maxAgeMs() });
};

/** Options must match those used to set it, or the browser keeps the cookie. */
export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, baseOptions());
};

/** Read the session token from the cookie, if present. */
export const tokenFromCookie = (req) => {
  const v = req.cookies?.[AUTH_COOKIE];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
