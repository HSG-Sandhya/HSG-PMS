// ── Tenant registry ──────────────────────────────────────────────────────────
//
// One document per hotel. Lives in the control database, which the hotel apps
// ALSO read (their tenant-resolution middleware looks hotels up here by
// subdomain/customDomain). This app owns writes; the hotel apps only read.

import mongoose from "mongoose";
import { getControlConnection } from "../config/db.js";

const tenantSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Invalid slug"],
    },
    name: { type: String, required: true, trim: true },

    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, lowercase: true, trim: true, default: null },

    dbName: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["active", "suspended", "provisioning"],
      default: "provisioning",
    },
    plan: { type: String, default: "standard", trim: true },

    contactEmail: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true },
  },
  // bufferCommands lets a query that arrives in the brief window between the
  // server starting to listen and the DB connection finishing wait rather than
  // throw (avoids a cold-start race on the very first request).
  { timestamps: true, bufferCommands: true }
);

tenantSchema.index(
  { customDomain: 1 },
  { unique: true, partialFilterExpression: { customDomain: { $type: "string" } } }
);

export const getTenantModel = () => {
  const conn = getControlConnection();
  return conn.models.Tenant || conn.model("Tenant", tenantSchema);
};

export default getTenantModel;
