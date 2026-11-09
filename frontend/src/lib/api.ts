/**
 * Browser API client. Requests go to the same origin (`/api/*`) and are
 * proxied to Express by Next.js rewrites, so httpOnly auth cookies are sent
 * automatically. An expired access token is refreshed once and retried.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Query;
  /** Skip the automatic refresh-and-retry (used by auth endpoints). */
  noRefresh?: boolean;
}

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

function buildUrl(path: string, query?: Query) {
  const url = `/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, noRefresh, headers, ...init } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const doFetch = () =>
    fetch(buildUrl(path, query), {
      ...init,
      credentials: "include",
      headers: { ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !noRefresh) {
    if (await refreshSession()) {
      res = await doFetch();
    } else {
      onSessionExpired?.();
    }
  }

  const data = await parse(res);
  if (!res.ok) {
    const message =
      data?.message ??
      (res.status >= 500 ? "The server ran into a problem. Please try again." : `Request failed (${res.status})`);
    throw new ApiError(res.status, message, data?.errors ?? {});
  }
  return data as T;
}

export const apiGet = <T>(path: string, query?: Query) => api<T>(path, { query });
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const apiPatch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ?? {} });
export const apiPut = <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) return err.message === "Validation failed" ? Object.values(err.fieldErrors)[0] ?? err.message : err.message;
  return fallback;
}
