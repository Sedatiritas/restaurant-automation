import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";

export type AppRole = "ADMIN" | "WAITER" | "CASHIER";

export interface AuthSession {
  userId: string;
  fullName: string;
  role: AppRole;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = "qr_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32 || secret.includes("CHANGE_THIS")) {
    throw new Error("SESSION_SECRET .env dosyasında en az 32 karakterli, rastgele bir değer olmalı.");
  }

  return secret;
}

export function createSessionToken(
  user: Omit<AuthSession, "expiresAt">
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
    })
  ).toString("base64url");

  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function readSessionToken(token: string): AuthSession | null {
  try {
    const [payload, signature] = token.split(".");

    if (!payload || !signature) {
      return null;
    }

    const expectedSignature = createHmac("sha256", getSessionSecret())
      .update(payload)
      .digest();

    const receivedSignature = Buffer.from(signature, "base64url");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AuthSession;

    const validRoles: AppRole[] = ["ADMIN", "WAITER", "CASHIER"];

    if (
      typeof session.userId !== "string" ||
      typeof session.fullName !== "string" ||
      !validRoles.includes(session.role) ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function readSessionFromCookieHeader(
  cookieHeader?: string
): AuthSession | null {
  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  const token = cookie.slice(SESSION_COOKIE_NAME.length + 1);
  return readSessionToken(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS * 1000
};

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions);
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
  });
}
