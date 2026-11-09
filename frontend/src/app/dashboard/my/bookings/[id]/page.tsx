"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { DateStub } from "@/components/events/event-card";
import { ErrorState } from "@/components/shared/empty-state";
import { PaymentBadge } from "@/components/shared/status-badge";
import { PrintableTicket } from "@/components/tickets/printable-ticket";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { bookingQuery } from "@/lib/queries";
import { formatDateTime, formatMoney, formatTime, fullName } from "@/lib/format";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery(bookingQuery(id));

  const back = (
    <Button variant="ghost" asChild size="lg" className="mb-6 -ml-2">
      <Link href="/dashboard/my/bookings">
        <ArrowLeft /> All tickets
      </Link>
    </Button>
  );

  if (isLoading)
    return (
      <>
        {back}
        <Skeleton className="mx-auto h-[560px] max-w-md rounded-3xl" />
      </>
    );
  if (isError || !data)
    return (
      <>
        {back}
        <ErrorState message={errorMessage(error, "Couldn't load this ticket.")} onRetry={() => void refetch()} />
      </>
    );

  const b = data;

  if (b.status !== "PAID") {
    return (
      <>
        {back}
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
          <PaymentBadge status={b.status} />
          <h1 className="mt-4 text-xl font-semibold">This ticket isn&apos;t active yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {b.status === "CANCELLED"
              ? "This booking was cancelled, so there's no ticket to show."
              : "Complete the payment to get your QR ticket for entry."}
          </p>
          {(b.status === "PENDING" || b.status === "FAILED") && (
            <Button asChild size="xl" className="mt-5">
              <Link href={`/checkout/booking/${b.id}`}>Pay {formatMoney(b.totalCents)}</Link>
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {back}
      <article
        aria-label={`Ticket for ${b.event.title}`}
        className="ticket mx-auto max-w-md overflow-hidden rounded-3xl bg-card shadow-sm [--notch-y:calc(100%-15.5rem)]"
      >
        <div className="relative aspect-[16/9] bg-muted">
          <Image src={b.event.image} alt="" fill sizes="448px" className="object-cover" preload />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-5 bottom-4 flex items-end gap-3 text-white">
            <DateStub iso={b.event.startsAt} />
            <h1 className="text-xl leading-tight font-semibold">{b.event.title}</h1>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-6 text-sm">
          <div className="col-span-2">
            <dt className="text-muted-foreground">Venue</dt>
            <dd className="mt-0.5 flex items-start gap-1.5 font-medium">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {b.event.venue}, {b.event.city}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Starts</dt>
            <dd className="mt-0.5 font-medium">{formatTime(b.event.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ticket</dt>
            <dd className="mt-0.5 font-medium">
              {b.tier === "VIP" ? "VIP" : "Standard"} × {b.quantity}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Guest</dt>
            <dd className="mt-0.5 truncate font-medium">{b.user ? fullName(b.user) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="mt-0.5 font-medium">{formatMoney(b.totalCents)}</dd>
          </div>
        </dl>

        <div className="perforation mx-5" aria-hidden />

        <div className="flex h-[15.5rem] flex-col items-center justify-center gap-3 p-6">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={b.code} size={148} level="M" marginSize={0} title={`Ticket code ${b.code}`} />
          </div>
          <p className="font-mono text-sm font-semibold tracking-widest">{b.code}</p>
          <p className="text-xs text-muted-foreground">Paid {b.paidAt ? formatDateTime(b.paidAt) : ""}</p>
        </div>
      </article>

      <div className="mx-auto mt-6 flex max-w-md justify-center gap-2">
        <Button size="xl" onClick={() => window.print()}>
          <Printer /> Print ticket
        </Button>
        <Button size="xl" variant="outline" asChild>
          <Link href={`/events/${b.event.slug}`}>Event details</Link>
        </Button>
      </div>

      <PrintableTicket booking={b} />
    </>
  );
}
