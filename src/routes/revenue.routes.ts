import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import { getAdminRevenueReport } from "../controllers/revenue.controller.js";
import { streamAdminRevenueEvents } from "../controllers/orders.controller.js";

const router = Router();

router.get("/api/admin/revenue", requireRole("ADMIN"), getAdminRevenueReport);
router.get("/api/admin/revenue/events", requireRole("ADMIN"), streamAdminRevenueEvents);

export default router;
