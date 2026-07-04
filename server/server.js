import "./config/env.js";
import http from "http";
import app from "./app.js";
import connectDB, { closeDB } from "./config/db.js";
import logger from "./config/logger.js";
import { rotateOnStart, scheduleJWTRotation } from "./utils/jwtRotation.js";
import { initSocket, closeSocket } from "./config/socket.js";
import paymentService from "./services/paymentService.js";

const PORT = parseInt(process.env.PORT, 10) || 5002;
const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (text, ansiCode) =>
  USE_COLOR ? `\x1b[${ansiCode}m${text}\x1b[0m` : text;
const launchLine = `${paint("🚀", "35")} ${paint(
  "Launching Sandhya Grand API",
  "1;36"
)}`;
const readyLine = `${paint("✅", "32")} ${paint("Server ready", "1;32")}`;
const healthLine = `${paint("🏥", "36")} ${paint("Health", "1;36")}`;
const memoryLine = `${paint("🧠", "35")} ${paint("Memory", "1;35")}`;
const shutdownLine = (text) => `${paint("🛑", "31")} ${paint(text, "1;31")}`;

// ── Environment validation ──────────────────────────────────────────────────

const REQUIRED_ENV = ["JWT_SECRET", "MONGODB_URI"];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`⛔ Missing required environment variable`, { key });
    process.exit(1);
  }
}

// ── Server bootstrap ────────────────────────────────────────────────────────

let server;

const startServer = async () => {
  logger.info(launchLine);

  await connectDB();
  await rotateOnStart();

  // Wrap the Express app in an explicit HTTP server so Socket.IO can attach to
  // the same port for real-time notifications (e.g. checkout → housekeeping).
  server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve, reject) => {
    server.listen(PORT, resolve);
    server.once("error", reject);
  });

  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  const mb = (bytes) => Math.round(bytes / 1024 / 1024);

  logger.info(readyLine, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
  logger.info(
    `${memoryLine}: ${paint(
      `heap ${mb(heapUsed)}/${mb(heapTotal)} MB | rss ${mb(rss)} MB`,
      "1;37"
    )}`
  );
  logger.info(`${healthLine}: ${paint(`http://localhost:${PORT}/health`, "1;37")}`);

  // JWT secret rotation is opt-in via ENABLE_JWT_ROTATION. When it's unset
  // (the default), both rotateOnStart() above and this scheduler are no-ops, so
  // a routine restart never rotates the secret and logs out active sessions.
  scheduleJWTRotation(24);

  // Load Razorpay credentials from the Settings doc as the final boot step —
  // once the DB is connected and the server is already listening. The service
  // constructor deliberately skips this to avoid a buffering timeout during
  // module import (before connectDB runs). Kept non-fatal: a payment-config
  // problem must not stop an otherwise-healthy server from serving traffic.
  try {
    await paymentService.initializeRazorpay();
  } catch (err) {
    logger.error("Payment service init failed (continuing)", { error: err.message });
  }
};

// ── Graceful shutdown ───────────────────────────────────────────────────────

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(shutdownLine("Shutdown signal received"), {
    signal: paint(signal, "1;31"),
  });

  try {
    closeSocket();

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info(shutdownLine("HTTP server closed"));
    }

    await closeDB();

    logger.info(shutdownLine("Shutdown complete"));
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown", { error: err.message });
    process.exit(1);
  }
};

// ── Process-level error handling ────────────────────────────────────────────

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logger.error("✖ Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("✖ Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});

// ── Start ───────────────────────────────────────────────────────────────────

startServer().catch((err) => {
  logger.error("✖ Server startup failed", { error: err.message });
  process.exit(1);
});
