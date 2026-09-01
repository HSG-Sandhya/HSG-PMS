import rateLimit from "express-rate-limit";

/**
 * Rate limits for the control plane.
 *
 * This service is strictly more privileged than any single hotel: its sessions
 * can create, suspend and reconfigure every tenant. It nevertheless shipped with
 * no rate limiting at all, while the hotel API it governs has had it in
 * production all along — the more powerful login surface was the softer target.
 *
 * `PLATFORM_DISABLE_RATE_LIMIT=true` turns these off for local work. It is
 * deliberately opt-out rather than opt-in, so a misconfigured production
 * environment fails safe (limited) instead of open.
 */
const DISABLED = process.env.PLATFORM_DISABLE_RATE_LIMIT === "true";

const num = (v, fallback) => (parseInt(v, 10) > 0 ? parseInt(v, 10) : fallback);

const MINUTE = 60 * 1000;

const build = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => DISABLED,
    handler: (req, res) => {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      res.set("Retry-After", String(retryAfterSeconds));
      // Control-plane abuse is worth seeing in the log with its source.
      console.warn(
        `[rate-limit] ${req.method} ${req.originalUrl} from ${req.ip} — limit ${max}/${windowMs / MINUTE}min`
      );
      res.status(429).json({ success: false, message, retryAfterSeconds });
    },
  });

/**
 * Sign-in. Only FAILED attempts count (`skipSuccessfulRequests`), so a working
 * operator is never throttled while a guesser is cut off quickly.
 */
export const loginLimiter = build({
  windowMs: num(process.env.PLATFORM_LOGIN_WINDOW_MS, 15 * MINUTE),
  max: num(process.env.PLATFORM_LOGIN_MAX, 10),
  skipSuccessfulRequests: true,
  message: "Too many failed sign-in attempts. Please try again later.",
});

/**
 * First-run bootstrap. Creates the first platform administrator, so it is the
 * single most dangerous endpoint in the repository. It is already gated on
 * "zero admins exist" plus PLATFORM_SETUP_KEY; this stops the key itself being
 * brute-forced during the window before the first admin is created.
 */
export const setupLimiter = build({
  windowMs: num(process.env.PLATFORM_SETUP_WINDOW_MS, 60 * MINUTE),
  max: num(process.env.PLATFORM_SETUP_MAX, 5),
  message: "Too many setup attempts. Please try again later.",
});

/** Everything else under /api/platform. */
export const apiLimiter = build({
  windowMs: num(process.env.PLATFORM_API_WINDOW_MS, 15 * MINUTE),
  max: num(process.env.PLATFORM_API_MAX, 300),
  message: "Too many requests. Please try again later.",
});
