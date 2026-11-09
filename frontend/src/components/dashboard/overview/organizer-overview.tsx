"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Banknote, LayoutList, Ticket } from "lucide-react";
import Link from "next/link";
import { PageHeading, StatCard } from "@/components/dashboard/page-heading";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiGet, errorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { OverviewSkeleton, SectionTitle } from "./overview-skeleton";
import { RecentBookings, type RecentBooking } from "./recent-bookings";
import { RevenueChart, type RevenuePoint } from "./revenue-chart";

interface OrganizerStats {
  totals: { events: number; upcomingEvents: number; ticketsSold: number; paidBookings: number; revenueCents: number };
  revenueByMonth: RevenuePoint[];
  eventSales: {
    id: string;
    title: string;
    slug: string;
    startsAt: string;
    totalSeats: number;
    seatsSold: number;
    isPublished: boolean;
    occupancy: number;
  }[];
  recentBookings: RecentBooking[];
}

export function OrganizerOverview() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "organizer"],
    queryFn: () => apiGet<OrganizerStats>("/dashboard/organizer"),
  });

  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) return <ErrorState message={errorMessage(error, "Couldn't load the dashboard.")} onRetry={() => refetch()} />;

  const t = data.totals;
  return (
    <div className="space-y-8">
      <PageHeading
        title={`Welcome back, ${user?.firstName ?? "organizer"}`}
        description="How your events are selling."
        actions={
          <Button asChild size="xl">
            <Link href="/dashboard/manage/events/new">
              <CalendarPlus /> Create event
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Your events" value={t.events} icon={LayoutList} />
        <StatCard label="Upcoming" value={t.upcomingEvents} icon={CalendarDays} />
        <StatCard label="Tickets sold" value={t.ticketsSold} icon={Ticket} hint={`${t.paidBookings} paid bookings`} />
        <StatCard label="Revenue" value={formatMoney(t.revenueCents)} icon={Banknote} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <SectionTitle>Ticket revenue, last 6 months</SectionTitle>
          <RevenueChart data={data.revenueByMonth} showShop={false} />
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <SectionTitle action={<Link href="/dashboard/manage/events" className="text-sm font-medium text-primary hover:underline">All events</Link>}>
            Upcoming occupancy
          </SectionTitle>
          {data.eventSales.length ? (
            <ul className="space-y-4">
              {data.eventSales.map((e) => (
                <li key={e.id}>
                  <Link href={`/dashboard/manage/events/${e.id}/edit`} className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="line-clamp-1 font-medium group-hover:text-primary">{e.title}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{e.occupancy}%</span>
                    </div>
                    <Progress value={e.occupancy} className="mt-2" aria-label={`${e.title} occupancy`} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(e.startsAt)}, {e.seatsSold} of {e.totalSeats} seats sold
                      {!e.isPublished && ", not published"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming events"
              description="Create an event to start selling tickets."
              className="py-8"
            />
          )}
        </section>
      </div>

      <section>
        <SectionTitle action={<Link href="/dashboard/manage/bookings" className="text-sm font-medium text-primary hover:underline">All sales</Link>}>
          Latest ticket sales
        </SectionTitle>
        <RecentBookings items={data.recentBookings} />
      </section>
    </div>
  );
}
