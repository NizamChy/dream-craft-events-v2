"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DecisionDialog, ListSkeleton } from "@/components/dashboard/admin/admin-helpers";
import { RequestStatusTabs, type StatusFilter } from "@/components/dashboard/admin/status-tabs";
import { PageHeading } from "@/components/dashboard/page-heading";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RequestBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiGet, apiPatch, errorMessage } from "@/lib/api";
import { ROLE_LABELS, formatDate, fullName } from "@/lib/format";
import type { OrganizerRequest, Paginated } from "@/lib/types";

export default function OrganizerRequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "organizer-requests", { status, page }],
    queryFn: () =>
      apiGet<Paginated<OrganizerRequest>>("/organizer-requests", { status: status === "ALL" ? undefined : status, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: "APPROVED" | "REJECTED"; adminNote: string }) =>
      apiPatch<{ request: OrganizerRequest }>(`/organizer-requests/${id}`, { status, adminNote: adminNote || undefined }),
    onSuccess: (res) => {
      toast.success(
        res.request.status === "APPROVED" ? `${fullName(res.request.user)} is now an organizer` : "Application declined",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "organizer-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  return (
    <div>
      <PageHeading
        title="Organizer requests"
        description="People who want to publish events. Approving a request upgrades that member to the Organizer role straight away."
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
          icon={UserCog}
          title={status === "PENDING" ? "No applications waiting" : "Nothing here yet"}
          description={status === "PENDING" ? "New organizer applications will appear here." : "Try another tab."}
        />
      ) : (
        <>
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-col rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <UserAvatar user={r.user} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{fullName(r.user)}</p>
                    <p className="truncate text-sm text-muted-foreground">{r.user?.email}</p>
                    {r.user?.role && r.user.role !== "USER" && (
                      <p className="text-xs text-muted-foreground">Current role: {ROLE_LABELS[r.user.role]}</p>
                    )}
                  </div>
                  <RequestBadge status={r.status} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Company or brand</dt>
                    <dd className="font-medium">{r.company}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Experience</dt>
                    <dd className="font-medium">{r.experience}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Skills</dt>
                    <dd>{r.skills}</dd>
                  </div>
                  {r.message && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Message</dt>
                      <dd className="whitespace-pre-line">{r.message}</dd>
                    </div>
                  )}
                  {r.adminNote && (
                    <div className="col-span-2 rounded-lg bg-muted p-3">
                      <dt className="text-xs text-muted-foreground">Your note</dt>
                      <dd>{r.adminNote}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                  <p className="text-xs text-muted-foreground">
                    Applied {formatDate(r.createdAt)}
                    {r.reviewedAt && `, reviewed ${formatDate(r.reviewedAt)}`}
                  </p>
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <DecisionDialog
                        decision="REJECTED"
                        title={`Decline ${r.user?.firstName ?? "this"}'s application?`}
                        description="They stay a member and can apply again later."
                        noteHint="Explain what's missing so they can improve their next application."
                        onSubmit={(adminNote) => decide.mutateAsync({ id: r.id, status: "REJECTED", adminNote })}
                      />
                      <DecisionDialog
                        decision="APPROVED"
                        title={`Approve ${fullName(r.user)} as an organizer?`}
                        description="They'll be able to create events and sell tickets immediately."
                        noteHint="A short welcome message is a nice touch."
                        onSubmit={(adminNote) => decide.mutateAsync({ id: r.id, status: "APPROVED", adminNote })}
                      />
                    </div>
                  )}
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
