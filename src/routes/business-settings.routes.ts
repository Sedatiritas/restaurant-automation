import { Router } from "express";
import { getBusinessSettings, saveBusinessSettings } from "../controllers/business-settings.controller.js";
import { requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/api/business-settings", getBusinessSettings);
router.put("/api/admin/business-settings", requireRole("ADMIN"), saveBusinessSettings);

export default router;
