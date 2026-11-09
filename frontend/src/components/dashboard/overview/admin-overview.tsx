"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Banknote, Mail, ShoppingBag, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeading, StatCard } from "@/components/dashboard/page-heading";
import { ErrorState } from "@/components/shared/empty-state";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { apiGet, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatMoney } from "@/lib/format";
import type { EventCategory } from "@/lib/types";
import { OverviewSkeleton, SectionTitle } from "./overview-skeleton";
import { RecentBookings, type RecentBooking } from "./recent-bookings";
import { RevenueChart, type RevenuePoint } from "./revenue-chart";

interface AdminStats {
  totals: {
    users: number;
    usersByRole: { USER: number; ORGANIZER: number; ADMIN: number };
    events: number;
    upcomingEvents: number;
    ticketsSold: number;
    paidBookings: number;
    ticketRevenueCents: number;
    paidOrders: number;
    shopRevenueCents: number;
    pendingCustomEvents: number;
    pendingOrganizerRequests: number;
    unreadMessages: number;
    subscribers: number;
  };
  revenueByMonth: RevenuePoint[];
  ticketsByCategory: { category: EventCategory; tickets: number }[];
  recentBookings: RecentBooking[];
}

const categoryConfig = { tickets: { label: "Tickets", color: "var(--chart-4)" } } satisfies ChartConfig;

export function AdminOverview() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => apiGet<AdminStats>("/dashboard/admin"),
  });

  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) return <ErrorState message={errorMessage(error, "Couldn't load the dashboard.")} onRetry={() => refetch()} />;

  const t = data.totals;
  const attention = [
    { count: t.pendingOrganizerRequests, label: "organizer request", href: "/dashboard/admin/organizer-requests" },
    { count: t.pendingCustomEvents, label: "custom event request", href: "/dashboard/admin/custom-events" },
    { count: t.unreadMessages, label: "unread message", href: "/dashboard/admin/messages" },
  ].filter((a) => a.count > 0);

  const categories = data.ticketsByCategory.map((c) => ({ name: CATEGORY_LABELS[c.category] ?? c.category, tickets: c.tickets }));

  return (
    <div className="space-y-8">
      <PageHeading title="Platform overview" description="Sales, people and requests across Dream Craft Events." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Users"
          value={t.users}
          icon={Users}
          hint={`${plural(t.usersByRole.USER, "member")}, ${plural(t.usersByRole.ORGANIZER, "organizer")}, ${plural(t.usersByRole.ADMIN, "admin")}`}
        />
        <StatCard label="Upcoming events" value={t.upcomingEvents} icon={CalendarDays} hint={`${t.events} events in total`} />
        <StatCard label="Tickets sold" value={t.ticketsSold} icon={Ticket} hint={`Across ${t.paidBookings} paid bookings`} />
        <StatCard label="Ticket revenue" value={formatMoney(t.ticketRevenueCents)} icon={Banknote} />
        <StatCard label="Shop revenue" value={formatMoney(t.shopRevenueCents)} icon={ShoppingBag} hint={`${t.paidOrders} paid orders`} />
        <StatCard label="Newsletter subscribers" value={t.subscribers} icon={Mail} />
      </div>

      {attention.length > 0 && (
        <section className="rounded-2xl border border-marigold/40 bg-marigold/10 p-5">
          <h2 className="font-semibold">Needs your attention</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {attention.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <span>
                    {a.count} {a.label}
                    {a.count === 1 ? "" : "s"}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <SectionTitle>Revenue, last 6 months</SectionTitle>
          <RevenueChart data={data.revenueByMonth} />
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <SectionTitle>Tickets by category</SectionTitle>
          {categories.length ? (
            <ChartContainer config={categoryConfig} className="aspect-auto h-64 w-full">
              <BarChart data={categories} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={110} />
                <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
                <Bar dataKey="tickets" fill="var(--color-tickets)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">No tickets sold yet.</p>
          )}
        </section>
      </div>

      <section>
        <SectionTitle>Latest ticket sales</SectionTitle>
        <RecentBookings items={data.recentBookings} />
      </section>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
