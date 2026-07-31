// ── Tenant / control database connections ────────────────────────────────────
//
// All hotels live on the SAME Mongo cluster, one database each. We never open a
// second socket pool per hotel: mongoose.connection.useDb(name, { useCache })
// returns a lightweight Connection scoped to another database that shares the
// base connection's pool. So "database-per-tenant" costs the same connections
// as single-tenant — only namespaces grow.

import mongoose from "mongoose";
import { getBaseConnection } from "./tenantContext.js";
import { ensureModels } from "./modelRegistry.js";

const CONTROL_DB_NAME = process.env.CONTROL_DB_NAME || "pms_control";

// Connection for the control-plane database (the tenant registry, platform
// admins). Distinct from any hotel's data.
export const getControlConnection = () =>
  getBaseConnection().useDb(CONTROL_DB_NAME, { useCache: true });

// Connection for a specific tenant. A null/empty dbName (or the synthetic base
// tenant) means "use the base connection" — i.e. the original single-tenant
// database in MONGODB_URI, which stays exactly as it was.
export const getConnectionForTenant = (tenant) => {
  const dbName = tenant?.dbName;
  const conn =
    !dbName || dbName === getBaseConnection().name
      ? getBaseConnection()
      : getBaseConnection().useDb(dbName, { useCache: true });
  // Compile all models on first use so cross-model populate() resolves refs.
  ensureModels(conn);
  return conn;
};

export { CONTROL_DB_NAME };
