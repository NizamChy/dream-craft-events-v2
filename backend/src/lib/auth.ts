import bcrypt from "bcryptjs";
import { createHmac, randomBytes } from "node:crypto";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../generated/prisma/enums.js";
import { prisma } from "./prisma.js";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export interface AccessPayload {
  sub: string;
  role: Role;
  email: string;
  name: string;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] }) as AccessPayload;
}

/** Refresh tokens are opaque random strings; only an HMAC of them is stored. */
function hashRefreshToken(token: string) {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}

export async function issueRefreshToken(userId: string) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { tokenHash: hashRefreshToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/**
 * Validates and rotates a refresh token. Reuse of a revoked token revokes the
 * whole token family of that user (protection against stolen tokens).
 */
export async function rotateRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored) return null;

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return null;
  }
  if (stored.expiresAt < new Date() || !stored.user.isActive) return null;

  // Atomic: only one concurrent request can consume a given token.
  const consumed = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (consumed.count === 0) return null;

  const next = await issueRefreshToken(stored.userId);
  return { user: stored.user, refresh: next };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshExpires: Date) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookie, expires: refreshExpires });
}

/** Replaces only the access cookie (used when the role in the DB changed). */
export function setAccessCookie(res: Response, accessToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}

export function toAccessPayload(user: { id: string; role: Role; email: string; firstName: string; lastName: string }): AccessPayload {
  return { sub: user.id, role: user.role, email: user.email, name: `${user.firstName} ${user.lastName}`.trim() };
}
