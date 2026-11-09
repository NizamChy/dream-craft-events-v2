import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { EventCategory } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser, optionalAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated, slugify, uniqueSuffix } from "../../utils/http.js";

const router = Router();

const organizerSelect = { select: { id: true, firstName: true, lastName: true, avatar: true } } as const;

type EventWithOrganizer = Prisma.EventGetPayload<{ include: { organizer: typeof organizerSelect } }>;

function present(event: EventWithOrganizer) {
  return { ...event, seatsLeft: Math.max(0, event.totalSeats - event.seatsSold) };
}

const categoryEnum = z.enum(Object.values(EventCategory) as [EventCategory, ...EventCategory[]]);

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: categoryEnum.optional(),
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  featured: z.enum(["true", "false"]).optional(),
  sort: z.enum(["date", "newest", "price-asc", "price-desc"]).default("date"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
});

function orderFor(sort: z.infer<typeof listQuery>["sort"]): Prisma.EventOrderByWithRelationInput {
  switch (sort) {
    case "newest":
      return { createdAt: "desc" };
    case "price-asc":
      return { standardPriceCents: "asc" };
    case "price-desc":
      return { standardPriceCents: "desc" };
    default:
      return { startsAt: "asc" };
  }
}

function searchWhere(search?: string): Prisma.EventWhereInput {
  if (!search) return {};
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { venue: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ],
  };
}

// ---------- Public ----------

router.get("/", validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const now = new Date();
  const where: Prisma.EventWhereInput = {
    isPublished: true,
    ...(q.category ? { category: q.category } : {}),
    ...(q.featured ? { isFeatured: q.featured === "true" } : {}),
    ...(q.when === "upcoming" ? { startsAt: { gte: now } } : q.when === "past" ? { startsAt: { lt: now } } : {}),
    ...searchWhere(q.search),
  };
  const orderBy = q.when === "past" && q.sort === "date" ? { startsAt: "desc" as const } : orderFor(q.sort);
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({ where, include: { organizer: organizerSelect }, orderBy, ...paginate(q.page, q.limit) }),
    prisma.event.count({ where }),
  ]);
  res.json(paginated(items.map(present), total, q.page, q.limit));
});

router.get("/categories", async (_req, res) => {
  const groups = await prisma.event.groupBy({
    by: ["category"],
    where: { isPublished: true, startsAt: { gte: new Date() } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(groups.map((g) => [g.category, g._count._all]));
  res.json({ categories: Object.values(EventCategory).map((c) => ({ category: c, count: counts[c] ?? 0 })) });
});

// ---------- Organizer / Admin management ----------

const manageQuery = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get("/manage/list", authenticate, authorize("ORGANIZER", "ADMIN"), validate({ query: manageQuery }), async (req, res) => {
  const q = res.locals.query as z.infer<typeof manageQuery>;
  const me = currentUser(req);
  const where: Prisma.EventWhereInput = {
    ...(me.role === "ADMIN" ? {} : { organizerId: me.id }),
    ...searchWhere(q.search),
  };
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: { organizer: organizerSelect, _count: { select: { bookings: { where: { status: "PAID" } } } } },
      orderBy: { startsAt: "desc" },
      ...paginate(q.page, q.limit),
    }),
    prisma.event.count({ where }),
  ]);
  res.json(paginated(items.map(present), total, q.page, q.limit));
});

const eventBody = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
    summary: z.string().trim().min(10, "Summary must be at least 10 characters").max(200),
    description: z.string().trim().min(30, "Description must be at least 30 characters").max(5000),
    category: categoryEnum,
    venue: z.string().trim().min(2, "Venue is required").max(120),
    city: z.string().trim().min(2, "City is required").max(80),
    startsAt: z.coerce.date({ error: "Start date is required" }),
    endsAt: z.coerce.date().nullable().optional(),
    image: z.string().trim().min(1, "Event image is required").max(500),
    speakers: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    sponsors: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    totalSeats: z.coerce.number().int().min(1, "At least 1 seat").max(100000),
    standardPriceCents: z.coerce.number().int().min(0).max(100_000_000),
    vipPriceCents: z.coerce.number().int().min(0).max(100_000_000),
    isPublished: z.boolean().default(true),
    isFeatured: z.boolean().optional(),
  })
  .refine((d) => !d.endsAt || d.endsAt > d.startsAt, { message: "End time must be after start time", path: ["endsAt"] })
  .refine((d) => d.vipPriceCents >= d.standardPriceCents, {
    message: "VIP price should not be lower than the standard price",
    path: ["vipPriceCents"],
  });

