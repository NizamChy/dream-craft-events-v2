"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { apiPost, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Booking, EventItem, TicketTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIERS: { tier: TicketTier; name: string; perks: string[] }[] = [
  { tier: "STANDARD", name: "Standard", perks: ["Entry to all sessions", "Access to food court and expo area"] },
  { tier: "VIP", name: "VIP", perks: ["Reserved front seating", "Meet the speakers and performers", "Session recordings"] },
];

export function BookingPanel({ event }: { event: EventItem }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tier, setTier] = useState<TicketTier>("STANDARD");
  const [quantity, setQuantity] = useState(1);

  const isPast = new Date(event.startsAt) < new Date();
  const soldOut = event.seatsLeft <= 0;
  const maxQty = Math.max(1, Math.min(10, event.seatsLeft));
  const unit = tier === "VIP" ? event.vipPriceCents : event.standardPriceCents;

  const book = useMutation({
    mutationFn: () => apiPost<{ booking: Booking }>("/bookings", { eventId: event.id, tier, quantity }),
    onSuccess: ({ booking }) => router.push(`/checkout/booking/${booking.id}`),
    onError: (err) => toast.error(errorMessage(err)),
  });

  function handleBook() {
    if (!user) {
      toast.info("Sign in to book your tickets.");
      router.push(`/login?redirect=${encodeURIComponent(`/events/${event.slug}`)}`);
      return;
    }
    book.mutate();
  }

  return (
    <div className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 className="text-xl font-bold">Choose your ticket</h2>

      <div role="radiogroup" aria-label="Ticket type" className="mt-4 grid gap-3">
        {TIERS.map((t) => {
          const price = t.tier === "VIP" ? event.vipPriceCents : event.standardPriceCents;
          const selected = tier === t.tier;
          return (
            <button
              key={t.tier}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPast || soldOut}
              onClick={() => setTier(t.tier)}
              className={cn(
                "rounded-2xl border-2 p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                selected ? "border-primary bg-accent/50" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <span className="font-display text-xl font-bold">{formatMoney(price)}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span id="qty-label" className="text-sm font-medium">
          Tickets
        </span>
        <div className="flex items-center gap-1 rounded-xl border p-1" role="group" aria-labelledby="qty-label">
          <Button variant="ghost" size="icon" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Fewer tickets">
            <Minus />
          </Button>
          <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="More tickets">
            <Plus />
          </Button>
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t pt-4">
        <span className="text-muted-foreground">Total</span>
        <span className="font-display text-3xl font-bold">{formatMoney(unit * quantity)}</span>
      </div>

      <Button size="xl" className="mt-4 w-full" onClick={handleBook} disabled={isPast || soldOut || book.isPending}>
        {book.isPending && <Loader2 className="animate-spin" />}
        {isPast ? "This event has ended" : soldOut ? "Sold out" : user ? "Continue to payment" : "Sign in to book"}
      </Button>
      {!isPast && !soldOut && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {event.seatsLeft} of {event.totalSeats} seats left. Up to 10 tickets per booking.
        </p>
      )}
    </div>
  );
}
