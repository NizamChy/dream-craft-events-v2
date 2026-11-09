import type { Role } from "./types";

/**
 * Route → allowed roles. The most specific prefix wins. Used by the proxy
 * (server-side guard) and the dashboard sidebar, so they never disagree.
 * The Express API enforces the same rules independently.
 */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/manage", roles: ["ORGANIZER", "ADMIN"] },
  { prefix: "/dashboard/become-organizer", roles: ["USER"] },
  { prefix: "/dashboard", roles: ["USER", "ORGANIZER", "ADMIN"] },
];

export function canAccess(pathname: string, role: Role) {
  const rule = ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.roles.includes(role) : true;
}

export function safeRedirect(target: string | null | undefined, fallback = "/dashboard") {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
