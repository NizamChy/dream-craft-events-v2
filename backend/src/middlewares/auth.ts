import type { Request, RequestHandler, Response } from "express";
import type { Role } from "../generated/prisma/enums.js";
import { ACCESS_COOKIE, setAccessCookie, signAccessToken, verifyAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
}

async function resolveUser(token: string): Promise<{ user: AuthUser; stale: boolean } | null> {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  // Always read the current role/status from the DB, so a role change or
  // account deactivation takes effect immediately, not at token expiry.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, firstName: true, lastName: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const authUser = { id: user.id, role: user.role, email: user.email, name: `${user.firstName} ${user.lastName}` };
  return { user: authUser, stale: payload.role !== user.role };
}

/**
 * When the role in the token is out of date (e.g. an organizer request was
 * approved), hand the browser a fresh access cookie so the frontend route
 * guard sees the new role on the next navigation.
 */
function attach(req: Request, res: Response, resolved: { user: AuthUser; stale: boolean }, fromCookie: boolean) {
  req.user = resolved.user;
  if (resolved.stale && fromCookie) {
    setAccessCookie(res, signAccessToken({ sub: resolved.user.id, role: resolved.user.role, email: resolved.user.email, name: resolved.user.name }));
  }
}

/** Requires a valid access token. */
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();
  const resolved = await resolveUser(token);
  if (!resolved) throw ApiError.unauthorized("Your session has expired. Please sign in again.");
  attach(req, res, resolved, !req.headers.authorization);
  next();
};

/** Attaches the user when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = async (req, res, next) => {
  const token = extractToken(req);
  const resolved = token ? await resolveUser(token) : null;
  if (resolved) attach(req, res, resolved, !req.headers.authorization);
  next();
};

/** Role based access control. Use after `authenticate`. */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
