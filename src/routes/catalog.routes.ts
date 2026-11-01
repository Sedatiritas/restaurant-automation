import { Router } from "express";
import { requireRole } from "../middlewares/auth.middleware.js";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getCatalog,
  getPublicMenu,
  updateCategory,
  updateProduct
} from "../controllers/catalog.controller.js";

const router = Router();

// The customer-facing menu is read-only and does not require an account.
router.get("/api/menu", getPublicMenu);

// All catalog management endpoints are administrator-only.
router.use("/api/catalog", requireRole("ADMIN"));
router.get("/api/catalog", getCatalog);
router.post("/api/catalog/categories", createCategory);
router.patch("/api/catalog/categories/:id", updateCategory);
router.post("/api/catalog/categories/:id", updateCategory);
router.delete("/api/catalog/categories/:id", deleteCategory);
router.post("/api/catalog/products", createProduct);
router.patch("/api/catalog/products/:id", updateProduct);
router.post("/api/catalog/products/:id", updateProduct);
router.delete("/api/catalog/products/:id", deleteProduct);

export default router;
