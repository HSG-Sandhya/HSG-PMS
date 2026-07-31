// Platform-admin authentication: first-run bootstrap (gated on zero admins),
// login, and current-admin. Tokens carry scope:"platform".
import jwt from "jsonwebtoken";
import { getPlatformAdminModel } from "../models/PlatformAdmin.js";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const signToken = (admin) =>
  jwt.sign({ id: admin._id, username: admin.username, scope: "platform" }, process.env.JWT_SECRET, {
    expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || "7d",
  });

export const getSetupStatus = wrap(async (_req, res) => {
  const count = await getPlatformAdminModel().countDocuments();
  res.json({ success: true, needsSetup: count === 0 });
});

export const bootstrap = wrap(async (req, res) => {
  const PlatformAdmin = getPlatformAdminModel();
  if ((await PlatformAdmin.countDocuments()) > 0) {
    return res.status(403).json({ success: false, message: "Platform setup is already complete." });
  }

  const setupKey = process.env.PLATFORM_SETUP_KEY;
  if (setupKey) {
    if (req.headers["x-setup-key"] !== setupKey) {
      return res.status(403).json({ success: false, message: "Invalid setup key." });
    }
  } else if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "Set PLATFORM_SETUP_KEY to create the first platform admin in production.",
    });
  }

  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  const username = clean(req.body.username);
  const email = clean(req.body.email).toLowerCase();
  const fullName = clean(req.body.fullName);
  const { password } = req.body;

  if (!username) return res.status(400).json({ success: false, message: "Username is required." });
  if (!password || String(password).length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
  }

  try {
    const admin = await PlatformAdmin.create({ username, email: email || undefined, fullName, password });
    return res.status(201).json({
      success: true,
      message: "Platform admin created. You can now sign in.",
      token: signToken(admin),
      admin: admin.toJSON(),
    });
  } catch (err) {
    const message =
      err?.code === 11000 ? "A platform admin with that username or email already exists." : err.message;
    return res.status(400).json({ success: false, message });
  }
});

export const login = wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }
  const admin = await getPlatformAdminModel().findOne({ username: String(username).trim() }).select("+password");
  if (!admin || !admin.isActive || !(await admin.comparePassword(password))) {
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }
  admin.lastLogin = new Date();
  await admin.save();
  res.json({ success: true, token: signToken(admin), admin: admin.toJSON() });
});

export const me = wrap(async (req, res) => {
  res.json({ success: true, admin: req.platformAdmin.toJSON() });
});
