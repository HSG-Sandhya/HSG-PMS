import { Router } from "express";
import { getSetupStatus, bootstrap, login, me } from "./controllers/authController.js";
import { list, getOne, create, update, suspend, activate } from "./controllers/hotelsController.js";
import { requirePlatformAdmin } from "./middleware/requirePlatformAdmin.js";

const router = Router();

// Public (auth)
router.get("/setup-status", getSetupStatus);
router.post("/setup", bootstrap);
router.post("/login", login);

// Authenticated
router.get("/me", requirePlatformAdmin, me);
router.get("/hotels", requirePlatformAdmin, list);
router.post("/hotels", requirePlatformAdmin, create);
router.get("/hotels/:id", requirePlatformAdmin, getOne);
router.patch("/hotels/:id", requirePlatformAdmin, update);
router.post("/hotels/:id/suspend", requirePlatformAdmin, suspend);
router.post("/hotels/:id/activate", requirePlatformAdmin, activate);

export default router;
