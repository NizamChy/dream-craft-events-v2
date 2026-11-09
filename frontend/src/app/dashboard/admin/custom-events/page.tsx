"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, Check, Mail, Phone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DecisionDialog, ListSkeleton } from "@/components/dashboard/admin/admin-helpers";
import { RequestStatusTabs, type StatusFilter } from "@/components/dashboard/admin/status-tabs";
import { PageHeading } from "@/components/dashboard/page-heading";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RequestBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, errorMessage } from "@/lib/api";
import { GUEST_LABELS, MEDIA_LABELS, formatDate, formatMoney, fullName } from "@/lib/format";
import type { CustomEventRequest, Paginated } from "@/lib/types";

export default function AdminCustomEventsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "custom-events", { status, page }],
    queryFn: () =>
      apiGet<Paginated<CustomEventRequest>>("/custom-events", { status: status === "ALL" ? undefined : status, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: "APPROVED" | "REJECTED"; adminNote: string }) =>
      apiPatch<{ request: CustomEventRequest }>(`/custom-events/${id}`, { status, adminNote: adminNote || undefined }),
    onSuccess: (res) => {
      toast.success(res.request.status === "APPROVED" ? "Request approved. The customer has been notified." : "Request declined. The customer has been notified.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "custom-events"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  return (
    <div>
      <PageHeading
        title="Custom event requests"
        description="Weddings, birthdays and corporate events people asked us to plan. Your decision and note appear in their dashboard."
      />
      <RequestStatusTabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      {query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load requests.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={CalendarHeart}
          title={status === "PENDING" ? "No requests waiting" : "Nothing here yet"}
          description={status === "PENDING" ? "New custom event requests will appear here." : "Try another tab."}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {data.items.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {r.eventType} on {formatDate(r.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {fullName(r.user)}, {r.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RequestBadge status={r.status} />
                    <p className="font-display text-xl font-bold">{formatMoney(r.estimatedCostCents)}</p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Guests</dt>
                    <dd className="font-medium">{GUEST_LABELS[r.guestRange]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Photo and video</dt>
                    <dd className="font-medium">{MEDIA_LABELS[r.mediaPackage]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Catering</dt>
                    <dd className="font-medium">{r.catering ? "Included" : "Not needed"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Requested</dt>
                    <dd className="font-medium">{formatDate(r.createdAt)}</dd>
                  </div>
                  {r.notes && (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <dt className="text-muted-foreground">Notes from the customer</dt>
                      <dd className="whitespace-pre-line">{r.notes}</dd>
                    </div>
                  )}
                  {r.adminNote && (
                    <div className="rounded-lg bg-muted p-3 sm:col-span-2 lg:col-span-4">
                      <dt className="text-xs text-muted-foreground">Your note</dt>
                      <dd>{r.adminNote}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                      <Phone className="size-3.5" /> {r.phone}
                    </a>
                    {r.user?.email && (
                      <a href={`mailto:${r.user.email}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Mail className="size-3.5" /> {r.user.email}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {r.status !== "REJECTED" && (
                      <DecisionDialog
                        decision="REJECTED"
                        title="Decline this request?"
                        description={r.status === "APPROVED" ? "This request was approved. Declining it now notifies the customer of the change." : "The customer is notified in their dashboard."}
                        noteHint="Tell them why, for example the date is fully booked."
                        onSubmit={(adminNote) => decide.mutateAsync({ id: r.id, status: "REJECTED", adminNote })}
                        trigger={
                          <Button size="lg" variant="outline">
                            <X /> Decline
                          </Button>
                        }
                      />
                    )}
                    {r.status !== "APPROVED" && (
                      <DecisionDialog
                        decision="APPROVED"
                        title="Approve this request?"
                        description="The customer is notified in their dashboard. Follow up by phone to finalise details."
                        noteHint="Share next steps, for example when a planner will call."
                        onSubmit={(adminNote) => decide.mutateAsync({ id: r.id, status: "APPROVED", adminNote })}
                        trigger={
                          <Button size="lg">
                            <Check /> Approve
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="requests" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
