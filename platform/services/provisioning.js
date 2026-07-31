// ── Tenant provisioning ──────────────────────────────────────────────────────
//
// Creates a hotel: a registry row in the control DB + a freshly seeded hotel
// database. The hotel app (a separate service) picks the new hotel up from the
// shared registry within its cache TTL — there is no cross-process cache to bust.

import mongoose from "mongoose";
import { getTenantModel } from "../models/Tenant.js";
import { getTenantConnection, BASE_DB_NAME } from "../config/db.js";
import { seedTenantDatabase } from "./tenantSeed.js";

// Subdomains the hotel app treats as its own (non-tenant) hosts — a hotel can't
// use these. Keep in sync with the hotel app's RESERVED_SUBDOMAINS.
const RESERVED = new Set(
  (process.env.RESERVED_SUBDOMAINS || "www,api,admin,app,static,assets,cdn,mail")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);

export const slugify = (s) =>
  String(s || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const createTenant = async (opts) => {
  const name = String(opts.name || "").trim();
  if (!name) throw new Error("Hotel name is required");

  const slug = slugify(opts.slug || name);
  if (!slug) throw new Error("Could not derive a valid slug from the name");
  const subdomain = slugify(opts.subdomain || slug);
  if (RESERVED.has(subdomain)) throw new Error(`"${subdomain}" is a reserved subdomain`);

  const dbName = opts.dbName || `hotel_${subdomain.replace(/-/g, "_")}`;
  if (BASE_DB_NAME && dbName === BASE_DB_NAME) {
    throw new Error(`dbName "${dbName}" collides with the base hotel's database`);
  }
  if (dbName === (process.env.CONTROL_DB_NAME || "pms_control")) {
    throw new Error("dbName collides with the control database");
  }

  const Tenant = getTenantModel();
  const clash = await Tenant.findOne({ $or: [{ slug }, { subdomain }, { dbName }] });
  if (clash) {
    throw new Error(`A hotel already exists with that slug/subdomain/dbName (conflict on "${clash.slug}")`);
  }

  const tenant = await Tenant.create({
    name, slug, subdomain, dbName,
    customDomain: opts.customDomain || null,
    plan: opts.plan || "standard",
    contactEmail: opts.contactEmail,
    status: "provisioning",
  });

  try {
    const conn = getTenantConnection(dbName);
    await seedTenantDatabase(conn, { hotelName: name, admin: opts.admin });
    tenant.status = "active";
    await tenant.save();
    return tenant;
  } catch (err) {
    tenant.status = "suspended"; // don't serve a half-seeded hotel
    await tenant.save().catch(() => {});
    throw err;
  }
};

export const listTenants = (filter = {}) =>
  getTenantModel().find(filter).sort({ createdAt: -1 }).lean();

export const getTenant = (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return getTenantModel().findById(id);
};
