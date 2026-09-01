import { Router } from "express";
import { getSetupStatus, bootstrap, login, me } from "./controllers/authController.js";
import { list, getOne, create, update, suspend, activate } from "./controllers/hotelsController.js";
import { requirePlatformAdmin } from "./middleware/requirePlatformAdmin.js";
import { loginLimiter, setupLimiter, apiLimiter } from "./middleware/rateLimit.js";

const router = Router();

// Baseline ceiling for the whole control-plane API; the auth routes below add
// their own, much tighter limits on top.
router.use(apiLimiter);

// Public (auth)
router.get("/setup-status", getSetupStatus);
router.post("/setup", setupLimiter, bootstrap);
router.post("/login", loginLimiter, login);

// Authenticated
router.get("/me", requirePlatformAdmin, me);
router.get("/hotels", requirePlatformAdmin, list);
router.post("/hotels", requirePlatformAdmin, create);
router.get("/hotels/:id", requirePlatformAdmin, getOne);
router.patch("/hotels/:id", requirePlatformAdmin, update);
router.post("/hotels/:id/suspend", requirePlatformAdmin, suspend);
router.post("/hotels/:id/activate", requirePlatformAdmin, activate);

export default router;
