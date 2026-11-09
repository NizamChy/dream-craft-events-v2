"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { ApiError, api, setSessionExpiredHandler } from "@/lib/api";
import type { Role, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (role: Role) => Promise<User>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const ME_KEY = ["auth", "me"] as const;

async function fetchMe(): Promise<User | null> {
  try {
    const { user } = await api<{ user: User }>("/auth/me");
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading, refetch } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60 * 1000, retry: 1 });

  const setUser = useCallback((user: User | null) => queryClient.setQueryData(ME_KEY, user), [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      if (window.location.pathname.startsWith("/dashboard")) {
        router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      }
    });
  }, [router, setUser]);

  const startSession = useCallback(
    (user: User) => {
      // Drop any cached data from a previous account before switching.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
      setUser(user);
      return user;
    },
    [queryClient, setUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      login: async (email, password) =>
        startSession((await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password }, noRefresh: true })).user),
      demoLogin: async (role) =>
        startSession((await api<{ user: User }>("/auth/demo-login", { method: "POST", body: { role }, noRefresh: true })).user),
      register: async (body) =>
        startSession((await api<{ user: User }>("/auth/register", { method: "POST", body, noRefresh: true })).user),
      logout: async () => {
        await api("/auth/logout", { method: "POST", noRefresh: true }).catch(() => undefined);
        queryClient.clear();
        setUser(null);
        if (pathname.startsWith("/dashboard") || pathname.startsWith("/checkout")) router.replace("/");
        router.refresh();
      },
      setUser: (user) => setUser(user),
      refetch: () => void refetch(),
    }),
    [data, isLoading, startSession, queryClient, setUser, pathname, router, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
