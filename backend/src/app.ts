import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFound } from "./middlewares/error.js";
import authRoutes from "./modules/auth/auth.routes.js";
import bookingRoutes from "./modules/bookings/bookings.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import { contactRouter, newsletterRouter, reviewsRouter, wishlistRouter } from "./modules/community/community.routes.js";
import customEventRoutes from "./modules/custom-events/custom-events.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import eventRoutes from "./modules/events/events.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import organizerRequestRoutes from "./modules/organizer-requests/organizer-requests.routes.js";
import productRoutes from "./modules/products/products.routes.js";
import uploadRoutes, { UPLOAD_ROOT, uploadFileRouter } from "./modules/uploads/uploads.routes.js";
import userRoutes from "./modules/users/users.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Uploaded images live in the database; bundled seed images on disk.
  app.use("/uploads/db", uploadFileRouter);
  app.use("/uploads", express.static(UPLOAD_ROOT, { maxAge: "30d", immutable: true, fallthrough: false }));

  app.get("/api/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  const api = express.Router();
  api.use("/auth", authRoutes);
  api.use("/users", userRoutes);
  api.use("/events", eventRoutes);
  api.use("/bookings", bookingRoutes);
  api.use("/products", productRoutes);
  api.use("/orders", orderRoutes);
  api.use("/custom-events", customEventRoutes);
  api.use("/organizer-requests", organizerRequestRoutes);
  api.use("/reviews", reviewsRouter);
  api.use("/contact", contactRouter);
  api.use("/newsletter", newsletterRouter);
  api.use("/wishlist", wishlistRouter);
  api.use("/dashboard", dashboardRoutes);
  api.use("/uploads", uploadRoutes);
  api.use("/chat", chatRoutes);
  app.use("/api", api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
