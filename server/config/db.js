import "./env.js";
import mongoose from "mongoose";
import logger from "./logger.js";

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (text, ansiCode) =>
  USE_COLOR ? `\x1b[${ansiCode}m${text}\x1b[0m` : text;

const getMongoOptions = () => ({
  // Images are stored in Mongo and served through /api/images/:id, so one page
  // can fire many concurrent multi-MB fetches. A pool of 5/10 saturated instantly
  // and extra requests queued (with no wait-timeout) until the 30s HTTP timeout
  // killed them (503). A larger pool lets those run in parallel; Atlas tiers
  // allow far more connections than this.
  maxPoolSize:
    parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) ||
    (process.env.NODE_ENV === "production" ? 50 : 20),
  serverSelectionTimeoutMS: 5000,
  // Keep below the HTTP request timeout (REQUEST_TIMEOUT_MS, default 30s) so a
  // dead pooled socket — laptop sleep, network switch, Atlas failover — errors
  // and triggers a driver reconnect before the request window expires, instead
  // of hanging the full 30s. Queries here run in <1s, so this never cuts off
  // legitimate work.
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 10) || 20000,
  family: 4, // Prefer IPv4
  retryWrites: true,
  w: "majority",
});

const setupConnectionHandlers = () => {
  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", { error: err.message });
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  logger.info(`${paint("🗄", "35")} ${paint("Connecting to MongoDB...", "1;34")}`);

  mongoose.set("strictQuery", false);

  const conn = await mongoose.connect(
    process.env.MONGODB_URI,
    getMongoOptions()
  );

  const { name, host, port } = conn.connection;
  logger.info(
    `${paint("🟢", "32")} ${paint("MongoDB connected", "1;32")}: ${paint(
      `${name}@${host}:${port}`,
      "36"
    )}`
  );

  setupConnectionHandlers();

  return conn;
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (err) {
    logger.error("Error closing MongoDB connection", { error: err.message });
    throw err;
  }
};

export default connectDB;
