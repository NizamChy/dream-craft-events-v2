import { randomBytes } from "node:crypto";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message: string) {
    return new ApiError(409, message);
  }
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Human friendly, unambiguous reference codes e.g. DCE-7K4QP9XM */
export function referenceCode(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}-${out}`;
}

export function uniqueSuffix() {
  return randomBytes(3).toString("hex");
}
