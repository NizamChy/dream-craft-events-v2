import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { optionalAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { contextSchema, respond } from "./chat.service.js";

const router = Router();

// Open to guests, so keep a lid on abuse.
const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "You're sending messages too fast. Please wait a moment." },
});

const bodySchema = z.object({
  message: z.string().trim().min(1, "Type a message").max(500, "Keep messages under 500 characters"),
  context: contextSchema.default({}),
});

router.post("/", chatLimiter, optionalAuth, validate({ body: bodySchema }), async (req, res) => {
  const { message, context } = res.locals.body as z.infer<typeof bodySchema>;
  res.json(await respond(message, context, req.user));
});

export default router;
