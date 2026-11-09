import { CalendarSearch, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DateStub, EventCard } from "@/components/events/event-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Stars } from "@/components/shared/stars";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatMoney, formatTime, fullName } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { EventCategory, EventItem, Paginated, Review } from "@/lib/types";

export default async function HomePage() {
  const [featured, upcoming, categories, reviews] = await Promise.all([
    serverGet<Paginated<EventItem>>("/events", { featured: "true", limit: 1 }),
    serverGet<Paginated<EventItem>>("/events", { limit: 6 }),
    serverGet<{ categories: { category: EventCategory; count: number }[] }>("/events/categories"),
    serverGet<{ items: Review[]; stats: { average: number; count: number } }>("/reviews"),
  ]);
  const spotlight = featured?.items[0] ?? upcoming?.items[0];

  return (
    <>
      {/* Hero: the next featured event, presented as the ticket you could be holding. */}
      <section className="relative overflow-hidden bg-ink text-white">
        <Image src="/images/hero.webp" alt="" fill preload sizes="100vw" className="object-cover opacity-25" quality={60} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="max-w-xl text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">Find your next night to remember.</h1>
            <p className="mt-5 max-w-lg text-lg text-white/75">
              Tickets for concerts, summits and festivals across Bangladesh, and planners who craft your wedding, birthday or company event.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="/events">
                  <CalendarSearch /> Browse events
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                <Link href="/plan-your-event">Plan your own event</Link>
              </Button>
            </div>
            <dl className="mt-12 flex gap-10 text-sm">
              <div>
                <dt className="text-white/55">Upcoming events</dt>
                <dd className="font-display text-2xl font-bold">{upcoming?.meta.total ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-white/55">Average rating</dt>
                <dd className="font-display text-2xl font-bold">{reviews?.stats.average ? `${reviews.stats.average} / 5` : "—"}</dd>
              </div>
            </dl>
          </div>

          {spotlight && (
            <Link
              href={`/events/${spotlight.slug}`}
              className="group ticket mx-auto block w-full max-w-md overflow-hidden rounded-3xl bg-card text-card-foreground shadow-2xl shadow-black/40 outline-none [--notch-y:calc(100%-6rem)] [--notch:14px] focus-visible:ring-4 focus-visible:ring-ring/60 lg:rotate-2 lg:transition-transform lg:hover:rotate-0"
            >
              <div className="relative aspect-[4/3]">
                <Image src={spotlight.image} alt="" fill preload sizes="(min-width: 1024px) 448px, 90vw" className="object-cover" />
                <span className="absolute top-4 left-4 rounded-full bg-marigold px-3 py-1 text-xs font-semibold text-marigold-foreground">
                  Featured
                </span>
              </div>
              <div className="space-y-1.5 p-6 pb-5">
                <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[spotlight.category]}</p>
                <h2 className="text-2xl leading-tight font-bold group-hover:text-primary">{spotlight.title}</h2>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> {spotlight.venue}, {spotlight.city}
                </p>
              </div>
              <div className="perforation mx-5" aria-hidden />
              <div className="flex h-24 items-center gap-4 px-6">
                <DateStub iso={spotlight.startsAt} />
                <div className="flex-1 text-sm">
                  <p className="font-medium">Doors open {formatTime(spotlight.startsAt)}</p>
                  <p className="text-muted-foreground">{spotlight.seatsLeft} seats left</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">from</p>
                  <p className="font-display text-2xl font-bold">{formatMoney(spotlight.standardPriceCents)}</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Categories */}
      {categories && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
          <h2 className="sr-only">Browse by category</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.categories
              .filter((c) => c.count > 0)
              .map((c) => (
                <li key={c.category}>
                  <Link
                    href={`/events?category=${c.category}`}
                    className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {CATEGORY_LABELS[c.category]}
                    <span className="text-xs text-muted-foreground">{c.count}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Upcoming */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Coming up</h2>
            <p className="mt-1 text-muted-foreground">Grab a seat before they&apos;re gone.</p>
          </div>
          <Button asChild variant="outline" size="lg" className="hidden sm:inline-flex">
            <Link href="/events">See all events</Link>
          </Button>
        </div>
        {upcoming === null ? (
          <EmptyState icon={Ticket} title="Events are taking a moment to load" description="We couldn't reach the event service. Refresh the page in a few seconds." />
        ) : upcoming.items.length === 0 ? (
          <EmptyState icon={Ticket} title="No upcoming events yet" description="New events are added every week. Subscribe below to hear first." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.items.map((e, i) => (
              <EventCard key={e.id} event={e} priority={i < 3} />
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="xl" className="mt-8 w-full sm:hidden">
          <Link href="/events">See all events</Link>
        </Button>
      </section>

      {/* Plan with us */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image src="/images/custom-event.webp" alt="A wedding reception table set with flowers and candles" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Planning something personal?</h2>
            <p className="mt-3 max-w-lg text-lg text-muted-foreground">
              Weddings, birthdays, anniversaries and company events. Tell us what you need and see the price before you commit.
            </p>
            <ol className="mt-8 space-y-5">
              {[
                ["Describe your event", "Type, date, venue and guest count."],
                ["See your estimate instantly", "Add photography, video or catering and watch the price update."],
                ["Confirm with a planner", "We review your request and reply in your dashboard within a day."],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display font-bold text-accent-foreground">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild size="xl" className="mt-8">
              <Link href="/plan-your-event">Start planning</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews && reviews.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold">What people say</h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={reviews.stats.average} /> {reviews.stats.average} from {reviews.stats.count} reviews
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {reviews.items.slice(0, 3).map((r) => (
              <figure key={r.id} className="flex flex-col rounded-2xl border bg-card p-6">
                <Stars rating={r.rating} />
                <blockquote className="mt-4 flex-1 text-[0.95rem] leading-relaxed">“{r.comment}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 text-sm">
                  <UserAvatar user={r.user} className="size-9" />
                  <span className="font-medium">{fullName(r.user)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Organizer CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-white sm:px-12">
          <Image src="/images/organizer-cta.webp" alt="" fill sizes="(min-width: 1280px) 1232px, 100vw" className="object-cover opacity-30" quality={60} />
          <div className="relative max-w-xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Run events? Sell tickets here.</h2>
            <p className="mt-3 text-white/75">
              Publish your event in minutes, track sales in real time and get paid for every seat. Apply once and our team approves organizers within two days.
            </p>
            <Button asChild size="xl" className="mt-7">
              <Link href="/dashboard/become-organizer">Apply as an organizer</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
