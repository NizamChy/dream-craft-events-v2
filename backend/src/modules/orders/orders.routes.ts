import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated, referenceCode } from "../../utils/http.js";

const router = Router();
router.use(authenticate);

const idParams = z.object({ id: z.string().min(1) });
const orderStatus = z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]);
const userSummary = { select: { id: true, firstName: true, lastName: true, email: true } } as const;

const createSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(50) }))
    .min(1, "Your cart is empty")
    .max(50),
  shippingAddress: z.string().trim().min(5, "Enter your full delivery address").max(300),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(30)
    .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
});

router.post("/", validate({ body: createSchema }), async (req, res) => {
  const data = res.locals.body as z.infer<typeof createSchema>;

  // Merge duplicate lines.
  const qty = new Map<string, number>();
  for (const item of data.items) qty.set(item.productId, (qty.get(item.productId) ?? 0) + item.quantity);

  const products = await prisma.product.findMany({ where: { id: { in: [...qty.keys()] }, isActive: true } });
  if (products.length !== qty.size) throw ApiError.badRequest("Some products in your cart are no longer available. Please refresh your cart.");

  for (const p of products) {
    const wanted = qty.get(p.id)!;
    if (p.stock < wanted) throw ApiError.conflict(p.stock === 0 ? `${p.name} is out of stock` : `Only ${p.stock} × ${p.name} left in stock`);
  }

  // Prices always come from the database, never from the client.
  const items = products.map((p) => ({ productId: p.id, name: p.name, image: p.image, priceCents: p.priceCents, quantity: qty.get(p.id)! }));
  const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      code: referenceCode("ORD"),
      userId: currentUser(req).id,
      totalCents,
      shippingAddress: data.shippingAddress,
      phone: data.phone,
      items: { create: items },
    },
    include: { items: true },
  });
  res.status(201).json({ order });
});

const paySchema = z.object({ outcome: z.enum(["success", "fail"]).default("success") });

router.post("/:id/pay", validate({ params: idParams, body: paySchema }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const { outcome } = res.locals.body as z.infer<typeof paySchema>;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.userId !== currentUser(req).id) throw ApiError.notFound("Order not found");
  if (order.paymentStatus === "PAID") throw ApiError.conflict("This order is already paid");
  if (order.status === "CANCELLED") throw ApiError.conflict("This order was cancelled");

  if (outcome === "fail") {
    const failed = await prisma.order.update({ where: { id }, data: { paymentStatus: "FAILED" }, include: { items: true } });
    return void res.status(402).json({ message: "Payment was declined. No money was charged.", order: failed });
  }

  const paid = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.productId) throw ApiError.conflict(`${item.name} is no longer available`);
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) throw ApiError.conflict(`Not enough stock left for ${item.name}`);
    }
    const marked = await tx.order.updateMany({
      where: { id, paymentStatus: { in: ["PENDING", "FAILED"] } },
      data: { paymentStatus: "PAID", status: "PROCESSING", paidAt: new Date(), transactionId: `DEMO-${randomUUID()}` },
    });
    if (marked.count === 0) throw ApiError.conflict("This order was already processed");
    return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  });
  res.json({ message: "Payment successful", order: paid });
});

router.post("/:id/cancel", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== currentUser(req).id) throw ApiError.notFound("Order not found");
  if (order.paymentStatus === "PAID") throw ApiError.badRequest("Paid orders cannot be cancelled online. Please contact support.");
  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
    include: { items: true },
  });
  res.json({ order: updated });
});

const listQuery = z.object({
  status: orderStatus.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/me", validate({ query: listQuery }), async (req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.OrderWhereInput = { userId: currentUser(req).id, ...(q.status ? { status: q.status } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, ...paginate(q.page, q.limit) }),
    prisma.order.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

router.get("/", authorize("ADMIN"), validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.OrderWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.search
      ? {
          OR: [
            { code: { contains: q.search, mode: "insensitive" } },
            { user: { email: { contains: q.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: { items: true, user: userSummary },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.limit),
    }),
    prisma.order.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

router.get("/:id", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const me = currentUser(req);
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: userSummary } });
  if (!order || (order.userId !== me.id && me.role !== "ADMIN")) throw ApiError.notFound("Order not found");
  res.json({ order });
});

/** Allowed fulfilment transitions. */
const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

router.patch(
  "/:id/status",
  authorize("ADMIN"),
  validate({ params: idParams, body: z.object({ status: orderStatus }) }),
  async (_req, res) => {
    const { id } = res.locals.params as { id: string };
    const { status } = res.locals.body as { status: z.infer<typeof orderStatus> };
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw ApiError.notFound("Order not found");
    if (!transitions[order.status]?.includes(status)) {
      throw ApiError.badRequest(`An order cannot move from ${order.status} to ${status}`);
    }
    if (status !== "CANCELLED" && order.paymentStatus !== "PAID") {
      throw ApiError.badRequest("Only paid orders can be fulfilled");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Cancelling a paid order puts the items back in stock.
      if (status === "CANCELLED" && order.paymentStatus === "PAID") {
        for (const item of order.items) {
          if (item.productId) {
            await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          }
        }
      }
      return tx.order.update({
        where: { id },
        data: { status, ...(status === "CANCELLED" && order.paymentStatus !== "PAID" ? { paymentStatus: "CANCELLED" } : {}) },
        include: { items: true, user: userSummary },
      });
    });
    res.json({ order: updated });
  },
);

export default router;
