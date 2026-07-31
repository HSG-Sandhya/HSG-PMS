// Guards the whole authenticated control-plane API. Requires a JWT minted by
// this app's login with scope:"platform".
import jwt from "jsonwebtoken";
import { getPlatformAdminModel } from "../models/PlatformAdmin.js";

const JWT_ALGORITHMS = process.env.JWT_ALGORITHMS
  ? process.env.JWT_ALGORITHMS.split(",").map((a) => a.trim()).filter(Boolean)
  : ["HS256"];

const getToken = (req) => {
  const auth = req.headers.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() || null : null;
};

export const requirePlatformAdmin = async (req, res, next) => {
  const token = getToken(req);
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: "Platform authentication required." });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired platform token." });
  }
  if (decoded.scope !== "platform" || !decoded.id) {
    return res.status(403).json({ success: false, message: "Not a platform session." });
  }
  try {
    const admin = await getPlatformAdminModel().findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "Platform account not found or inactive." });
    }
    req.platformAdmin = admin;
    return next();
  } catch (err) {
    return next(err);
  }
};

export default requirePlatformAdmin;
