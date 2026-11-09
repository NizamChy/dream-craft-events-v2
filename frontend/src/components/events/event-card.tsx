import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORY_LABELS, dateParts, formatMoney, formatTime } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DateStub({ iso, className }: { iso: string; className?: string }) {
  const d = dateParts(iso);
  return (
    <div className={cn("flex w-14 shrink-0 flex-col items-center rounded-lg bg-marigold py-1.5 text-marigold-foreground", className)}>
      <span className="text-[0.7rem] font-semibold">{d.month}</span>
      <span className="font-display text-2xl leading-none font-bold">{d.day}</span>
      <span className="text-[0.65rem]">{d.weekday}</span>
    </div>
  );
}

/**
 * Event card shaped like a ticket: the perforated line and side notches
 * separate the event from its stub (date + price).
 */
export function EventCard({ event, priority = false }: { event: EventItem; priority?: boolean }) {
  const isPast = new Date(event.startsAt) < new Date();
  const soldOut = event.seatsLeft <= 0;
  const fewLeft = !soldOut && event.seatsLeft <= Math.max(10, event.totalSeats * 0.1);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group ticket flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground outline-none [--notch-y:calc(100%-4.75rem)] focus-visible:ring-3 focus-visible:ring-ring/60"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={event.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className={cn("object-cover transition-transform duration-500 group-hover:scale-[1.03]", isPast && "grayscale-[60%]")}
          preload={priority}
        />
        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {CATEGORY_LABELS[event.category]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 pb-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold group-hover:text-primary">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {event.venue}, {event.city}
          </span>
        </p>
      </div>

      <div className="perforation mx-4" aria-hidden />

      <div className="flex h-[4.75rem] items-center gap-3 px-5">
        <DateStub iso={event.startsAt} className="w-12 py-1 [&>span:first-child]:text-[0.65rem] [&>span:nth-child(2)]:text-xl" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{formatTime(event.startsAt)}</p>
          <p className={cn("text-xs text-muted-foreground", fewLeft && "font-medium text-primary")}>
            {isPast ? "Event ended" : soldOut ? "Sold out" : fewLeft ? `Only ${event.seatsLeft} seats left` : `${event.seatsLeft} seats left`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.7rem] text-muted-foreground">from</p>
          <p className="font-display text-lg font-bold">{event.standardPriceCents === 0 ? "Free" : formatMoney(event.standardPriceCents)}</p>
        </div>
      </div>
    </Link>
  );
}
