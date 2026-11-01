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
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase()),
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
      error: "Kullanıcı adı veya parola biçimini kontrol edin.",
      selectedRole: req.body?.role ?? "",
      username: req.body?.username ?? ""
    });
    return;
  }

  try {
    const { role, username, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { username } });

    let passwordIsValid = false;

    if (user && user.isActive && user.role === role) {
      passwordIsValid = await argon2.verify(user.passwordHash, password);
    }

    if (!user || !user.isActive || user.role !== role || !passwordIsValid) {
      res.status(401).render("auth/login", {
        error: "Giriş bilgileri hatalı. Rolünüzü, kullanıcı adınızı ve parolanızı kontrol edin.",
        selectedRole: role,
        username
      });
      return;
    }

    const token = createSessionToken({
      userId: user.id,
      username: user.username,
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
