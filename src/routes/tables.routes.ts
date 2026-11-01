import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import {
  createTable,
  deleteTable,
  getTables,
  updateTable
} from "../controllers/tables.controller.js";

const router = Router();

router.get("/api/waiter/tables", requireRole("WAITER"), getTables);
router.get("/api/admin/tables", requireRole("ADMIN"), getTables);
router.post("/api/admin/tables", requireRole("ADMIN"), createTable);
router.patch("/api/admin/tables/:id", requireRole("ADMIN"), updateTable);
router.delete("/api/admin/tables/:id", requireRole("ADMIN"), deleteTable);

export default router;
