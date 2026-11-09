import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { isProd } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../utils/http.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    res.status(400).json({ message: "Validation failed", errors: fieldErrors });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, ...(err.details ? { errors: err.details } : {}) });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ message: "A record with these details already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Resource not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ message: "This record is referenced by other data and cannot be changed" });
      return;
    }
  }

  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller" : err.message;
    res.status(400).json({ message });
    return;
  }

  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Malformed JSON body" });
    return;
  }

  // http-errors thrown by Express internals (e.g. static file 404, payload too large)
  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500) {
    res.status(status).json({ message: status === 404 ? "Not found" : String(err.message) });
    return;
  }

  console.error(err);
  res.status(500).json({ message: isProd ? "Something went wrong" : String(err?.message ?? err) });
};
