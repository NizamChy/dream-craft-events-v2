/**
 * Smaller community modules: reviews (testimonials), contact messages,
 * newsletter subscribers and the event wishlist.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated } from "../../utils/http.js";

const idParams = z.object({ id: z.string().min(1) });
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 10 : 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." },
});

// ---------------- Reviews ----------------
export const reviewsRouter = Router();
const reviewUser = { select: { firstName: true, lastName: true, avatar: true, role: true } } as const;

reviewsRouter.get("/", async (_req, res) => {
  const [items, stats] = await prisma.$transaction([
    prisma.review.findMany({ where: { isApproved: true }, include: { user: reviewUser }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.review.aggregate({ where: { isApproved: true }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  res.json({ items, stats: { average: Number((stats._avg.rating ?? 0).toFixed(1)), count: stats._count._all } });
});

reviewsRouter.get("/me", authenticate, async (req, res) => {
  res.json({ review: await prisma.review.findUnique({ where: { userId: currentUser(req).id } }) });
});

const reviewBody = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().min(10, "Write at least 10 characters").max(600),
});

reviewsRouter.put("/me", authenticate, validate({ body: reviewBody }), async (req, res) => {
  const data = res.locals.body as z.infer<typeof reviewBody>;
  const userId = currentUser(req).id;
  const review = await prisma.review.upsert({ where: { userId }, create: { ...data, userId }, update: data });
  res.json({ review });
});

reviewsRouter.delete("/me", authenticate, async (req, res) => {
  await prisma.review.deleteMany({ where: { userId: currentUser(req).id } });
  res.json({ message: "Review deleted" });
});

reviewsRouter.get("/manage/list", authenticate, authorize("ADMIN"), validate({ query: pageQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof pageQuery>;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({
      include: { user: { select: { firstName: true, lastName: true, email: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(q.page, q.limit),
    }),
    prisma.review.count(),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

reviewsRouter.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate({ params: idParams, body: z.object({ isApproved: z.boolean() }) }),
  async (_req, res) => {
    const { id } = res.locals.params as { id: string };
    const review = await prisma.review.update({ where: { id }, data: res.locals.body as { isApproved: boolean } });
    res.json({ review });
  },
);

reviewsRouter.delete("/:id", authenticate, authorize("ADMIN"), validate({ params: idParams }), async (_req, res) => {
  await prisma.review.delete({ where: { id: (res.locals.params as { id: string }).id } });
  res.json({ message: "Review deleted" });
});

// ---------------- Contact ----------------
export const contactRouter = Router();

const contactBody = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  subject: z.string().trim().min(3, "Enter a subject").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(3000),
});

contactRouter.post("/", publicFormLimiter, validate({ body: contactBody }), async (_req, res) => {
  await prisma.contactMessage.create({ data: res.locals.body as z.infer<typeof contactBody> });
  res.status(201).json({ message: "Thanks! We'll reply within one business day." });
});

contactRouter.use(authenticate, authorize("ADMIN"));

contactRouter.get("/", validate({ query: pageQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof pageQuery>;
  const [items, total, unread] = await prisma.$transaction([
    prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, ...paginate(q.page, q.limit) }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);
  res.json({ ...paginated(items, total, q.page, q.limit), unread });
});

contactRouter.patch("/:id", validate({ params: idParams, body: z.object({ isRead: z.boolean() }) }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const message = await prisma.contactMessage.update({ where: { id }, data: res.locals.body as { isRead: boolean } });
  res.json({ message });
});

contactRouter.delete("/:id", validate({ params: idParams }), async (_req, res) => {
  await prisma.contactMessage.delete({ where: { id: (res.locals.params as { id: string }).id } });
  res.json({ message: "Message deleted" });
});

// ---------------- Newsletter ----------------
export const newsletterRouter = Router();

newsletterRouter.post(
  "/",
  publicFormLimiter,
  validate({ body: z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") }) }),
  async (_req, res) => {
    const { email } = res.locals.body as { email: string };
    // Idempotent: subscribing twice is not an error.
    await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
    res.status(201).json({ message: "You're subscribed! Watch your inbox for upcoming events." });
  },
);

newsletterRouter.use(authenticate, authorize("ADMIN"));

newsletterRouter.get("/", validate({ query: pageQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof pageQuery>;
  const [items, total] = await prisma.$transaction([
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" }, ...paginate(q.page, q.limit) }),
    prisma.newsletterSubscriber.count(),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

newsletterRouter.delete("/:id", validate({ params: idParams }), async (_req, res) => {
  await prisma.newsletterSubscriber.delete({ where: { id: (res.locals.params as { id: string }).id } });
  res.json({ message: "Subscriber removed" });
});

// ---------------- Wishlist ----------------
export const wishlistRouter = Router();
wishlistRouter.use(authenticate);

wishlistRouter.get("/", async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: currentUser(req).id },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    items: items.map((i) => ({ ...i, event: { ...i.event, seatsLeft: Math.max(0, i.event.totalSeats - i.event.seatsSold) } })),
  });
});

wishlistRouter.put("/:eventId", validate({ params: z.object({ eventId: z.string().min(1) }) }), async (req, res) => {
  const { eventId } = res.locals.params as { eventId: string };
  const userId = currentUser(req).id;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, isPublished: true } });
  if (!event || !event.isPublished) throw ApiError.notFound("Event not found");
  await prisma.wishlistItem.upsert({ where: { userId_eventId: { userId, eventId } }, create: { userId, eventId }, update: {} });
  res.json({ inWishlist: true });
});

wishlistRouter.delete("/:eventId", validate({ params: z.object({ eventId: z.string().min(1) }) }), async (req, res) => {
  const { eventId } = res.locals.params as { eventId: string };
  await prisma.wishlistItem.deleteMany({ where: { userId: currentUser(req).id, eventId } });
  res.json({ inWishlist: false });
});
