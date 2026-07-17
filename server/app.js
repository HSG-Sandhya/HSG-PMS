// ── Core ─────────────────────────────────────────────────────────────────────
import "./config/env.js";
import express from "express";
import mongoose from "mongoose";
import { join, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

// ── Middleware ────────────────────────────────────────────────────────────────
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import timeout from "connect-timeout";

// ── Internal ──────────────────────────────────────────────────────────────────
import logger from "./config/logger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const app = express();

// Express fingerprint reduction
app.disable("x-powered-by");

// Trust reverse proxy in production by default (required for secure cookies/IP/rate-limit)
if (process.env.TRUST_PROXY !== undefined) {
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === "true") app.set("trust proxy", true);
  else if (trustProxy === "false") app.set("trust proxy", false);
  else if (!Number.isNaN(Number(trustProxy))) app.set("trust proxy", Number(trustProxy));
  else app.set("trust proxy", trustProxy);
} else if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

const haltOnTimedout = (req, _res, next) => {
  if (!req.timedout) next();
};

// ── Security ──────────────────────────────────────────────────────────────────

const HSTS_MAX_AGE = parseInt(process.env.HSTS_MAX_AGE, 10) || 15552000; // 180 days

app.use(
  helmet({
    contentSecurityPolicy: IS_PRODUCTION
      ? {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            // The front-desk booking form looks up district/state from external
            // pincode APIs directly in the browser. The default CSP connect-src
            // is 'self' only, which blocks them — allow just those two hosts.
            "connect-src": [
              "'self'",
              "https://api.postalpincode.in",
              "https://api.zippopotam.us",
            ],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: IS_PRODUCTION
      ? {
          maxAge: HSTS_MAX_AGE,
          includeSubDomains: true,
          preload: process.env.HSTS_PRELOAD === "true",
        }
      : false,
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.method === "OPTIONS",
  handler: (req, res) => {
    const retryAfterSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
    });
    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
      retryAfterSeconds,
    });
  },
});

if (IS_PRODUCTION) {
  app.use("/api", rateLimiter);
}

// ── General middleware ────────────────────────────────────────────────────────

app.use(compression());

const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 30000;
app.use(timeout(`${REQUEST_TIMEOUT_MS}ms`));
app.use(haltOnTimedout);

// Defensive guard for the timeout race: when a slow handler finally resolves
// after connect-timeout already answered with 503, a second res.json/res.send
// throws ERR_HTTP_HEADERS_SENT and (inside an async controller) surfaces as an
// unhandled rejection that crashes the process. Make any write after the
// response is already sent a silent no-op instead.
app.use((req, res, next) => {
  const guard = (method) => {
    const original = method.bind(res);
    return (...args) => (res.headersSent ? res : original(...args));
  };
  res.json = guard(res.json);
  res.send = guard(res.send);
  next();
});

// ── Request logging ───────────────────────────────────────────────────────────

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const meta = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip,
    };

    if (res.statusCode >= 500) logger.error("Request error", meta);
    else if (res.statusCode >= 400) logger.warn("Request warning", meta);
  });

  haltOnTimedout(req, res, next);
});

// ── CORS ──────────────────────────────────────────────────────────────────────

const normalizeOrigin = (origin) => origin.trim().replace(/\/$/, "");

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(normalizeOrigin).filter(Boolean)
  : IS_PRODUCTION
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5002",
      ].map(normalizeOrigin);

