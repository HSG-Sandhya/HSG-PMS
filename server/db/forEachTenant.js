// ── Run a job across every served database ───────────────────────────────────
//
// Background jobs (e.g. the tentative-hold expiry sweep) are global: they must
// run for every hotel, not just the one that happens to be in context. This
// runs `fn` once for the base database and once for each active tenant, each
// inside its own tenant context so the models inside `fn` hit the right DB.

import { getTenantModel } from "../models/control/Tenant.js";
import { getConnectionForTenant } from "./tenantConnection.js";
import { runWithTenant, BASE_TENANT, getBaseConnection } from "./tenantContext.js";
import { ensureModels } from "./modelRegistry.js";

export const forEachTenant = async (fn) => {
  const results = [];

  // Base database first (the original single-tenant DB).
  const baseConn = getBaseConnection();
  ensureModels(baseConn);
  results.push(
    await runWithTenant({ tenant: BASE_TENANT, conn: baseConn }, () => fn(BASE_TENANT))
  );

  // Then each registered active hotel.
  let tenants = [];
  try {
    tenants = await getTenantModel().find({ status: "active" }).lean();
  } catch {
    // Control DB unreachable (e.g. not provisioned yet) — base-only is fine.
    return results;
  }

  for (const tenant of tenants) {
    if (!tenant.dbName || tenant.dbName === baseConn.name) continue; // base already done
    const conn = getConnectionForTenant(tenant);
    results.push(await runWithTenant({ tenant, conn }, () => fn(tenant)));
  }

  return results;
};
