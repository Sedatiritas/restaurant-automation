import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout } from "../controllers/auth.controller.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).render("auth/login", {
      error: "Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
      selectedRole: "",
      email: ""
    });
  }
});

router.post("/auth/login", loginLimiter, login);
router.post("/auth/logout", logout);

export default router;
