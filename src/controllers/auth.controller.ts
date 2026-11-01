import argon2 from "argon2";
import { z } from "zod";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
  type AppRole
} from "../lib/session.js";

const loginSchema = z.object({
  role: z.enum(["ADMIN", "WAITER", "CASHIER"]),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
});

const dashboardByRole: Record<AppRole, string> = {
  ADMIN: "/admin",
  WAITER: "/waiter",
  CASHIER: "/cashier"
};

export const login: RequestHandler = async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).render("auth/login", {
      error: "Lütfen rol, e-posta ve parola bilgilerini kontrol edin.",
      selectedRole: req.body?.role ?? "",
      email: req.body?.email ?? ""
    });
    return;
  }

  try {
    const { role, email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    let passwordIsValid = false;

    if (user && user.isActive && user.role === role) {
      passwordIsValid = await argon2.verify(user.passwordHash, password);
    }

    // Keep the response the same for unknown email, wrong role and wrong password.
    if (!user || !user.isActive || user.role !== role || !passwordIsValid) {
      res.status(401).render("auth/login", {
        error: "Giriş bilgileri hatalı. Rolünüzü, e-postanızı ve parolanızı kontrol edin.",
        selectedRole: role,
        email
      });
      return;
    }

    const token = createSessionToken({
      userId: user.id,
      fullName: user.fullName,
      role: user.role
    });

    setSessionCookie(res, token);
    res.redirect(dashboardByRole[user.role]);
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.redirect("/login");
};
