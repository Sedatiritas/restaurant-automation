import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import {
  createTable,
  deleteTable,
  getTables,
  updateTable
} from "../controllers/tables.controller.js";

const router = Router();

router.use("/api/admin/tables", requireRole("ADMIN"));
router.get("/api/admin/tables", getTables);
router.post("/api/admin/tables", createTable);
router.patch("/api/admin/tables/:id", updateTable);
router.delete("/api/admin/tables/:id", deleteTable);

export default router;
