import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError, paginate, paginated } from "../../utils/http.js";
import { publicUserSelect } from "./user.select.js";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

const idParams = z.object({ id: z.string().min(1) });

const listQuery = z.object({
  search: z.string().trim().optional(),
  role: z.enum(["USER", "ORGANIZER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get("/", validate({ query: listQuery }), async (_req, res) => {
  const { search, role, page, limit } = res.locals.query as z.infer<typeof listQuery>;
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { ...publicUserSelect, _count: { select: { bookings: true, orders: true, organizedEvents: true } } },
      orderBy: { createdAt: "desc" },
      ...paginate(page, limit),
    }),
    prisma.user.count({ where }),
  ]);
  res.json(paginated(items, total, page, limit));
});

router.get("/:id", validate({ params: idParams }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...publicUserSelect, _count: { select: { bookings: true, orders: true, organizedEvents: true } } },
  });
  if (!user) throw ApiError.notFound("User not found");
  res.json({ user });
});

const updateSchema = z
  .object({
    role: z.enum(["USER", "ORGANIZER", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, { message: "Nothing to update" });

router.patch("/:id", validate({ params: idParams, body: updateSchema }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const data = res.locals.body as z.infer<typeof updateSchema>;
  if (id === currentUser(req).id) throw ApiError.badRequest("You cannot change your own role or status");

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data, select: publicUserSelect });
    // Deactivated users are signed out everywhere.
    if (data.isActive === false) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return updated;
  });
  res.json({ user });
});

router.delete("/:id", validate({ params: idParams }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  if (id === currentUser(req).id) throw ApiError.badRequest("You cannot delete your own account");
  const events = await prisma.event.count({ where: { organizerId: id } });
  if (events > 0) {
    throw ApiError.conflict(`This user organizes ${events} event(s). Reassign or delete those events first, or deactivate the account instead.`);
  }
  await prisma.user.delete({ where: { id } });
  res.json({ message: "User deleted" });
});

export default router;
