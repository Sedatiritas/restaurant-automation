import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import argon2 from "argon2";
import { z } from "zod";
import type { RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const categoryIdSchema = z.string().uuid();
const categoryNameSchema = z.string().trim().min(1).max(70);
const categoryDescriptionSchema = z.string().trim().max(300).optional().transform((value) => value === "" ? null : value);
const categoryIconSchema = z.string().trim().regex(/^bi-[a-z0-9-]{1,60}$/);

const createCategorySchema = z.object({
  name: categoryNameSchema,
  icon: categoryIconSchema.optional().default("bi-collection"),
  description: categoryDescriptionSchema
});

const updateCategorySchema = z.object({
  name: categoryNameSchema.optional(),
  icon: categoryIconSchema.optional(),
  description: categoryDescriptionSchema
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "En az bir alan güncellenmelidir."
});

const priceSchema = z.union([z.string().trim().min(1), z.number()])
  .transform((value) => Number(String(value).replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0 && value <= 99999999.99, {
    message: "Fiyat 0 ile 99.999.999,99 arasında olmalıdır."
  })
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, {
    message: "Fiyat en fazla iki ondalık basamak içerebilir."
  });

const productDescriptionSchema = z.string().trim().max(300).optional().transform((value) => value === "" ? null : value);
const imageDataSchema = z.string().max(1_400_000).optional();

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: productDescriptionSchema,
  price: priceSchema,
  categoryId: categoryIdSchema,
  status: z.enum(["active", "hidden", "out"]).default("active"),
  imageData: imageDataSchema
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: productDescriptionSchema,
  price: priceSchema.optional(),
  categoryId: categoryIdSchema.optional(),
  status: z.enum(["active", "hidden", "out"]).optional(),
  imageData: imageDataSchema,
  removeImage: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional()
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "En az bir alan güncellenmelidir."
});

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  description: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
} as const;

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      icon: true,
      description: true
    }
  }
} as const;

const statusToDatabase = {
  active: "ACTIVE",
  hidden: "HIDDEN",
  out: "OUT_OF_STOCK"
} as const;

const statusFromDatabase = {
  ACTIVE: "active",
  HIDDEN: "hidden",
  OUT_OF_STOCK: "out"
} as const;

class CatalogInputError extends Error {}

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string): void {
  res.status(status).json({ error: message });
}

function makeSlug(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function serializeProduct(product: {
  id: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  imageUrl: string | null;
  status: "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK";
  sortOrder: number;
  categoryId: string;
  category: { id: string; name: string; icon: string; description: string | null };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: product.price.toString(),
    image: product.imageUrl ?? "",
    status: statusFromDatabase[product.status],
    sortOrder: product.sortOrder,
    categoryId: product.categoryId,
    category: product.category.name,
    categoryName: product.category.name,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

const MAX_IMAGE_BYTES = 1024 * 1024;

async function saveProductImage(dataUrl: string): Promise<string> {
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);

  if (!match) {
    throw new CatalogInputError("Ürün görseli WebP, PNG veya JPEG biçiminde olmalıdır.");
  }

  const format = match[1];
  const bytes = Buffer.from(match[2], "base64");

  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new CatalogInputError("Ürün görseli en fazla 1 MB olmalıdır.");
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
    throw new CatalogInputError("Görsel dosyasının içeriği bildirilen biçimle eşleşmiyor.");
  }

  const extension = format === "jpeg" ? "jpg" : format;
  const filename = `${randomUUID()}.${extension}`;
  const directory = resolve(process.cwd(), "public", "uploads", "products");

  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, filename), bytes, { flag: "wx" });

  return `/uploads/products/${filename}`;
}

async function removeProductImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || !/^\/uploads\/products\/[0-9a-f-]{36}\.(?:webp|png|jpg)$/.test(imageUrl)) return;

  try {
    await unlink(resolve(process.cwd(), "public", imageUrl.slice(1)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[catalog] Product image cleanup failed.");
    }
  }
}

export const getCatalog: RequestHandler = async (_req, res, next) => {
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        select: categorySelect,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.product.findMany({
        include: productInclude,
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
      })
    ]);

    res.json({
      categories,
      products: products.map(serializeProduct)
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicMenu: RequestHandler = async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { products: { some: { status: { in: ["ACTIVE", "OUT_OF_STOCK"] } } } },
      select: {
        id: true,
        name: true,
        icon: true,
        sortOrder: true,
        products: {
          where: { status: { in: ["ACTIVE", "OUT_OF_STOCK"] } },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            categoryId: true,
            status: true
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const menuCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon
    }));

    const products = categories.flatMap((category) =>
      category.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: product.price.toString(),
        image: product.imageUrl ?? "",
        categoryId: product.categoryId,
        categoryName: category.name,
        isOutOfStock: product.status === "OUT_OF_STOCK"
      }))
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({ categories: menuCategories, products });
  } catch (error) {
    next(error);
  }
};

export const createCategory: RequestHandler = async (req, res, next) => {
  const parsed = createCategorySchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, "Kategori adı, ikonu veya açıklamasını kontrol edin.");
    return;
  }

  const slug = makeSlug(parsed.data.name);
  if (!slug) {
    sendError(res, 400, "Kategori adı geçerli bir URL adına dönüştürülemedi.");
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug,
        icon: parsed.data.icon,
        description: parsed.data.description ?? null
      },
      select: categorySelect
    });

    if (req.is("application/x-www-form-urlencoded")) { res.redirect(303, "/admin#categories"); return; }
    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu kategori adı zaten kullanımda.");
      return;
    }
    next(error);
  }
};

