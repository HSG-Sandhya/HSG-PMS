import "./config/env.js";
import app from "./app.js";
import { connectDB, closeDB, CONTROL_DB_NAME } from "./config/db.js";

const PORT = parseInt(process.env.PLATFORM_PORT, 10) || 5100;

for (const key of ["JWT_SECRET", "MONGODB_URI"]) {
  if (!process.env[key]) {
    console.error(`⛔ Missing required env var: ${key}`);
    process.exit(1);
  }
}

let server;

const start = async () => {
  await connectDB();
  console.log(`🟢 Control plane connected to MongoDB (control db: ${CONTROL_DB_NAME})`);
  server = app.listen(PORT, () => {
    console.log(`🚀 PMS Platform ready on http://localhost:${PORT}`);
    console.log(`   Operator console: http://localhost:${PORT}/`);
  });
};

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down…`);
  try {
    if (server) await new Promise((r) => server.close(r));
    await closeDB();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
  console.error("✖ Platform startup failed:", err.message);
  process.exit(1);
});
