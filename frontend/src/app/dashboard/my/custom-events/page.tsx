"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, PartyPopper, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/dashboard/page-heading";
import { ListSkeleton } from "@/components/dashboard/user/list-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { RequestBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import { GUEST_LABELS, MEDIA_LABELS, formatDate, formatMoney } from "@/lib/format";
import type { CustomEventRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

const KEY = ["custom-events", "me"] as const;

export default function MyCustomEventsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<{ items: CustomEventRequest[]; unseen: number }>("/custom-events/me"),
  });

  // The ids passed to the mutation stay in its state, so requests that were
  // unseen on arrival remain highlighted after they are marked as seen.
  const markSeen = useMutation<unknown, Error, string[]>({
    mutationFn: () => apiPost("/custom-events/me/mark-seen"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const { mutate: markSeenMutate, isIdle: markSeenIdle, variables: highlighted } = markSeen;
  useEffect(() => {
    if (data && data.unseen > 0 && markSeenIdle) markSeenMutate(data.items.filter((i) => !i.seenByUser).map((i) => i.id));
  }, [data, markSeenIdle, markSeenMutate]);

  async function withdraw(id: string) {
    try {
      await apiDelete(`/custom-events/${id}`);
      toast.success("Request withdrawn");
      await queryClient.invalidateQueries({ queryKey: KEY });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  return (
    <>
      <PageHeading
        title="Custom events"
        description="Requests you've sent to our planners, with their replies."
        actions={
          <Button asChild size="lg">
            <Link href="/plan-your-event">Plan a new event</Link>
          </Button>
        }
      />

      {isLoading ? (
        <ListSkeleton className="h-44" rows={3} />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={PartyPopper}
          title="No requests yet"
          description="Planning a wedding, birthday or corporate event? Get an instant estimate and our planners will take it from there."
          action={
            <Button asChild size="lg">
              <Link href="/plan-your-event">Get an estimate</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.items.map((r) => {
            const isNew = highlighted?.includes(r.id);
            return (
              <li key={r.id} className={cn("flex flex-col rounded-2xl border bg-card p-5", isNew && "border-primary/50 ring-3 ring-primary/10")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{r.eventType}</h2>
                    <p className="text-xs text-muted-foreground">Sent {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <RequestBadge status={r.status} />
                    {isNew && <span className="text-xs font-medium text-primary">New update</span>}
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-muted-foreground" /> {formatDate(r.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" /> {r.location}
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" /> {r.phone}
                  </li>
                </ul>

                <p className="mt-3 text-sm text-muted-foreground">
                  {GUEST_LABELS[r.guestRange]}, {MEDIA_LABELS[r.mediaPackage].toLowerCase()}, {r.catering ? "with catering" : "no catering"}
                </p>
                {r.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{r.notes}”</p>}

                {r.adminNote && (
                  <div
                    className={cn(
                      "mt-4 rounded-xl p-3 text-sm",
                      r.status === "REJECTED" ? "bg-destructive/8 text-foreground" : "bg-success/10 text-foreground",
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">Reply from our planners</p>
                    <p className="mt-1">{r.adminNote}</p>
                  </div>
                )}

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated cost</p>
                    <p className="font-display text-2xl font-bold">{formatMoney(r.estimatedCostCents)}</p>
                  </div>
                  {r.status === "PENDING" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="lg">
                          Withdraw
                        </Button>
                      }
                      title="Withdraw this request?"
                      description="Our planners will stop working on it. You can send a new request anytime."
                      confirmLabel="Withdraw request"
                      onConfirm={() => withdraw(r.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
