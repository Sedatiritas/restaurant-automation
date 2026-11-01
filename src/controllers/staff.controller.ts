import argon2 from "argon2";
import { z } from "zod";
import type { RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const roleSchema = z.enum(["ADMIN", "WAITER", "CASHIER"]);
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/)
  .transform((value) => value.toLowerCase());

const createStaffSchema = z.object({
  username: usernameSchema,
  role: roleSchema,
  password: z.string().min(12).max(128)
});

const updateStaffSchema = z.object({
  username: usernameSchema.optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: z.union([z.literal(""), z.string().min(12).max(128)]).optional().transform((value) => value === "" ? undefined : value)
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "En az bir alan güncellenmelidir."
});

const publicUserSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} as const;

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message });
}

async function hasAnotherActiveAdmin(excludeId: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: { not: excludeId }
    }
  });

  return count > 0;
}

export const listStaff: RequestHandler = async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: [{ role: "asc" }, { username: "asc" }]
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
};

export const createStaff: RequestHandler = async (req, res, next) => {
  const parsed = createStaffSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, "Kullanıcı adı, rol veya parola bilgilerini kontrol edin. Parola en az 12 karakter olmalı.");
    return;
  }

  try {
    const passwordHash = await argon2.hash(parsed.data.password, {
      type: argon2.argon2id
    });

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        role: parsed.data.role,
        passwordHash
      },
      select: publicUserSelect
    });

    // Safe native-form fallback: never allow password fields to be submitted in a GET URL.
    if (req.is("application/x-www-form-urlencoded")) {
      res.redirect(303, "/admin#staff");
      return;
    }

    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu kullanıcı adı zaten kullanımda.");
      return;
    }

    next(error);
  }
};

export const updateStaff: RequestHandler = async (req, res, next) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const parsed = updateStaffSchema.safeParse(req.body);
  const currentUser = res.locals.authUser as { userId: string; role: string } | undefined;

  if (!id.success || !parsed.success) {
    sendError(res, 400, "Personel bilgileri geçersiz.");
    return;
  }

  const targetId = id.data;
  const changes = parsed.data;

  if (targetId === currentUser?.userId && (changes.role !== undefined || changes.isActive === false)) {
    sendError(res, 400, "Kendi yönetici rolünüzü veya hesabınızın durumunu buradan değiştiremezsiniz.");
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: targetId } });

    if (!existing) {
      sendError(res, 404, "Personel hesabı bulunamadı.");
      return;
    }

    const willNoLongerBeActiveAdmin =
      existing.role === "ADMIN" &&
      existing.isActive &&
      ((changes.role !== undefined && changes.role !== "ADMIN") || changes.isActive === false);

    if (willNoLongerBeActiveAdmin && !(await hasAnotherActiveAdmin(targetId))) {
      sendError(res, 400, "Sistemde en az bir aktif yönetici hesabı bulunmalıdır.");
      return;
    }

    const data: {
      username?: string;
      role?: "ADMIN" | "WAITER" | "CASHIER";
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (changes.username !== undefined) data.username = changes.username;
    if (changes.role !== undefined) data.role = changes.role;
    if (changes.isActive !== undefined) data.isActive = changes.isActive;
    if (changes.password !== undefined) {
      data.passwordHash = await argon2.hash(changes.password, {
        type: argon2.argon2id
      });
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data,
      select: publicUserSelect
    });

    if (req.is("application/x-www-form-urlencoded")) {
      res.redirect(303, "/admin#staff");
      return;
    }

    res.json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu kullanıcı adı başka bir hesap tarafından kullanılıyor.");
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Personel hesabı bulunamadı.");
      return;
    }

    next(error);
  }
};

export const deleteStaff: RequestHandler = async (req, res, next) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const currentUser = res.locals.authUser as { userId: string } | undefined;

  if (!id.success) {
    sendError(res, 400, "Personel kimliği geçersiz.");
    return;
  }

  if (id.data === currentUser?.userId) {
    sendError(res, 400, "Kendi hesabınızı buradan silemezsiniz.");
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: id.data } });

    if (!existing) {
      sendError(res, 404, "Personel hesabı bulunamadı.");
      return;
    }

    if (
      existing.role === "ADMIN" &&
      existing.isActive &&
      !(await hasAnotherActiveAdmin(existing.id))
    ) {
      sendError(res, 400, "Sistemde en az bir aktif yönetici hesabı bulunmalıdır.");
      return;
    }

    await prisma.user.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
