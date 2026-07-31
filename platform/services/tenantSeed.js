// ── Seed a brand-new hotel database ──────────────────────────────────────────
//
// The platform is decoupled from the hotel app's Mongoose models, so it seeds a
// new hotel by writing plain documents with the raw driver — no hotel schemas
// imported. It only creates the minimum a hotel needs to be usable on first
// login: a System Administrator role, a Management department, a Settings doc
// carrying the hotel's name, and the first admin user (password bcrypt-hashed).
//
// The hotel app fills in everything else (full Settings defaults, indexes, etc.)
// the first time it serves that hotel. Documents here intentionally match the
// shapes the hotel app expects; because they are raw inserts, no schema drift in
// the hotel app can make seeding fail.

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const oid = () => new mongoose.Types.ObjectId();

const ADMIN_ROLE = {
  name: "System Administrator",
  description: "Full system access with all administrative privileges",
  hierarchy: 10,
  permissions: [
    "admin_access", "system_admin", "manage_settings", "manage_staff",
    "manage_roles", "manage_users", "view_dashboard", "manage_bookings",
    "manage_rooms", "manage_guests", "manage_payments", "manage_housekeeping",
    "manage_restaurant", "manage_pos", "manage_events", "manage_channels",
  ],
  accessLevel: {
    canViewAll: true, canEditAll: true, canDeleteAll: true,
    canManageUsers: true, canManageRoles: true, canAccessSettings: true,
    canViewReports: true, canManageSystem: true,
  },
  isActive: true,
};

// Seed `conn` (a hotel database) if it is empty. Idempotent: skips anything that
// already exists so re-running provisioning can't create duplicates.
export const seedTenantDatabase = async (conn, { hotelName, admin }) => {
  const db = conn.db;
  const now = new Date();

  let role = await db.collection("roles").findOne({ name: ADMIN_ROLE.name });
  if (!role) {
    const _id = oid();
    await db.collection("roles").insertOne({ _id, ...ADMIN_ROLE, createdAt: now, updatedAt: now });
    role = { _id };
  }

  let dept = await db.collection("departments").findOne({ name: "Management" });
  if (!dept) {
    const _id = oid();
    await db.collection("departments").insertOne({
      _id, name: "Management", description: "Executive and administrative management",
      isActive: true, color: "#EC4899", createdAt: now, updatedAt: now,
    });
    dept = { _id };
  }

  if (!(await db.collection("settings").findOne({}))) {
    await db.collection("settings").insertOne({ hotelName, createdAt: now, updatedAt: now });
  }

  if (admin) {
    const exists = await db.collection("users").findOne({
      $or: [{ username: admin.username }, { phone: admin.phone }],
    });
    if (!exists) {
      const doc = {
        username: admin.username,
        phone: admin.phone,
        password: await bcrypt.hash(admin.password, 10),
        firstName: admin.firstName,
        lastName: admin.lastName || "",
        role: role._id,
        department: dept._id,
        legacyRole: "admin",
        permissions: [],
        isActive: true,
        isSystemAdmin: true,
        settings: { notifications: {}, preferences: {} },
        createdAt: now,
        updatedAt: now,
      };
      if (admin.email) doc.email = String(admin.email).toLowerCase();
      await db.collection("users").insertOne(doc);
    }
  }
};
