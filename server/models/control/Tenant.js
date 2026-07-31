// ── Tenant registry (control plane) ──────────────────────────────────────────
//
// One document per hotel that uses the platform. Lives in the control database,
// NOT in any hotel's own database, so it is bound directly to the control
// connection rather than going through the tenant-aware model registry.
//
// `subdomain` is how a request is routed to this hotel (taj.example.com → "taj").
// `dbName` is the hotel's own Mongo database on the shared cluster.

import mongoose from "mongoose";
import { getControlConnection } from "../../db/tenantConnection.js";

const tenantSchema = new mongoose.Schema(
  {
    // Human-friendly identifier, also the default basis for dbName/subdomain.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Invalid slug"],
    },
    name: { type: String, required: true, trim: true }, // display name of the hotel

    // Routing
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Optional fully-qualified custom domain (admin.hotelx.com). Matched before
    // subdomain when present.
    customDomain: { type: String, lowercase: true, trim: true, default: null },

    // The hotel's Mongo database on the shared cluster.
    dbName: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["active", "suspended", "provisioning"],
      default: "provisioning",
    },
    plan: { type: String, default: "standard", trim: true },

    // Free-form billing / contact metadata for the platform operator.
    contactEmail: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// customDomain is optional but must be unique when set.
tenantSchema.index(
  { customDomain: 1 },
  { unique: true, partialFilterExpression: { customDomain: { $type: "string" } } }
);

// Bound to the control connection, compiled once.
export const getTenantModel = () => {
  const conn = getControlConnection();
  return conn.models.Tenant || conn.model("Tenant", tenantSchema);
};

export default getTenantModel;
