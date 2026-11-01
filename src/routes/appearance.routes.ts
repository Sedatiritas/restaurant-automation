import { Router } from "express";
import { getMenuAppearance, saveMenuAppearance } from "../controllers/appearance.controller.js";
import { requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/api/appearance", getMenuAppearance);
router.put("/api/admin/appearance", requireRole("ADMIN"), saveMenuAppearance);

export default router;
