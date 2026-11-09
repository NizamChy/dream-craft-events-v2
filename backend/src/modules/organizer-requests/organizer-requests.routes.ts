import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated } from "../../utils/http.js";

const router = Router();
router.use(authenticate);

const userSummary = { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true } } as const;

const createSchema = z.object({
  company: z.string().trim().min(2, "Company / brand name is required").max(120),
  experience: z.string().trim().min(1, "Tell us about your experience").max(120),
  skills: z.string().trim().min(3, "List a few skills").max(300),
  message: z.string().trim().max(1000).optional(),
});

router.post("/", authorize("USER"), validate({ body: createSchema }), async (req, res) => {
  const data = res.locals.body as z.infer<typeof createSchema>;
  const me = currentUser(req);
  const pending = await prisma.organizerRequest.findFirst({ where: { userId: me.id, status: "PENDING" } });
  if (pending) throw ApiError.conflict("You already have a pending request. We'll get back to you soon.");
  const request = await prisma.organizerRequest.create({ data: { ...data, userId: me.id } });
  res.status(201).json({ request });
});

router.get("/me", async (req, res) => {
  const request = await prisma.organizerRequest.findFirst({ where: { userId: currentUser(req).id }, orderBy: { createdAt: "desc" } });
  res.json({ request });
});

const listQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/", authorize("ADMIN"), validate({ query: listQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.OrganizerRequestWhereInput = q.status ? { status: q.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.organizerRequest.findMany({ where, include: { user: userSummary }, orderBy: { createdAt: "desc" }, ...paginate(q.page, q.limit) }),
    prisma.organizerRequest.count({ where }),
  ]);
  res.json(paginated(items, total, q.page, q.limit));
});

const decisionSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), adminNote: z.string().trim().max(500).optional() });

router.patch(
  "/:id",
  authorize("ADMIN"),
  validate({ params: z.object({ id: z.string().min(1) }), body: decisionSchema }),
  async (_req, res) => {
    const { id } = res.locals.params as { id: string };
    const { status, adminNote } = res.locals.body as z.infer<typeof decisionSchema>;
    const request = await prisma.organizerRequest.findUnique({ where: { id } });
    if (!request) throw ApiError.notFound("Request not found");
    if (request.status !== "PENDING") throw ApiError.conflict("This request has already been reviewed");

    const updated = await prisma.$transaction(async (tx) => {
      if (status === "APPROVED") {
        // Promote only regular users (never downgrade an admin).
        await tx.user.updateMany({ where: { id: request.userId, role: "USER" }, data: { role: "ORGANIZER" } });
      }
      return tx.organizerRequest.update({
        where: { id },
        data: { status, adminNote: adminNote || null, reviewedAt: new Date() },
        include: { user: userSummary },
      });
    });
    res.json({ request: updated });
  },
);

export default router;
