import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated, slugify, uniqueSuffix } from "../../utils/http.js";

const router = Router();

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

function orderFor(sort: z.infer<typeof listQuery>["sort"]): Prisma.ProductOrderByWithRelationInput {
  if (sort === "price-asc") return { priceCents: "asc" };
  if (sort === "price-desc") return { priceCents: "desc" };
  if (sort === "name") return { name: "asc" };
  return { createdAt: "desc" };
}

function searchWhere(search?: string): Prisma.ProductWhereInput {
  return search
    ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
    : {};
}

router.get("/", validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.ProductWhereInput = { isActive: true, ...searchWhere(q.search) };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy: orderFor(q.sort), ...paginate(q.page, q.limit) }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

router.get("/manage/list", authenticate, authorize("ADMIN"), validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where = searchWhere(q.search);
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, orderBy: orderFor(q.sort), ...paginate(q.page, q.limit) }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

router.get("/:idOrSlug", async (req, res) => {
  const key = String(req.params.idOrSlug);
  const product = await prisma.product.findFirst({ where: { OR: [{ id: key }, { slug: key }], isActive: true } });
  if (!product) throw ApiError.notFound("Product not found");
  res.json({ product });
});

const productBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000),
  priceCents: z.coerce.number().int().min(1, "Price must be greater than 0").max(100_000_000),
  image: z.string().trim().min(1, "Product image is required").max(500),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  isActive: z.boolean().default(true),
});

const idParams = z.object({ id: z.string().min(1) });

router.post("/", authenticate, authorize("ADMIN"), validate({ body: productBody }), async (_req, res) => {
  const data = res.locals.body as z.infer<typeof productBody>;
  const product = await prisma.product.create({ data: { ...data, slug: `${slugify(data.name)}-${uniqueSuffix()}` } });
  res.status(201).json({ product });
});

router.patch("/:id", authenticate, authorize("ADMIN"), validate({ params: idParams, body: productBody }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const data = res.locals.body as z.infer<typeof productBody>;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Product not found");
  const product = await prisma.product.update({
    where: { id },
    data: { ...data, slug: data.name !== existing.name ? `${slugify(data.name)}-${uniqueSuffix()}` : existing.slug },
  });
  res.json({ product });
});

router.delete("/:id", authenticate, authorize("ADMIN"), validate({ params: idParams }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  // Order items keep a snapshot (name/price/image), so history is preserved.
  await prisma.product.delete({ where: { id } });
  res.json({ message: "Product deleted" });
});

export default router;
