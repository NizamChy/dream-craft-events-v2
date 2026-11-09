import "server-only";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

/**
 * Server-side fetch for public data (used by Server Components for SEO).
 * Always fresh so seat counts and prices are never stale. Returns null when
 * the API is unreachable so pages can render a friendly fallback.
 */
export async function serverGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T | null> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