export const updateCategory: RequestHandler = async (req, res, next) => {
  const id = categoryIdSchema.safeParse(req.params.id);
  const parsed = updateCategorySchema.safeParse(req.body);

  if (!id.success || !parsed.success) {
    sendError(res, 400, "Kategori bilgileri geçersiz.");
    return;
  }

  const data: Prisma.CategoryUpdateInput = {};
  if (parsed.data.name !== undefined) {
    const slug = makeSlug(parsed.data.name);
    if (!slug) {
      sendError(res, 400, "Kategori adı geçerli bir URL adına dönüştürülemedi.");
      return;
    }
    data.name = parsed.data.name;
    data.slug = slug;
  }
  if (parsed.data.icon !== undefined) data.icon = parsed.data.icon;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  try {
    const category = await prisma.category.update({
      where: { id: id.data },
      data,
      select: categorySelect
    });
    if (req.is("application/x-www-form-urlencoded")) { res.redirect(303, "/admin#categories"); return; }
    res.json({ category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      sendError(res, 409, "Bu kategori adı zaten kullanımda.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Kategori bulunamadı.");
      return;
    }
    next(error);
  }
};

export const deleteCategory: RequestHandler = async (req, res, next) => {
  const id = categoryIdSchema.safeParse(req.params.id);

  if (!id.success) {
    sendError(res, 400, "Kategori kimliği geçersiz.");
    return;
  }

  try {
    const productCount = await prisma.product.count({ where: { categoryId: id.data } });
    if (productCount > 0) {
      sendError(res, 409, "Bu kategoride ürün bulunuyor. Önce ürünleri başka kategoriye taşıyın veya silin.");
      return;
    }

    await prisma.category.delete({ where: { id: id.data } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Kategori bulunamadı.");
      return;
    }
    next(error);
  }
};

export const createProduct: RequestHandler = async (req, res, next) => {
  const parsed = createProductSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 400, "Ürün adı, fiyat, kategori veya yayın durumunu kontrol edin.");
    return;
  }

  let imageUrl: string | null = null;

  try {
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) {
      sendError(res, 400, "Seçilen kategori bulunamadı.");
      return;
    }

    if (parsed.data.imageData) imageUrl = await saveProductImage(parsed.data.imageData);

    const product = await prisma.product.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        status: statusToDatabase[parsed.data.status],
        categoryId: parsed.data.categoryId,
        imageUrl
      },
      include: productInclude
    });

    if (req.is("application/x-www-form-urlencoded")) { res.redirect(303, "/admin#products"); return; }
    res.status(201).json({ product: serializeProduct(product) });
  } catch (error) {
    await removeProductImage(imageUrl);
    if (error instanceof CatalogInputError) {
      sendError(res, 400, error.message);
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      sendError(res, 400, "Seçilen kategori artık kullanılamıyor.");
      return;
    }
    next(error);
  }
};

export const updateProduct: RequestHandler = async (req, res, next) => {
  const id = categoryIdSchema.safeParse(req.params.id);
  const parsed = updateProductSchema.safeParse(req.body);

  if (!id.success || !parsed.success) {
    sendError(res, 400, "Ürün bilgileri geçersiz.");
    return;
  }

  let newImageUrl: string | null = null;

  try {
    const existing = await prisma.product.findUnique({
      where: { id: id.data },
      select: { id: true, imageUrl: true }
    });

    if (!existing) {
      sendError(res, 404, "Ürün bulunamadı.");
      return;
    }

    if (parsed.data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
      if (!category) {
        sendError(res, 400, "Seçilen kategori bulunamadı.");
        return;
      }
    }

    if (parsed.data.imageData) newImageUrl = await saveProductImage(parsed.data.imageData);

    const data: Prisma.ProductUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.price !== undefined) data.price = parsed.data.price;
    if (parsed.data.status !== undefined) data.status = statusToDatabase[parsed.data.status];
    if (parsed.data.categoryId !== undefined) data.category = { connect: { id: parsed.data.categoryId } };
    if (newImageUrl) data.imageUrl = newImageUrl;
    else if (parsed.data.removeImage) data.imageUrl = null;

    const product = await prisma.product.update({
      where: { id: id.data },
      data,
      include: productInclude
    });

    if (newImageUrl || parsed.data.removeImage) {
      await removeProductImage(existing.imageUrl);
    }

    if (req.is("application/x-www-form-urlencoded")) { res.redirect(303, "/admin#products"); return; }
    res.json({ product: serializeProduct(product) });
  } catch (error) {
    await removeProductImage(newImageUrl);
    if (error instanceof CatalogInputError) {
      sendError(res, 400, error.message);
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      sendError(res, 404, "Ürün veya kategori bulunamadı.");
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      sendError(res, 400, "Seçilen kategori artık kullanılamıyor.");
      return;
    }
    next(error);
  }
};

export const deleteProduct: RequestHandler = async (req, res, next) => {
  const id = categoryIdSchema.safeParse(req.params.id);

  if (!id.success) {
    sendError(res, 400, "Ürün kimliği geçersiz.");
    return;
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id: id.data },
      select: { id: true, imageUrl: true }
    });

    if (!existing) {
      sendError(res, 404, "Ürün bulunamadı.");
      return;
    }

    await prisma.product.delete({ where: { id: existing.id } });
    await removeProductImage(existing.imageUrl);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
