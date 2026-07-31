// Boot the platform against a THROWAWAY in-memory MongoDB — no Atlas, no real
// data. For local UI testing of the operator console.
//
//   node scripts/dev-local.js   →   http://localhost:5100
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-local-throwaway-secret";
process.env.CONTROL_DB_NAME = process.env.CONTROL_DB_NAME || "pms_control";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PLATFORM_PORT = process.env.PLATFORM_PORT || "5100";

console.log("\n🧪 Throwaway in-memory MongoDB:", process.env.MONGODB_URI);
console.log(`🌐 Operator console: http://localhost:${process.env.PLATFORM_PORT}/\n`);

const stop = async () => { try { await mongod.stop(); } catch { /* ignore */ } };
process.on("exit", stop);
process.on("SIGINT", () => { stop().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { stop().finally(() => process.exit(0)); });

await import("../server.js");