const idParams = z.object({ id: z.string().min(1) });

async function loadOwnedEvent(id: string, me: ReturnType<typeof currentUser>) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw ApiError.notFound("Event not found");
  if (me.role !== "ADMIN" && event.organizerId !== me.id) throw ApiError.forbidden("You can only manage your own events");
  return event;
}

router.post("/", authenticate, authorize("ORGANIZER", "ADMIN"), validate({ body: eventBody }), async (req, res) => {
  const data = res.locals.body as z.infer<typeof eventBody>;
  const me = currentUser(req);
  if (data.startsAt < new Date()) throw ApiError.badRequest("Validation failed", { startsAt: "Start date must be in the future" });

  const event = await prisma.event.create({
    data: {
      ...data,
      isFeatured: me.role === "ADMIN" ? (data.isFeatured ?? false) : false,
      slug: `${slugify(data.title)}-${uniqueSuffix()}`,
      organizerId: me.id,
    },
    include: { organizer: organizerSelect },
  });
  res.status(201).json({ event: present(event) });
});

router.patch("/:id", authenticate, authorize("ORGANIZER", "ADMIN"), validate({ params: idParams, body: eventBody }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const data = res.locals.body as z.infer<typeof eventBody>;
  const me = currentUser(req);
  const existing = await loadOwnedEvent(id, me);

  if (data.totalSeats < existing.seatsSold) {
    throw ApiError.badRequest("Validation failed", {
      totalSeats: `${existing.seatsSold} tickets are already sold. Total seats cannot be lower than that.`,
    });
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...data,
      isFeatured: me.role === "ADMIN" ? (data.isFeatured ?? existing.isFeatured) : existing.isFeatured,
      slug: data.title !== existing.title ? `${slugify(data.title)}-${uniqueSuffix()}` : existing.slug,
    },
    include: { organizer: organizerSelect },
  });
  res.json({ event: present(event) });
});

router.delete("/:id", authenticate, authorize("ORGANIZER", "ADMIN"), validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  await loadOwnedEvent(id, currentUser(req));
  const paid = await prisma.booking.count({ where: { eventId: id, status: "PAID" } });
  if (paid > 0) {
    throw ApiError.conflict(`This event has ${paid} paid booking(s) and cannot be deleted. Unpublish it instead.`);
  }
  await prisma.event.delete({ where: { id } });
  res.json({ message: "Event deleted" });
});

// ---------- Single event (by id or slug) — keep last ----------

router.get("/:idOrSlug", optionalAuth, async (req, res) => {
  const key = String(req.params.idOrSlug);
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    include: { organizer: organizerSelect },
  });
  const me = req.user;
  const canSeeDraft = me && event && (me.role === "ADMIN" || me.id === event.organizerId);
  if (!event || (!event.isPublished && !canSeeDraft)) throw ApiError.notFound("Event not found");

  const related = await prisma.event.findMany({
    where: { isPublished: true, category: event.category, id: { not: event.id }, startsAt: { gte: new Date() } },
    include: { organizer: organizerSelect },
    orderBy: { startsAt: "asc" },
    take: 3,
  });

  let inWishlist = false;
  if (me) {
    inWishlist = !!(await prisma.wishlistItem.findUnique({ where: { userId_eventId: { userId: me.id, eventId: event.id } } }));
  }
  res.json({ event: present(event), related: related.map(present), inWishlist });
});

export default router;
