import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import {
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff
} from "../controllers/staff.controller.js";

const router = Router();

router.use("/api/staff", requireRole());
router.get("/api/staff", listStaff);
router.post("/api/staff", createStaff);
router.patch("/api/staff/:id", updateStaff);
// Native HTML-form fallback; the enhanced admin UI uses PATCH via fetch.
router.post("/api/staff/:id", updateStaff);
router.delete("/api/staff/:id", deleteStaff);

export default router;
