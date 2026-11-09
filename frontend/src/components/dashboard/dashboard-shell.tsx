"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccess } from "@/lib/access";
import { apiGet } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { navFor } from "./nav";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ["custom-events", "me"],
    queryFn: () => apiGet<{ unseen: number }>("/custom-events/me"),
    enabled: !!user,
    staleTime: 60_000,
  });
  if (!user) return null;
  const badges = { customEventUpdates: data?.unseen ?? 0 };

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-6 px-3 py-4">
      {navFor(user.role).map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-foreground/45">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-sidebar-primary px-1.5 text-[0.7rem] font-semibold text-sidebar-primary-foreground">{count}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo inverted />
      </div>
      <div className="scrollbar-sidebar flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      {user && (
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          Signed in as <span className="font-medium text-sidebar-foreground">{ROLE_LABELS[user.role]}</span>
        </div>
      )}
    </div>
  );
}

function DeniedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (params.get("denied")) {
      toast.error("You don't have access to that page.");
      router.replace("/dashboard");
    }
  }, [params, router]);
  return null;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Client-side safety net (the proxy already guards on the server).
  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!canAccess(pathname, user.role)) router.replace("/dashboard?denied=1");
  }, [user, isLoading, pathname, router]);

  const allowed = !!user && canAccess(pathname, user.role);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button variant="ghost" asChild size="lg" className="text-muted-foreground">
            <Link href="/events">
              Browse events <ExternalLink />
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <Suspense fallback={null}>
            <DeniedNotice />
          </Suspense>
          {isLoading || !allowed ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
              <div className="grid gap-4 pt-4 sm:grid-cols-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
