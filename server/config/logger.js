import "./env.js";

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel =
  LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ??
  (process.env.NODE_ENV === "production" ? LOG_LEVELS.warn : LOG_LEVELS.debug);

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const LEVEL_STYLE = {
  error: { icon: "✖", color: COLORS.red },
  warn: { icon: "⚠", color: COLORS.yellow },
  info: { icon: "●", color: COLORS.cyan },
  debug: { icon: "•", color: COLORS.gray },
};

const colorize = (text, color) =>
  USE_COLOR ? `${color}${text}${COLORS.reset}` : text;

const formatMetaValue = (value) =>
  typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);

const formatMeta = (meta) => {
  if (!meta || Object.keys(meta).length === 0) return "";

  const parts = Object.entries(meta).map(
    ([key, value]) => `${key}=${formatMetaValue(value)}`
  );
  const metaText = `(${parts.join(" ")})`;

  return ` ${colorize(metaText, COLORS.dim)}`;
};

const format = (level, message, meta) => {
  const base =
    typeof message === "object"
      ? JSON.stringify(message)
      : String(message);

  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.info;
  const icon = colorize(style.icon, style.color);

  return `${icon} ${base}${formatMeta(meta)}`;
};

const logger = {
  error(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.error)
      console.error(format("error", message, meta));
  },

  warn(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.warn)
      console.warn(format("warn", message, meta));
  },

  info(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.info)
      console.info(format("info", message, meta));
  },

  debug(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.debug)
      console.debug(format("debug", message, meta));
  },

  // Alias kept for backward compatibility
  log(message, meta = {}) {
    this.info(message, meta);
  },
};

export default logger;
