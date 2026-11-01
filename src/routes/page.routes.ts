import { Router } from "express";
import {
  renderAdmin,
  renderCashier,
  renderMenu,
  renderWaiter
} from "../controllers/page.controller.js";

const router = Router();

router.get("/", renderMenu);
router.get("/admin", renderAdmin);
router.get("/waiter", renderWaiter);
router.get("/cashier", renderCashier);

// Preserve the old page URLs as redirects for existing bookmarks.
router.get("/index.html", (_req, res) => res.redirect(301, "/"));
router.get("/admin.html", (_req, res) => res.redirect(301, "/admin"));
router.get("/waiter.html", (_req, res) => res.redirect(301, "/waiter"));
router.get("/cashier.html", (_req, res) => res.redirect(301, "/cashier"));

export default router;
