"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, Ticket } from "lucide-react";
import { useState } from "react";
import { SearchInput, useDebouncedValue } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, StatCard, TableCard } from "@/components/dashboard/page-heading";
import { ListSkeleton } from "@/components/dashboard/user/list-skeleton";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { PaymentBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import type { Booking, Paginated, PaymentStatus } from "@/lib/types";

type Response = Paginated<Booking> & { summary: { revenueCents: number; ticketsSold: number } };

const FILTERS: { value: "ALL" | PaymentStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ManageBookingsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | PaymentStatus>("ALL");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bookings", "manage", q, status, page],
    queryFn: () =>
      apiGet<Response>("/bookings", { search: q || undefined, status: status === "ALL" ? undefined : status, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeading title="Bookings" description="Everyone who has booked tickets for your events." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {data ? (
          <>
            <StatCard label="Revenue" value={formatMoney(data.summary.revenueCents)} hint="From paid bookings matching the filters" icon={Banknote} />
            <StatCard label="Tickets sold" value={data.summary.ticketsSold.toLocaleString()} hint="Paid tickets matching the filters" icon={Ticket} />
          </>
        ) : (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search code, email or event"
        />
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <TabsList className="h-9!">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="px-3">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} className="h-14" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={Ticket}
          title={q || status !== "ALL" ? "No matching bookings" : "No bookings yet"}
          description={q || status !== "ALL" ? "Try a different search or filter." : "Bookings for your events will appear here."}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Booking</TableHead>
                  <TableHead className="hidden md:table-cell">Buyer</TableHead>
                  <TableHead className="hidden lg:table-cell">Event</TableHead>
                  <TableHead className="hidden sm:table-cell">Tickets</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pr-4 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="pl-4">
                      <p className="font-mono text-xs font-semibold">{b.code}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(b.createdAt)}</p>
                      <p className="max-w-[12rem] truncate text-xs text-muted-foreground lg:hidden">{b.event.title}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="font-medium">{fullName(b.user) || "—"}</p>
                      <p className="text-xs text-muted-foreground">{b.user?.email}</p>
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate lg:table-cell">{b.event.title}</TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      {b.tier === "VIP" ? "VIP" : "Standard"} × {b.quantity}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(b.totalCents)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <PaymentBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} label="bookings" />
        </>
      )}
    </>
  );
}
