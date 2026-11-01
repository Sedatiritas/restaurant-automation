import { z } from "zod";
import type { RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const tableIdSchema = z.string().uuid();
const tableNameSchema = z.string().trim().min(1).max(60);
const seatsSchema = z.number().int().min(1).max(100);
const createTableSchema = z.object({ name: tableNameSchema, seats: seatsSchema });
const updateTableSchema = z.object({
  name: tableNameSchema.optional(),
  seats: seatsSchema.optional()
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "En az bir alan güncellenmelidir."
});

const tableSelect = {
  id: true,
  name: true,
  seats: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
} as const;

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message });
}

function sendTableServerError(res: Parameters<RequestHandler>[1], error: unknown): void {
  console.error("Masa yönetimi sırasında hata oluştu:", error);

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    sendError(res, 503, "Masa tablosu veritabanında bulunamadı. Veritabanı migration işlemi uygulanmamış görünüyor.");
    return;
  }

  sendError(res, 500, "Masa işlemi veritabanında tamamlanamadı. Sunucu terminalindeki hata kaydını kontrol edin.");
}

async function hasDuplicateName(name: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.diningTable.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });
  return Boolean(existing);
}

export const getTables: RequestHandler = async (_req, res, next) => {
  try {
    const tables = await prisma.diningTable.findMany({
      select: tableSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    // Sipariş/adisyon tabloları eklenene kadar tüm masalar boştur.
    // Adisyon altyapısı geldiğinde bu alan açık adisyon sorgusundan beslenecek.
    const tablesWithBillStatus = tables.map((table) => ({
      ...table,
      billStatus: "EMPTY"
    }));

    res.setHeader("Cache-Control", "no-store");
    res.json({ tables: tablesWithBillStatus });
  } catch (error) {
    sendTableServerError(res, error);
  }
};

export const createTable: RequestHandler = async (req, res, next) => {
  const parsed = createTableSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Masa adı ve kişi kapasitesini kontrol edin.");
    return;
  }

  try {
    if (await hasDuplicateName(parsed.data.name)) {
      sendError(res, 409, "Bu isimde bir masa zaten kayıtlı.");
      return;
    }

    const latest = await prisma.diningTable.aggregate({ _max: { sortOrder: true } });
    const table = await prisma.diningTable.create({
      data: {
        name: parsed.data.name,
        seats: parsed.data.seats,
        sortOrder: (latest._max.sortOrder ?? -1) + 1
      },
      select: tableSelect
    });
    res.status(201).json({ table });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu isimde bir masa zaten kayıtlı.");
      return;
    }
    sendTableServerError(res, error);
  }
};

export const updateTable: RequestHandler = async (req, res, next) => {
  const id = tableIdSchema.safeParse(req.params.id);
  const parsed = updateTableSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    sendError(res, 400, "Masa bilgileri geçersiz.");
    return;
  }

  try {
    if (parsed.data.name && await hasDuplicateName(parsed.data.name, id.data)) {
      sendError(res, 409, "Bu isimde bir masa zaten kayıtlı.");
      return;
    }

    const data: Prisma.DiningTableUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.seats !== undefined) data.seats = parsed.data.seats;

    const table = await prisma.diningTable.update({
      where: { id: id.data },
      data,
      select: tableSelect
    });
    res.json({ table });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu isimde bir masa zaten kayıtlı.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Masa bulunamadı.");
      return;
    }
    sendTableServerError(res, error);
  }
};

export const deleteTable: RequestHandler = async (req, res, next) => {
  const id = tableIdSchema.safeParse(req.params.id);
  if (!id.success) {
    sendError(res, 400, "Masa kimliği geçersiz.");
    return;
  }

  try {
    const count = await prisma.diningTable.count();
    if (count <= 1) {
      sendError(res, 409, "En az bir masa kayıtlı kalmalıdır.");
      return;
    }

    await prisma.diningTable.delete({ where: { id: id.data } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Masa bulunamadı.");
      return;
    }
    sendTableServerError(res, error);
  }
};
