// ── Database access for the control plane ────────────────────────────────────
//
// The platform connects to the SAME Mongo cluster as the hotels. It works with
// two kinds of database:
//   • the control DB (CONTROL_DB_NAME) — the tenant registry + platform admins,
//   • each hotel's own DB — only ever touched to SEED a brand-new hotel.
//
// useDb(name, { useCache }) gives a lightweight per-database handle that shares
// the one connection pool, so this never opens extra sockets.

import "./env.js";
import mongoose from "mongoose";

export const CONTROL_DB_NAME = process.env.CONTROL_DB_NAME || "pms_control";
export const BASE_DB_NAME = (process.env.BASE_DB_NAME || "").trim();

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  mongoose.set("strictQuery", false);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    family: 4,
    retryWrites: true,
    w: "majority",
  });
  return mongoose.connection;
};

export const closeDB = () => mongoose.connection.close();

// Control database (registry + platform admins).
export const getControlConnection = () =>
  mongoose.connection.useDb(CONTROL_DB_NAME, { useCache: true });

// A specific hotel's database (used only for provisioning/seeding a new hotel).
export const getTenantConnection = (dbName) =>
  mongoose.connection.useDb(dbName, { useCache: true });
