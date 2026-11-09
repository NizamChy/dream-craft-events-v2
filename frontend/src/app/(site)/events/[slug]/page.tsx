import { CalendarDays, ChevronLeft, Clock, MapPin, Mic2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPanel } from "@/components/events/booking-panel";
import { EventCard } from "@/components/events/event-card";
import { WishlistButton } from "@/components/events/wishlist-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CATEGORY_LABELS, formatDate, formatTime, fullName } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { EventItem } from "@/lib/types";

type EventResponse = { event: EventItem; related: EventItem[] };

const getEvent = (slug: string) => serverGet<EventResponse>(`/events/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEvent(slug);
  if (!data) return { title: "Event not found" };
  return {
    title: data.event.title,
    description: data.event.summary,
    openGraph: { title: data.event.title, description: data.event.summary, images: [data.event.image] },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const data = await getEvent(slug);
  if (!data) notFound();
  const { event, related } = data;

  return (
    <article>
      <div className="relative h-[42vh] min-h-72 overflow-hidden bg-ink">
        <Image src={event.image} alt="" fill preload sizes="100vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 text-white sm:px-6">
          <Link href="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-white/75 hover:text-white">
            <ChevronLeft className="size-4" /> All events
          </Link>
          <p className="text-sm text-white/75">{CATEGORY_LABELS[event.category]}</p>
          <h1 className="mt-1 max-w-3xl text-3xl font-bold sm:text-5xl">{event.title}</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ul className="grid gap-3 text-sm sm:grid-cols-3 sm:gap-6">
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" /> {formatDate(event.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-primary" /> {formatTime(event.startsAt)}
                {event.endsAt ? ` to ${formatTime(event.endsAt)}` : ""}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" /> {event.venue}, {event.city}
              </li>
            </ul>
            <WishlistButton eventId={event.id} slug={event.slug} />
          </div>

          <p className="mt-8 text-xl leading-relaxed font-medium">{event.summary}</p>
          <div className="mt-4 max-w-[70ch] space-y-4 leading-relaxed whitespace-pre-line text-muted-foreground">{event.description}</div>

          {event.speakers.length > 0 && (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Mic2 className="size-5 text-primary" /> On stage
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {event.speakers.map((s) => (
                  <li key={s} className="rounded-full border bg-card px-4 py-2 text-sm font-medium">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {event.sponsors.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Sparkles className="size-5 text-marigold" /> Supported by
              </h2>
              <p className="mt-3 text-muted-foreground">{event.sponsors.join(", ")}</p>
            </section>
          )}

          {event.organizer && (
            <section className="mt-10 flex items-center gap-4 rounded-2xl border bg-card p-5">
              <UserAvatar user={event.organizer} className="size-12" />
              <div>
                <p className="text-sm text-muted-foreground">Organized by</p>
                <p className="font-semibold">{fullName(event.organizer)}</p>
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel event={event} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold">More {CATEGORY_LABELS[event.category].toLowerCase()} events</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
