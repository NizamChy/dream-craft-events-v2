import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated } from "../../utils/http.js";
import { EVENT_TYPES, PRICING, estimateCost } from "./pricing.js";

const router = Router();


router.get("/pricing", (_req, res) => {
  res.json({ pricing: PRICING, eventTypes: EVENT_TYPES });
});

router.use(authenticate);

const idParams = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  eventType: z.enum(EVENT_TYPES, { error: "Select an event type" }),
  eventDate: z.coerce.date({ error: "Select the event date" }),
  location: z.string().trim().min(3, "Enter the event location").max(200),
  guestRange: z.enum(["UP_TO_250", "UP_TO_500", "UP_TO_1000"], { error: "Select the guest count" }),
  mediaPackage: z.enum(["NONE", "PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_AND_VIDEO"]).default("NONE"),
  catering: z.boolean().default(false),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(30)
    .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
  notes: z.string().trim().max(1000).optional(),
});

router.post("/", validate({ body: createSchema }), async (req, res) => {
  const data = res.locals.body as z.infer<typeof createSchema>;
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  minDate.setHours(0, 0, 0, 0);
  if (data.eventDate < minDate) {
    throw ApiError.badRequest("Validation failed", { eventDate: "Please choose a date at least 7 days from today" });
  }
  const request = await prisma.customEventRequest.create({
    data: {
      ...data,
      userId: currentUser(req).id,
      estimatedCostCents: estimateCost(data.guestRange, data.mediaPackage, data.catering),
    },
  });
  res.status(201).json({ request });
});

router.get("/me", async (req, res) => {
  const items = await prisma.customEventRequest.findMany({ where: { userId: currentUser(req).id }, orderBy: { createdAt: "desc" } });
  res.json({ items, unseen: items.filter((i) => !i.seenByUser).length });
});

router.post("/me/mark-seen", async (req, res) => {
  await prisma.customEventRequest.updateMany({ where: { userId: currentUser(req).id, seenByUser: false }, data: { seenByUser: true } });
  res.json({ message: "Marked as seen" });
});

router.delete("/:id", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const request = await prisma.customEventRequest.findUnique({ where: { id } });
  if (!request || request.userId !== currentUser(req).id) throw ApiError.notFound("Request not found");
  if (request.status !== "PENDING") throw ApiError.badRequest("Only pending requests can be withdrawn");
  await prisma.customEventRequest.delete({ where: { id } });
  res.json({ message: "Request withdrawn" });
});

// ---------- Admin ----------

const listQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/", authorize("ADMIN"), validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.CustomEventRequestWhereInput = q.status ? { status: q.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.customEventRequest.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.limit),
    }),
    prisma.customEventRequest.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().trim().max(500).optional(),
});

router.patch("/:id", authorize("ADMIN"), validate({ params: idParams, body: reviewSchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const { status, adminNote } = res.locals.body as z.infer<typeof reviewSchema>;
  const request = await prisma.customEventRequest.update({
    where: { id },
    data: { status, adminNote: adminNote || null, seenByUser: false },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  res.json({ request });
});

export default router;
