// ── Multi-tenant request context ─────────────────────────────────────────────
//
// The app is single-database in shape (every controller queries "the" hotel's
// data) but we serve many hotels, one Mongo database each. Rather than thread a
// tenant handle through ~465 query sites, we keep the *current* tenant and its
// database Connection in an AsyncLocalStorage store. Any code — controllers,
// helpers like getBilling(), the activity logger — that touches a model during
// a request automatically hits the right database, because the model proxies in
// modelRegistry.js resolve against whatever connection lives here.
//
// Outside a request (startup jobs, maintenance scripts) there is no store; we
// fall back to the base connection (mongoose.connection, i.e. the database in
// MONGODB_URI). Set TENANCY_STRICT=true to turn that fallback into a hard error
// instead — useful for catching an unscoped query in tests.

import { AsyncLocalStorage } from "async_hooks";
import mongoose from "mongoose";

const store = new AsyncLocalStorage();

// The synthetic tenant used for the base connection (single-tenant / the
// original Sandhya Grand database). Registered tenants override this per request.
export const BASE_TENANT = Object.freeze({
  slug: "base",
  name: "Base",
  subdomain: null,
  dbName: null, // null → the database MONGODB_URI points at
});

// Run `fn` (and everything it awaits) with the given tenant context active.
export const runWithTenant = (ctx, fn) => store.run(ctx, fn);

// The tenant record for the in-flight request, or BASE_TENANT outside one.
export const getCurrentTenant = () => store.getStore()?.tenant || BASE_TENANT;

// The Mongoose Connection for the current tenant's database. Falls back to the
// base connection when there is no active context (unless TENANCY_STRICT).
export const getTenantConnection = () => {
  const ctx = store.getStore();
  if (ctx?.conn) return ctx.conn;
  if (process.env.TENANCY_STRICT === "true") {
    throw new Error(
      "No tenant context: a database query ran outside a resolved tenant request."
    );
  }
  return mongoose.connection;
};

// The base connection itself (the MONGODB_URI database). Used for provisioning
// and to pre-compile models at startup.
export const getBaseConnection = () => mongoose.connection;

// ── Token ⇄ tenant binding ───────────────────────────────────────────────────
//
// The JWT secret is shared across all hotels, so a token's signature alone does
// NOT prove it belongs to the hotel being addressed. Every issued token carries
// a `tenant` slug; requests are only honoured when it matches the resolved host.
// Tokens minted before multi-tenancy have no claim and are treated as "base"
// (the original hotel), so existing single-tenant sessions keep working but such
// a token can never be used against another hotel's subdomain.

export const tenantSlugOfToken = (decoded) => decoded?.tenant || "base";

export const tokenMatchesCurrentTenant = (decoded) =>
  tenantSlugOfToken(decoded) === getCurrentTenant().slug;

// The hotel's own name, for defaults and generated documents. Falls back to the
// tenant registry entry, then to nothing — never to another hotel's name. A
// literal here is how every new hotel on the platform ends up called
// "Hotel Sandhya Grand".
export const currentTenantName = () => {
  const t = getCurrentTenant();
  if (!t || t.slug === BASE_TENANT.slug) return process.env.HOTEL_NAME || "";
  return t.name || "";
};
