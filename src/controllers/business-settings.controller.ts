import { z } from "zod";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

const DEFAULT_SETTINGS = {
  phone: "",
  email: "",
  address: "",
  description: "Kahve, tatlı ve güzel anlar.",
  instagram: "",
  whatsapp: ""
};

const optionalEmailSchema = z.string().trim().max(254).refine(
  (value) => value === "" || z.email().safeParse(value).success,
  "Geçerli bir e-posta adresi girin."
).transform((value) => value || null);

function optionalWebUrlSchema(fieldName: string) {
  return z.string().trim().max(1000).refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, `${fieldName} http:// veya https:// ile başlamalıdır.`).transform((value) => value || null);
}

const businessSettingsSchema = z.object({
  phone: z.string().trim().max(40),
  email: optionalEmailSchema,
  address: z.string().trim().max(500).transform((value) => value || null),
  description: z.string().trim().max(250),
  instagram: optionalWebUrlSchema("Instagram bağlantısı"),
  whatsapp: optionalWebUrlSchema("WhatsApp bağlantısı")
});

function serializeSettings(settings: {
  phone: string;
  email: string | null;
  address: string | null;
  description: string;
  instagram: string | null;
  whatsapp: string | null;
}) {
  return {
    phone: settings.phone,
    email: settings.email ?? "",
    address: settings.address ?? "",
    description: settings.description,
    instagram: settings.instagram ?? "",
    whatsapp: settings.whatsapp ?? ""
  };
}

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message });
}

export const getBusinessSettings: RequestHandler = async (_req, res, next) => {
  try {
    const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    res.setHeader("Cache-Control", "no-store");
    res.json({ settings: settings ? serializeSettings(settings) : null });
  } catch (error) {
    next(error);
  }
};

export const saveBusinessSettings: RequestHandler = async (req, res, next) => {
  const parsed = businessSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    sendError(res, 400, firstIssue?.message || "İşletme ayarlarını kontrol edin.");
    return;
  }

  try {
    const settings = await prisma.businessSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...parsed.data },
      update: parsed.data
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({ settings: serializeSettings(settings) });
  } catch (error) {
    next(error);
  }
};

export { DEFAULT_SETTINGS };
