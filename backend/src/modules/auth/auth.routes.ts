import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  hashPassword,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  setAuthCookies,
  signAccessToken,
  toAccessPayload,
  verifyPassword,
} from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, currentUser } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError } from "../../utils/http.js";
import { DEMO_ACCOUNTS, publicUserSelect } from "../users/user.select.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 20 : 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1, "Password is required") });

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatar: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
});

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Current password is required"), newPassword: password })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

async function startSession(res: Response, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  const accessToken = signAccessToken(toAccessPayload(user));
  const refresh = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refresh.token, refresh.expiresAt);
  return { user, accessToken };
}

router.post("/register", authLimiter, validate({ body: registerSchema }), async (_req, res) => {
  const data = res.locals.body as z.infer<typeof registerSchema>;
  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw ApiError.conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash: await hashPassword(data.password),
    },
    select: { id: true },
  });
  res.status(201).json(await startSession(res, user.id));
});

router.post("/login", authLimiter, validate({ body: loginSchema }), async (_req, res) => {
  const { email, password } = res.locals.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, isActive: true } });
  // Same message for unknown email and wrong password (no account enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) throw ApiError.forbidden("This account has been deactivated. Please contact support.");
  res.json(await startSession(res, user.id));
});

router.get("/demo-accounts", (_req, res) => {
  if (!env.ENABLE_DEMO_LOGIN) return void res.json({ enabled: false, accounts: [] });
  res.json({
    enabled: true,
    accounts: Object.entries(DEMO_ACCOUNTS).map(([role, email]) => ({ role, email, password: env.DEMO_PASSWORD })),
  });
});

router.post(
  "/demo-login",
  authLimiter,
  validate({ body: z.object({ role: z.enum(["ADMIN", "ORGANIZER", "USER"]) }) }),
  async (_req, res) => {
    if (!env.ENABLE_DEMO_LOGIN) throw ApiError.forbidden("Demo login is disabled");
    const { role } = res.locals.body as { role: keyof typeof DEMO_ACCOUNTS };
    const user = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS[role] }, select: { id: true, isActive: true } });
    if (!user || !user.isActive) throw ApiError.notFound("Demo account not found. Run `npm run db:seed` in the backend.");
    res.json(await startSession(res, user.id));
  },
);

async function refreshSession(res: Response, token: string | undefined) {
  if (!token) return null;
  const rotated = await rotateRefreshToken(token);
  if (!rotated) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: rotated.user.id }, select: publicUserSelect });
  const accessToken = signAccessToken(toAccessPayload(user));
  setAuthCookies(res, accessToken, rotated.refresh.token, rotated.refresh.expiresAt);
  return { user, accessToken };
}

router.post("/refresh", async (req, res) => {
  const session = await refreshSession(res, req.cookies?.[REFRESH_COOKIE]);
  if (!session) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Your session has expired. Please sign in again.");
  }
  res.json(session);
});

/** Browser-navigation variant used by the Next.js proxy when the access token expired. */
router.get("/refresh", async (req, res) => {
  const raw = typeof req.query.redirect === "string" ? req.query.redirect : "/";
  const redirect = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
  const session = await refreshSession(res, req.cookies?.[REFRESH_COOKIE]);
  if (!session) {
    clearAuthCookies(res);
    return res.redirect(303, `/login?redirect=${encodeURIComponent(redirect)}`);
  }
  res.redirect(303, redirect);
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await revokeRefreshToken(token);
  clearAuthCookies(res);
  res.json({ message: "Signed out" });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUser(req).id }, select: publicUserSelect });
  if (!user) throw ApiError.unauthorized();
  res.json({ user });
});

router.patch("/me", authenticate, validate({ body: profileSchema }), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: res.locals.body as z.infer<typeof profileSchema>,
    select: publicUserSelect,
  });
  res.json({ user });
});

router.patch("/password", authenticate, validate({ body: passwordSchema }), async (req, res) => {
  const { currentPassword, newPassword } = res.locals.body as z.infer<typeof passwordSchema>;
  const me = currentUser(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest("Validation failed", { currentPassword: "Current password is incorrect" });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    // Sign out every other device.
    prisma.refreshToken.updateMany({ where: { userId: me.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  const session = await startSession(res, me.id);
  res.json({ message: "Password updated", user: session.user });
});

export default router;
