import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { EventCategory, EventItem, Paginated } from "@/lib/types";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming concerts, summits, festivals and workshops across Bangladesh.",
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const category = str(sp.category);
  const validCategory = category && category in CATEGORY_LABELS ? (category as EventCategory) : undefined;
  const when = str(sp.when) === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const query = { search: str(sp.search), category: validCategory, when, sort: str(sp.sort), page, limit: 9 };

  const data = await serverGet<Paginated<EventItem>>("/events", query);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    return `/events${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">{validCategory ? CATEGORY_LABELS[validCategory] : when === "past" ? "Past events" : "All events"}</h1>
        <p className="mt-2 text-muted-foreground">
          {data ? `${data.meta.total} ${when === "past" ? "past" : "upcoming"} event${data.meta.total === 1 ? "" : "s"}` : "Find something worth leaving the house for."}
        </p>
      </div>

      <Suspense>
        <EventFilters />
      </Suspense>

      <div className="mt-8">
        {!data ? (
          <EmptyState icon={CalendarX2} title="Couldn't load events" description="The event service didn't respond. Refresh the page to try again." />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No events match your filters"
            description="Try another category or search term, or browse everything that's coming up."
            action={
              <Button asChild variant="outline" size="lg">
                <Link href="/events">Show all events</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((e, i) => (
              <EventCard key={e.id} event={e} priority={i < 3} />
            ))}
          </div>
        )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="lg">
                <Link href={pageHref(page - 1)} scroll>
                  <ChevronLeft /> Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg" disabled>
                <ChevronLeft /> Previous
              </Button>
            )}
            {page < data.meta.totalPages ? (
              <Button asChild variant="outline" size="lg">
                <Link href={pageHref(page + 1)} scroll>
                  Next <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg" disabled>
                Next <ChevronRight />
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
