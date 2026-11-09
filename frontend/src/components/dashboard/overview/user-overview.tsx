"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BellRing, CalendarSearch, Banknote, Heart, Megaphone, PartyPopper, ShoppingBag, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DateStub } from "@/components/events/event-card";
import { PageHeading, StatCard } from "@/components/dashboard/page-heading";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { RequestBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiGet, errorMessage } from "@/lib/api";
import { formatMoney, formatTime } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";
import { OverviewSkeleton, SectionTitle } from "./overview-skeleton";

interface UserStats {
  totals: {
    tickets: number;
    bookings: number;
    orders: number;
    totalSpentCents: number;
    pendingCustomEvents: number;
    unseenCustomEventUpdates: number;
    wishlist: number;
  };
  organizerRequestStatus: RequestStatus | null;
  upcoming: {
    id: string;
    quantity: number;
    tier: "STANDARD" | "VIP";
    event: { id: string; title: string; slug: string; image: string; startsAt: string; venue: string; city: string };
  }[];
}

const QUICK_LINKS = [
  { href: "/events", label: "Browse events", description: "Concerts, summits and festivals near you", icon: CalendarSearch },
  { href: "/plan-your-event", label: "Plan an event", description: "Get a price for your wedding or party", icon: PartyPopper },
  { href: "/shop", label: "Party shop", description: "Balloons, lights and décor", icon: ShoppingBag },
];

export function UserOverview() {
  const { user, refetch: refetchUser } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "user"],
    queryFn: () => apiGet<UserStats>("/dashboard/user"),
  });

  // Approved while signed in: reload the profile so the new role (and the
  // refreshed access cookie the API hands back) unlock organizer tools.
  const approvedButStale = user?.role === "USER" && data?.organizerRequestStatus === "APPROVED";
  useEffect(() => {
    if (approvedButStale) refetchUser();
  }, [approvedButStale, refetchUser]);

  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) return <ErrorState message={errorMessage(error, "Couldn't load your dashboard.")} onRetry={() => refetch()} />;

  const t = data.totals;
  return (
    <div className="space-y-8">
      <PageHeading title={`Hi, ${user?.firstName ?? "there"}`} description="Your tickets, orders and plans in one place." />

      {t.unseenCustomEventUpdates > 0 && (
        <Link
          href="/dashboard/my/custom-events"
          className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-accent p-4 text-accent-foreground transition-colors hover:bg-accent/70"
        >
          <BellRing className="size-5 shrink-0" />
          <p className="flex-1 text-sm">
            <span className="font-semibold">
              {t.unseenCustomEventUpdates} update{t.unseenCustomEventUpdates === 1 ? "" : "s"} on your custom event requests.
            </span>{" "}
            See what our planners said.
          </p>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tickets" value={t.tickets} icon={Ticket} hint={`${t.bookings} paid bookings`} />
        <StatCard label="Shop orders" value={t.orders} icon={ShoppingBag} />
        <StatCard label="Total spent" value={formatMoney(t.totalSpentCents)} icon={Banknote} />
        <StatCard label="Wishlist" value={t.wishlist} icon={Heart} hint="Saved events" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionTitle action={<Link href="/dashboard/my/bookings" className="text-sm font-medium text-primary hover:underline">All tickets</Link>}>
            Coming up
          </SectionTitle>
          {data.upcoming.length ? (
            <ul className="space-y-3">
              {data.upcoming.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/dashboard/my/bookings/${b.id}`}
                    className="flex items-center gap-4 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="relative hidden size-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:block">
                      <Image src={b.event.image} alt="" fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-medium">{b.event.title}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {formatTime(b.event.startsAt)}, {b.event.venue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.quantity} {b.tier === "VIP" ? "VIP" : "standard"} ticket{b.quantity === 1 ? "" : "s"}
                      </p>
                    </div>
                    <DateStub iso={b.event.startsAt} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Ticket}
              title="No upcoming tickets"
              description="Find something to look forward to this month."
              action={
                <Button asChild size="lg">
                  <Link href="/events">Browse events</Link>
                </Button>
              }
            />
          )}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          {user?.role === "USER" &&
            (data.organizerRequestStatus ? (
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Organizer application</h2>
                  <RequestBadge status={data.organizerRequestStatus} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.organizerRequestStatus === "PENDING"
                    ? "Our team is reviewing your application. We usually reply within two working days."
                    : data.organizerRequestStatus === "REJECTED"
                      ? "Your last application wasn't approved. You can apply again with more details."
                      : "You're approved. Organizer tools are being unlocked for your account."}
                </p>
                {data.organizerRequestStatus === "REJECTED" && (
                  <Button asChild variant="outline" size="lg" className="mt-4">
                    <Link href="/dashboard/become-organizer">Apply again</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-ink p-5 text-white">
                <Megaphone className="size-5 text-marigold" />
                <h2 className="mt-3 font-semibold">Run your own events</h2>
                <p className="mt-1 text-sm text-white/70">Become an organizer to publish events and sell tickets on Dream Craft.</p>
                <Button asChild size="lg" className="mt-4">
                  <Link href="/dashboard/become-organizer">Apply to organize</Link>
                </Button>
              </div>
            ))}

          <div className="rounded-2xl border bg-card p-2">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted">
                <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <q.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{q.label}</span>
                  <span className="block text-xs text-muted-foreground">{q.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
