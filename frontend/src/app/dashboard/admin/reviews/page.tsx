"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareQuote, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading } from "@/components/dashboard/page-heading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Pill } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiGet, apiPatch, errorMessage } from "@/lib/api";
import { formatDate, fullName } from "@/lib/format";
import type { Paginated, Review } from "@/lib/types";
import { cn } from "@/lib/utils";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-4", i < rating ? "fill-marigold text-marigold" : "text-muted-foreground/40")} />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "reviews", { page }],
    queryFn: () => apiGet<Paginated<Review>>("/reviews/manage/list", { page, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) => apiPatch<{ review: Review }>(`/reviews/${id}`, { isApproved }),
    onSuccess: (res) => {
      toast.success(res.review.isApproved ? "Review is visible on the site" : "Review hidden from the site");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/reviews/${id}`),
    onSuccess: () => {
      toast.success("Review deleted");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  return (
    <div>
      <PageHeading title="Reviews" description="What members say about Dream Craft. Hide anything that shouldn't appear on the home page." />

      {query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load reviews.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState icon={MessageSquareQuote} title="No reviews yet" description="Reviews members write will appear here." />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((r) => {
              const busy = (toggle.isPending && toggle.variables?.id === r.id) || (remove.isPending && remove.variables === r.id);
              const name = fullName(r.user) || "Deleted user";
              return (
                <li key={r.id} className={cn("flex flex-col rounded-2xl border bg-card p-5", !r.isApproved && "border-dashed")}>
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={r.rating} />
                    {!r.isApproved && <Pill>Hidden</Pill>}
                  </div>
                  <blockquote className={cn("mt-3 flex-1 text-sm leading-relaxed whitespace-pre-line", !r.isApproved && "text-muted-foreground")}>
                    {r.comment}
                  </blockquote>
                  <div className="mt-4 flex items-center gap-3">
                    {r.user && <UserAvatar user={r.user} className="size-8" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.user?.email ? `${r.user.email}, ` : ""}
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={r.isApproved}
                        disabled={busy}
                        onCheckedChange={(checked) => toggle.mutate({ id: r.id, isApproved: checked })}
                      />
                      Show on site
                    </label>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Delete review by ${name}`}>
                          <Trash2 />
                        </Button>
                      }
                      title="Delete this review?"
                      description={`${name} can write a new one afterwards. To keep it but stop showing it, hide it instead.`}
                      confirmLabel="Delete review"
                      onConfirm={() => remove.mutateAsync(r.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="reviews" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
