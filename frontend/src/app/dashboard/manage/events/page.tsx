"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SearchInput, useDebouncedValue } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, TableCard } from "@/components/dashboard/page-heading";
import { ListSkeleton } from "@/components/dashboard/user/list-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Pill } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { EventItem, Paginated } from "@/lib/types";

export default function ManageEventsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["events", "manage", q, page],
    queryFn: () => apiGet<Paginated<EventItem>>("/events/manage/list", { search: q || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  async function remove(e: EventItem) {
    try {
      await apiDelete(`/events/${e.id}`);
      toast.success(`"${e.title}" deleted`);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  const createButton = (
    <Button asChild size="lg">
      <Link href="/dashboard/manage/events/new">
        <CalendarPlus /> Create event
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeading title="My events" description="Create, edit and track ticket sales for the events you host." actions={createButton} />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by title, venue or city"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} className="h-16" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={CalendarPlus}
          title={q ? "No matching events" : "No events yet"}
          description={q ? "Try a different search." : "Create your first event and start selling tickets."}
          action={q ? undefined : createButton}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Event</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Seats sold</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((e) => {
                  const pct = e.totalSeats ? Math.round((e.seatsSold / e.totalSeats) * 100) : 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <Image src={e.image} alt="" fill sizes="48px" className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[16rem] truncate font-medium">{e.title}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{formatDateTime(e.startsAt)}</p>
                            <p className="hidden text-xs text-muted-foreground md:block">
                              {e.venue}, {e.city}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap md:table-cell">{formatDateTime(e.startsAt)}</TableCell>
                      <TableCell className="hidden min-w-36 sm:table-cell">
                        <p className="text-sm">
                          {e.seatsSold} / {e.totalSeats}
                        </p>
                        <Progress value={pct} className="mt-1.5 h-1.5" aria-label={`${pct}% sold`} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {e.isPublished ? <Pill tone="success">Published</Pill> : <Pill>Draft</Pill>}
                          {e.isFeatured && <Pill tone="warning">Featured</Pill>}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/dashboard/manage/events/${e.id}/edit`} aria-label={`Edit ${e.title}`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/events/${e.slug}`} aria-label={`View ${e.title}`} target="_blank">
                              <ExternalLink />
                            </Link>
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Delete ${e.title}`} className="text-destructive hover:text-destructive">
                                <Trash2 />
                              </Button>
                            }
                            title="Delete this event?"
                            description={`"${e.title}" will be removed permanently. Events with paid bookings can't be deleted.`}
                            confirmLabel="Delete event"
                            onConfirm={() => remove(e)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} label="events" />
        </>
      )}
    </>
  );
}
