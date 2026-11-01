import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

const DEFAULT_COVER_URL = "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80";
const MAX_IMAGE_BYTES = 1024 * 1024;

const appearanceSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(100),
  eyebrow: z.string().trim().max(80),
  headline: z.string().trim().max(140),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isOpen: z.boolean(),
  googleReviewUrl: z.string().trim().max(1000),
  logoUrl: z.string().trim().max(2000).optional(),
  coverUrl: z.string().trim().max(2000).optional(),
  logoImageData: z.string().max(1_400_000).optional(),
  coverImageData: z.string().max(1_400_000).optional(),
  removeLogo: z.boolean().optional(),
  removeCover: z.boolean().optional()
});

class AppearanceInputError extends Error {}

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message });
}

function serializeAppearance(appearance: {
  brandName: string;
  tagline: string;
  eyebrow: string;
  headline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accent: string;
  isOpen: boolean;
  googleReviewUrl: string | null;
}) {
  return {
    brandName: appearance.brandName,
    tagline: appearance.tagline,
    eyebrow: appearance.eyebrow,
    headline: appearance.headline,
    logo: appearance.logoUrl ?? "",
    cover: appearance.coverUrl ?? "",
    accent: appearance.accent,
    isOpen: appearance.isOpen,
    googleReviewUrl: appearance.googleReviewUrl ?? ""
  };
}

function normalizeImageUrl(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;

  if (/^\/uploads\/appearance\/[0-9a-f-]{36}\.(?:webp|png|jpg)$/i.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return parsed.href;
  } catch {
    // Return a validation error below.
  }

  throw new AppearanceInputError("Logo veya kapak görseli adresi geçersiz.");
}

async function saveAppearanceImage(dataUrl: string): Promise<string> {
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new AppearanceInputError("Görseller WebP, PNG veya JPEG biçiminde olmalıdır.");
  }

  const format = match[1]!;
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new AppearanceInputError("Logo ve kapak görselleri en fazla 1 MB olmalıdır.");
  }

  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";

  if (
    (format === "png" && !isPng) ||
    (format === "jpeg" && !isJpeg) ||
    (format === "webp" && !isWebp)
  ) {
    throw new AppearanceInputError("Görsel dosyasının içeriği bildirilen biçimle eşleşmiyor.");
  }

  const extension = format === "jpeg" ? "jpg" : format;
  const filename = `${randomUUID()}.${extension}`;
  const directory = resolve(process.cwd(), "public", "uploads", "appearance");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, filename), bytes, { flag: "wx" });
  return `/uploads/appearance/${filename}`;
}

async function removeAppearanceImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || !/^\/uploads\/appearance\/[0-9a-f-]{36}\.(?:webp|png|jpg)$/i.test(imageUrl)) return;

  try {
    await unlink(resolve(process.cwd(), "public", imageUrl.slice(1)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[appearance] Image cleanup failed.");
    }
  }
}

export const getMenuAppearance: RequestHandler = async (_req, res, next) => {
  try {
    const appearance = await prisma.menuAppearance.findUnique({ where: { id: "default" } });
    res.setHeader("Cache-Control", "no-store");
    res.json({ appearance: appearance ? serializeAppearance(appearance) : null });
  } catch (error) {
    next(error);
  }
};

export const saveMenuAppearance: RequestHandler = async (req, res, next) => {
  const parsed = appearanceSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Menü görünümü bilgilerini kontrol edin.");
    return;
  }

  let newLogoUrl: string | null = null;
  let newCoverUrl: string | null = null;

  try {
    const existing = await prisma.menuAppearance.findUnique({ where: { id: "default" } });

    if (parsed.data.logoImageData) {
      newLogoUrl = await saveAppearanceImage(parsed.data.logoImageData);
    }
    if (parsed.data.coverImageData) {
      newCoverUrl = await saveAppearanceImage(parsed.data.coverImageData);
    }

    const providedLogoUrl = normalizeImageUrl(parsed.data.logoUrl);
    const providedCoverUrl = normalizeImageUrl(parsed.data.coverUrl);

    const logoUrl = parsed.data.removeLogo
      ? null
      : newLogoUrl ?? providedLogoUrl ?? existing?.logoUrl ?? null;

    const coverUrl = parsed.data.removeCover
      ? null
      : newCoverUrl ?? providedCoverUrl ?? existing?.coverUrl ?? DEFAULT_COVER_URL;

    const saved = await prisma.menuAppearance.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        brandName: parsed.data.brandName,
        tagline: parsed.data.tagline,
        eyebrow: parsed.data.eyebrow,
        headline: parsed.data.headline,
        logoUrl,
        coverUrl,
        accent: parsed.data.accent,
        isOpen: parsed.data.isOpen,
        googleReviewUrl: parsed.data.googleReviewUrl || null
      },
      update: {
        brandName: parsed.data.brandName,
        tagline: parsed.data.tagline,
        eyebrow: parsed.data.eyebrow,
        headline: parsed.data.headline,
        logoUrl,
        coverUrl,
        accent: parsed.data.accent,
        isOpen: parsed.data.isOpen,
        googleReviewUrl: parsed.data.googleReviewUrl || null
      }
    });

    if (newLogoUrl || parsed.data.removeLogo) {
      await removeAppearanceImage(existing?.logoUrl);
    }
    if (newCoverUrl || parsed.data.removeCover) {
      await removeAppearanceImage(existing?.coverUrl);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ appearance: serializeAppearance(saved) });
  } catch (error) {
    await Promise.all([removeAppearanceImage(newLogoUrl), removeAppearanceImage(newCoverUrl)]);
    if (error instanceof AppearanceInputError) {
      sendError(res, 400, error.message);
      return;
    }
    next(error);
  }
};
