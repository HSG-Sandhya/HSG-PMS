import "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import routes from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const app = express();
app.disable("x-powered-by");
if (IS_PRODUCTION) app.set("trust proxy", 1);

// The console is a small same-origin static bundle; allow inline-free scripts.
app.use(
  helmet({
    contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(compression());

const normalize = (o) => o.trim().replace(/\/$/, "");
const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(normalize).filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || !IS_PRODUCTION || allowed.includes(normalize(origin))) return cb(null, true);
      return cb(new Error("Origin not allowed"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-setup-key"],
  })
);

app.use(express.json({ limit: "256kb" }));

// Control-plane API.
app.use("/api/platform", routes);

// Health.
app.get("/health", (_req, res) => res.json({ status: "ok", service: "pms-platform" }));

// Operator console (static, served at the root of this app).
app.use(
  express.static(join(__dirname, "public/console"), {
    index: "index.html",
    maxAge: IS_PRODUCTION ? "1h" : 0,
    etag: true,
  })
);

// Errors.
app.use((err, _req, res, _next) => {
  res.status(500).json({ success: false, message: err.message || "Server error" });
});

export default app;
