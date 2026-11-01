import type { RequestHandler } from "express";
import {
  readSessionFromCookieHeader,
  type AppRole
} from "../lib/session.js";

export function requireRole(...allowedRoles: AppRole[]): RequestHandler {
  return (req, res, next) => {
    const session = readSessionFromCookieHeader(req.headers.cookie);

    if (!session) {
      res.redirect("/login");
      return;
    }

    // Administrators can open all three work areas.
    if (session.role !== "ADMIN" && !allowedRoles.includes(session.role)) {
      res.status(403).send("Bu ekrana erişim yetkiniz bulunmuyor.");
      return;
    }

    res.locals.authUser = session;
    next();
  };
}
