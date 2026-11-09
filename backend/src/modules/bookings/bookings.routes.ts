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

const eventSummary = {
  select: { id: true, slug: true, title: true, image: true, startsAt: true, venue: true, city: true, organizerId: true },
} as const;
const userSummary = { select: { id: true, firstName: true, lastName: true, email: true } } as const;

const idParams = z.object({ id: z.string().min(1) });
const statusEnum = z.enum(["PENDING", "PAID", "FAILED", "CANCELLED"]);

const createSchema = z.object({
  eventId: z.string().min(1),
  tier: z.enum(["STANDARD", "VIP"]),
  quantity: z.coerce.number().int().min(1, "At least 1 ticket").max(10, "Maximum 10 tickets per booking"),
});

router.post("/", validate({ body: createSchema }), async (req, res) => {
  const { eventId, tier, quantity } = res.locals.body as z.infer<typeof createSchema>;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");
  if (event.startsAt < new Date()) throw ApiError.badRequest("This event has already started");
  const seatsLeft = event.totalSeats - event.seatsSold;
  if (seatsLeft < quantity) {
    throw ApiError.conflict(seatsLeft === 0 ? "This event is sold out" : `Only ${seatsLeft} seat(s) left`);
  }

  const unitPriceCents = tier === "VIP" ? event.vipPriceCents : event.standardPriceCents;
  const booking = await prisma.booking.create({
    data: {
      code: referenceCode("TKT"),
      userId: currentUser(req).id,
      eventId,
      tier,
      quantity,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
    },
    include: { event: eventSummary },
  });
  res.status(201).json({ booking });
});

/**
 * Demo payment gateway. In production replace the body of this handler with a
 * real gateway callback (SSLCommerz / Stripe) — the seat reservation logic
 * below stays the same.
 */
const paySchema = z.object({ outcome: z.enum(["success", "fail"]).default("success") });

router.post("/:id/pay", validate({ params: idParams, body: paySchema }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const { outcome } = res.locals.body as z.infer<typeof paySchema>;
  const me = currentUser(req);

  const booking = await prisma.booking.findUnique({ where: { id }, include: { event: true } });
  if (!booking || booking.userId !== me.id) throw ApiError.notFound("Booking not found");
  if (booking.status === "PAID") throw ApiError.conflict("This booking is already paid");
  if (booking.status === "CANCELLED") throw ApiError.conflict("This booking was cancelled");
  if (booking.event.startsAt < new Date()) throw ApiError.badRequest("This event has already started");

  if (outcome === "fail") {
    const failed = await prisma.booking.update({ where: { id }, data: { status: "FAILED" }, include: { event: eventSummary } });
    return void res.status(402).json({ message: "Payment was declined. No money was charged.", booking: failed });
  }

  const paid = await prisma.$transaction(async (tx) => {
    // Atomic seat reservation: succeeds only if enough seats remain.
    const reserved = await tx.event.updateMany({
      where: { id: booking.eventId, seatsSold: { lte: booking.event.totalSeats - booking.quantity } },
      data: { seatsSold: { increment: booking.quantity } },
    });
    if (reserved.count === 0) throw ApiError.conflict("Sorry, there are not enough seats left for this booking");

    const updated = await tx.booking.updateMany({
      where: { id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: new Date(), transactionId: `DEMO-${randomUUID()}` },
    });
    if (updated.count === 0) throw ApiError.conflict("This booking was already processed");
    return tx.booking.findUniqueOrThrow({ where: { id }, include: { event: eventSummary } });
  });

  res.json({ message: "Payment successful", booking: paid });
});

router.post("/:id/cancel", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.userId !== currentUser(req).id) throw ApiError.notFound("Booking not found");
  if (booking.status === "PAID") throw ApiError.badRequest("Paid tickets cannot be cancelled online. Please contact support.");
  const updated = await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" }, include: { event: eventSummary } });
  res.json({ booking: updated });
});

const listQuery = z.object({
  status: statusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/me", validate({ query: listQuery }), async (req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.BookingWhereInput = { userId: currentUser(req).id, ...(q.status ? { status: q.status } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({ where, include: { event: eventSummary }, orderBy: { createdAt: "desc" }, ...paginate(q.page, q.limit) }),
    prisma.booking.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

const manageQuery = listQuery.extend({
  search: z.string().trim().max(100).optional(),
  eventId: z.string().optional(),
});

router.get("/", authorize("ORGANIZER", "ADMIN"), validate({ query: manageQuery }), async (req, res) => {
  const q = res.locals.query as z.infer<typeof manageQuery>;
  const me = currentUser(req);
  const where: Prisma.BookingWhereInput = {
    ...(me.role === "ADMIN" ? {} : { event: { organizerId: me.id } }),
    ...(q.status ? { status: q.status } : {}),
    ...(q.eventId ? { eventId: q.eventId } : {}),
    ...(q.search
      ? {
          OR: [
            { code: { contains: q.search, mode: "insensitive" } },
            { user: { email: { contains: q.search, mode: "insensitive" } } },
            { event: { title: { contains: q.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total, revenue] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: { event: eventSummary, user: userSummary },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.limit),
    }),
    prisma.booking.count({ where }),
    prisma.booking.aggregate({ where: { ...where, status: "PAID" }, _sum: { totalCents: true, quantity: true } }),
  ]);
  res.json({
    ...paginated(items, total, q.page, q.limit),
    summary: { revenueCents: revenue._sum.totalCents ?? 0, ticketsSold: revenue._sum.quantity ?? 0 },
  });
});

router.get("/:id", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const me = currentUser(req);
  const booking = await prisma.booking.findUnique({ where: { id }, include: { event: eventSummary, user: userSummary } });
  const allowed = booking && (booking.userId === me.id || me.role === "ADMIN" || booking.event.organizerId === me.id);
  if (!allowed) throw ApiError.notFound("Booking not found");
  res.json({ booking });
});

export default router;
