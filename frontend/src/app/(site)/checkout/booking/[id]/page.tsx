"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CircleCheck, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { DemoPayment } from "@/components/checkout/demo-payment";
import { ErrorState } from "@/components/shared/empty-state";
import { PaymentBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiPost, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { bookingQuery } from "@/lib/queries";
import type { Booking } from "@/lib/types";

export default function BookingCheckoutPage({ params }: PageProps<"/checkout/booking/[id]">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const query = bookingQuery(id);

  const { data: booking, isLoading, error, refetch } = useQuery(query);

  const pay = useMutation({
    mutationFn: (outcome: "success" | "fail") => apiPost<{ booking: Booking }>(`/bookings/${id}/pay`, { outcome }),
    onSuccess: ({ booking }) => {
      queryClient.setQueryData(query.queryKey, booking);
      void queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment successful. Your tickets are confirmed.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      if (err instanceof ApiError && err.status === 402) void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState message={error ? errorMessage(error) : "We couldn't find this booking"} onRetry={() => void refetch()} />
      </div>
    );
  }

  const paid = booking.status === "PAID";
  const payable = booking.status === "PENDING" || booking.status === "FAILED";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {paid ? (
        <div className="mb-8 flex items-start gap-3">
          <CircleCheck className="mt-1 size-8 shrink-0 text-success" />
          <div>
            <h1 className="text-3xl font-bold">You&apos;re going!</h1>
            <p className="mt-1 text-muted-foreground">Your tickets are confirmed. Show the QR code on your ticket at the entrance.</p>
          </div>
        </div>
      ) : (
        <h1 className="mb-8 text-3xl font-bold">Complete your booking</h1>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="relative aspect-[16/7] bg-muted">
            <Image src={booking.event.image} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">{booking.event.title}</h2>
              <PaymentBadge status={booking.status} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4" /> {formatDateTime(booking.event.startsAt)}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4" /> {booking.event.venue}, {booking.event.city}
              </li>
            </ul>
            <div className="perforation my-5" aria-hidden />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Booking reference</dt>
                <dd className="font-medium">{booking.code}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {booking.tier === "VIP" ? "VIP" : "Standard"} ticket × {booking.quantity}
                </dt>
                <dd className="tabular-nums">{formatMoney(booking.unitPriceCents)} each</dd>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="font-display text-xl tabular-nums">{formatMoney(booking.totalCents)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {payable ? (
            <DemoPayment
              amountCents={booking.totalCents}
              failedBefore={booking.status === "FAILED"}
              pending={pay.isPending ? (pay.variables ?? null) : null}
              onPay={(outcome) => pay.mutate(outcome)}
            />
          ) : paid ? (
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Paid on {formatDateTime(booking.paidAt!)}</p>
              <Button asChild size="xl" className="w-full">
                <Link href={`/dashboard/my/bookings/${booking.id}`}>
                  <Ticket /> View my ticket
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/events">Browse more events</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">This booking was cancelled and can no longer be paid.</p>
              <Button asChild size="lg" className="w-full">
                <Link href={`/events/${booking.event.slug}`}>Book again</Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