if (IS_PRODUCTION && allowedOrigins.length === 0) {
  logger.warn(
    "ALLOWED_ORIGINS is empty in production; cross-origin browser requests will be blocked"
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !IS_PRODUCTION) return callback(null, true);

      const normalized = normalizeOrigin(origin);

      if (allowedOrigins.includes(normalized)) return callback(null, true);

      logger.warn("CORS request rejected", { origin });
      callback(
        new Error(
          "The CORS policy for this site does not allow access from the specified Origin."
        ),
        false
      );
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: parseInt(process.env.CORS_MAX_AGE, 10) || 86400,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────

const BODY_LIMIT = process.env.BODY_LIMIT || "2mb";
const PARAMETER_LIMIT = parseInt(process.env.URLENCODED_PARAMETER_LIMIT, 10) || 1000;

app.use(express.json({ limit: BODY_LIMIT, strict: true }));
app.use(
  express.urlencoded({
    limit: BODY_LIMIT,
    extended: true,
    parameterLimit: PARAMETER_LIMIT,
  })
);
app.use(haltOnTimedout);

// ── Upload directories ────────────────────────────────────────────────────────

const UPLOAD_SUBDIRS = ["id-cards", "logos", "backgrounds", "menu-items", "aadhar"];
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || "uploads";

const initUploadDirs = () => {
  const base = isAbsolute(UPLOAD_BASE_DIR)
    ? UPLOAD_BASE_DIR
    : join(__dirname, UPLOAD_BASE_DIR);

  try {
    if (!existsSync(base)) mkdirSync(base, { recursive: true, mode: 0o755 });

    for (const sub of UPLOAD_SUBDIRS) {
      const dir = join(base, sub);
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true, mode: 0o755 });
        } catch (err) {
          logger.warn(`Could not create upload subdirectory: ${sub}`, {
            error: err.message,
          });
        }
      }
    }

    logger.info("Upload directories initialized");
    return base;
  } catch (err) {
    const fallback = join(process.cwd(), UPLOAD_BASE_DIR);
    logger.warn("Failed to init upload dirs, using fallback", {
      error: err.message,
      fallback,
    });
    return fallback;
  }
};

const uploadsDir = initUploadDirs();

// 1x1 transparent PNG served when an uploaded image is missing (e.g. a stale
// DB reference to a file that isn't on this machine). Lets the UI degrade to a
// blank image instead of a broken-image icon, and keeps the logs quiet.
const MISSING_IMAGE_PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

app.use(
  "/uploads",
  (_req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    });
    next();
  },
  express.static(uploadsDir, {
    dotfiles: "ignore",
    fallthrough: true,
    index: false,
    maxAge: IS_PRODUCTION ? "1h" : 0,
    etag: true,
  }),
  // Reached only when the requested upload doesn't exist on disk.
  (req, res) => {
    res.set("Cache-Control", "no-store");
    if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(req.path)) {
      res.type("png").status(200).send(MISSING_IMAGE_PLACEHOLDER);
    } else {
      res.status(404).type("txt").send("Not found");
    }
  }
);

// ── Routes ────────────────────────────────────────────────────────────────────

// Core system
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import websiteRoutes from "./routes/websiteRoutes.js";

// User & staff management
import userRoutes from "./routes/userRoutes.js";
import userManagementRoutes from "./routes/userManagementRoutes.js";
import userRoleRoutes from "./routes/userRoleRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import aadharRoutes from "./routes/aadhar.js";
import gstRoutes from "./routes/gst.js";

// Hotel operations
import roomRoutes from "./routes/roomRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import guestRoutes from "./routes/guestRoutes.js";
import housekeepingRoutes from "./routes/housekeepingRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";

// Business services
import restaurantRoutes from "./routes/restaurantRoutes.js";
import banquetRoutes from "./routes/banquetRoutes.js";
import marriageBookingRoutes from "./routes/marriageBookingRoutes.js";

// Financial & HR
import bankingRoutes from "./routes/bankingRoutes.js";
import accountingRoutes from "./routes/accountingRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import staffTransactionRoutes from "./routes/staffTransactionRoutes.js";
import staffRechargeRoutes from "./routes/staffRechargeRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import guestPrintRoutes from "./routes/guestPrintRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";

// Reporting & docs
import exportRoutes from "./routes/exportRoutes.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

// External integrations
import channelRoutes from "./routes/channelRoutes.js";
import channelManagerRoutes from "./routes/channelManagerRoutes.js";

// Activity logging for operational data mutations
import { auditMutations } from "./middleware/auditMutations.js";

