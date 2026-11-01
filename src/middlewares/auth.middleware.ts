import type { RequestHandler } from "express";
import {
  clearSessionCookie,
  readSessionFromCookieHeader,
  type AppRole
} from "../lib/session.js";
import { prisma } from "../lib/prisma.js";

export function requireRole(...allowedRoles: AppRole[]): RequestHandler {
  return async (req, res, next) => {
    const session = readSessionFromCookieHeader(req.headers.cookie);

    if (!session) {
      clearSessionCookie(res);
      res.redirect("/login");
      return;
    }

    try {
      // Re-check the account on every protected request so disabled users or changed
      // roles lose access without waiting for the signed cookie to expire.
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, username: true, role: true, isActive: true }
      });

      if (!user || !user.isActive || user.role !== session.role) {
        clearSessionCookie(res);
        res.redirect("/login");
        return;
      }

      // Administrators can open all three work areas.
      if (user.role !== "ADMIN" && !allowedRoles.includes(user.role)) {
        res.status(403).send("Bu ekrana erişim yetkiniz bulunmuyor.");
        return;
      }

      res.locals.authUser = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
