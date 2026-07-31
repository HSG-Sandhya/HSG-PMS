// Boot the API against a THROWAWAY in-memory MongoDB — no Atlas, no real data.
// Everything lives in memory and vanishes when the process stops. Intended for
// local UI testing (e.g. opening the operator console at /platform) without
// touching production or needing an Atlas IP whitelist.
//
//   node scripts/dev-local.js
//
// Then open http://localhost:5002/platform
//
// The first run downloads a small mongod binary (cached afterwards).
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();

// These must be set BEFORE importing the server: config/env.js loads .env
// without `override`, so values already on process.env win over any Atlas
// credentials in .env. That's how we redirect the app to the throwaway DB.
process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-local-throwaway-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PORT = process.env.PORT || "5002";

const port = process.env.PORT;
console.log("\n🧪 Throwaway in-memory MongoDB ready:", uri);
console.log(`🌐 Operator console:  http://localhost:${port}/platform`);
console.log(`🏨 Hotel app / login: http://localhost:${port}/`);
console.log("   (empty database — the console will ask you to create the first admin)\n");

// Clean the in-memory server up on exit so no mongod is left running.
const stop = async () => { try { await mongod.stop(); } catch { /* ignore */ } };
process.on("exit", stop);
process.on("SIGINT", () => { stop().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { stop().finally(() => process.exit(0)); });

await import("../server.js");
