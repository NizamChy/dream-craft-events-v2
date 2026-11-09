"use client";

import { Menu, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { cartCount, useCart } from "@/stores/cart";
import { useHydrated } from "@/hooks/use-hydrated";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/plan-your-event", label: "Plan an event" },
  { href: "/shop", label: "Party shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const lines = useCart((s) => s.lines);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(lines) : 0;
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground",
              )}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-4.5 font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>

          {isLoading ? (
            <div className="size-9 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button variant="ghost" asChild size="lg">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/register">Create account</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Logo />
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("rounded-lg px-3 py-2.5 font-medium hover:bg-muted", isActive(item.href) && "bg-muted")}
                  >
                    {item.label}
                  </Link>
                ))}
                {!user && (
                  <div className="mt-4 grid gap-2">
                    <Button asChild variant="outline" size="xl" onClick={() => setOpen(false)}>
                      <Link href="/login">Sign in</Link>
                    </Button>
                    <Button asChild size="xl" onClick={() => setOpen(false)}>
                      <Link href="/register">Create account</Link>
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
