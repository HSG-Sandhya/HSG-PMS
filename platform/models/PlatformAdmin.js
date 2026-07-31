// ── Platform administrator ───────────────────────────────────────────────────
//
// Operators of the SaaS. Sign in against the control database; entirely separate
// from any hotel's staff. Bound to the control connection.

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { getControlConnection } from "../config/db.js";

const platformAdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    fullName: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  },
  // Buffer early queries during the connect window (see Tenant.js).
  { timestamps: true, bufferCommands: true }
);

// Mongoose 9: hooks must not call next() — return instead.
platformAdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

platformAdminSchema.methods.comparePassword = async function (entered) {
  if (!entered) return false;
  return bcrypt.compare(entered, this.password);
};

platformAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const getPlatformAdminModel = () => {
  const conn = getControlConnection();
  return conn.models.PlatformAdmin || conn.model("PlatformAdmin", platformAdminSchema);
};

export default getPlatformAdminModel;