const apiRoutes = [
  // Core system
  ["/api/auth", authRoutes],
  ["/api/dashboard", dashboardRoutes],
  ["/api/settings", settingsRoutes],
  ["/api/website", websiteRoutes],

  // User & staff
  ["/api/users", userRoutes],
  ["/api/user-management", userManagementRoutes],
  ["/api/user-roles", userRoleRoutes],
  ["/api/admin", adminRoutes],
  ["/api/staff", staffRoutes],
  ["/api/departments", departmentRoutes],
  ["/api/admin/aadhar", aadharRoutes],
  ["/api/admin/gst", gstRoutes],

  // Hotel operations (3rd element = resource label → mutation activity logging)
  ["/api/rooms", roomRoutes, "room"],
  ["/api/bookings", bookingRoutes, "booking"],
  ["/api/companies", companyRoutes, "company"],
  ["/api/guests", guestRoutes, "guest"],
  ["/api/housekeeping", housekeepingRoutes, "housekeeping"],
  ["/api/maintenance", maintenanceRoutes, "maintenance"],

  // Business services
  ["/api/restaurant", restaurantRoutes, "restaurant"],
  ["/api/banquet", banquetRoutes, "banquet"],
  ["/api/marriage-bookings", marriageBookingRoutes, "marriage-booking"],

  // Financial & HR
  ["/api/banking", bankingRoutes, "banking"],
  ["/api/accounting", accountingRoutes, "accounting"],
  ["/api/activity-logs", activityLogRoutes],
  ["/api/invoices", invoiceRoutes],
  ["/api/guest-print", guestPrintRoutes],
  ["/api/images", imageRoutes],
  ["/api/attendance", attendanceRoutes],
  ["/api/payroll", payrollRoutes],
  ["/api/staff-transactions", staffTransactionRoutes],
  ["/api/staff-recharges", staffRechargeRoutes],

  // Reporting
  ["/api/exports", exportRoutes],

  // External integrations
  ["/api/channels", channelRoutes],
  ["/api/channel-manager", channelManagerRoutes],
];

for (const [path, router, resource] of apiRoutes) {
  if (resource) {
    app.use(path, haltOnTimedout, auditMutations(resource), router);
  } else {
    app.use(path, haltOnTimedout, router);
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

const healthHandler = (_req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? "connected" : "disconnected";

    const { heapUsed, heapTotal } = process.memoryUsage();
    const mb = (b) => Math.round(b / 1024 / 1024);

    res.set("Cache-Control", "no-store");
    res.status(dbState === 1 ? 200 : 503).json({
      status: dbState === 1 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      server: {
        port: process.env.PORT || 5002,
        environment: process.env.NODE_ENV || "development",
        uptime: Math.floor(process.uptime()),
        memory: { used: mb(heapUsed), total: mb(heapTotal) },
      },
      database: {
        status: dbStatus,
        name: mongoose.connection.name || "unknown",
      },
    });
  } catch (err) {
    logger.error("Health check error", { error: err.message });
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ── API documentation (Swagger UI) ────────────────────────────────────────────
// Always available in non-production; in production only behind ENABLE_API_DOCS.
const ENABLE_API_DOCS = !IS_PRODUCTION || process.env.ENABLE_API_DOCS === "true";

if (ENABLE_API_DOCS) {
  app.get("/api/docs.json", (_req, res) => {
    res.set("Cache-Control", "no-store").json(swaggerSpec);
  });
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: "Sandhya Grand API Docs" })
  );
  logger.info("API documentation enabled", { path: "/api/docs" });
}

// ── Static client (production SPA) ────────────────────────────────────────────

const clientBuildCandidates = [
  join(__dirname, "../client/build"),
  join(__dirname, "../../client/build"),
];

const clientBuildPath = clientBuildCandidates.find((p) => existsSync(p)) ?? null;

if (clientBuildPath) {
  app.use(
    express.static(clientBuildPath, {
      maxAge: IS_PRODUCTION ? "1d" : 0,
      etag: true,
      index: false,
      dotfiles: "ignore",
    })
  );

  // Catch-all for client-side routing (must come after all API routes)
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) {
      return next();
    }
    res.set("Cache-Control", "no-cache, no-store, must-revalidate").sendFile(
      join(clientBuildPath, "index.html"),
      (err) => {
        if (err) {
          logger.error("Failed to serve index.html", { error: err.message });
          res.status(500).json({ error: "Failed to serve application" });
        }
      }
    );
  });

  logger.info("Serving React client", { path: clientBuildPath });
} else {
  logger.warn("Client build not found — API-only mode", {
    checked: clientBuildCandidates,
  });
}

// ── Error handling ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  if (err?.timeout || req.timedout) {
    logger.warn("Request timed out", {
      method: req.method,
      url: req.originalUrl,
      timeoutMs: REQUEST_TIMEOUT_MS,
      ip: req.ip,
    });
    if (!res.headersSent) {
      return res.status(503).json({
        success: false,
        error: "Request timeout",
      });
    }
    return;
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    logger.warn("Invalid JSON payload", {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
    return res.status(400).json({
      success: false,
      error: "Invalid JSON payload",
    });
  }

  next(err);
});

app.use("/api/*splat", notFound);
app.use(errorHandler);

export default app;
