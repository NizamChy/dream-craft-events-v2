"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/dashboard/page-heading";
import { ListSkeleton } from "@/components/dashboard/user/list-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { PaymentBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Booking, Paginated, PaymentStatus } from "@/lib/types";

const FILTERS: { value: "ALL" | PaymentStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Awaiting payment" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function MyBookingsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"ALL" | PaymentStatus>("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bookings", "me", status, page],
    queryFn: () => apiGet<Paginated<Booking>>("/bookings/me", { status: status === "ALL" ? undefined : status, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  async function cancel(id: string) {
    try {
      await apiPost(`/bookings/${id}/cancel`);
      toast.success("Booking cancelled");
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  return (
    <>
      <PageHeading
        title="My tickets"
        description="Every ticket you've booked. Show the QR code from a paid ticket at the venue entrance."
        actions={
          <Button asChild size="lg">
            <Link href="/events">Find events</Link>
          </Button>
        }
      />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as typeof status);
          setPage(1);
        }}
        className="mb-6"
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <TabsList className="h-9!">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="px-3">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={Ticket}
          title={status === "ALL" ? "No tickets yet" : "Nothing here"}
          description={status === "ALL" ? "When you book an event, your tickets will show up here." : "No bookings match this filter."}
          action={
            <Button asChild size="lg">
              <Link href="/events">Browse upcoming events</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((b) => (
              <li key={b.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-20">
                    <Image src={b.event.image} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <Link href={`/events/${b.event.slug}`} className="line-clamp-1 font-semibold hover:text-primary">
                      {b.event.title}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="size-3.5 shrink-0" />
                      {formatDateTime(b.event.startsAt)}
                    </p>
                    <p className="mt-1 text-sm">
                      {b.tier === "VIP" ? "VIP" : "Standard"} × {b.quantity}
                      <span className="text-muted-foreground"> for </span>
                      <span className="font-semibold">{formatMoney(b.totalCents)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <PaymentBadge status={b.status} />
                  <div className="flex gap-2">
                    {b.status === "PAID" && (
                      <Button asChild size="lg">
                        <Link href={`/dashboard/my/bookings/${b.id}`}>View ticket</Link>
                      </Button>
                    )}
                    {(b.status === "PENDING" || b.status === "FAILED") && (
                      <Button asChild size="lg">
                        <Link href={`/checkout/booking/${b.id}`}>Pay now</Link>
                      </Button>
                    )}
                    {(b.status === "PENDING" || b.status === "FAILED") && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="lg">
                            Cancel
                          </Button>
                        }
                        title="Cancel this booking?"
                        description={`Your ${b.quantity} ticket(s) for ${b.event.title} won't be reserved. You haven't been charged.`}
                        confirmLabel="Cancel booking"
                        onConfirm={() => cancel(b.id)}
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} label="bookings" />
        </>
      )}
    </>
  );
}
