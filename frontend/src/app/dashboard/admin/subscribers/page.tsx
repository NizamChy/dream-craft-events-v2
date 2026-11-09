"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Newspaper, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, TableCard } from "@/components/dashboard/page-heading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Paginated, Subscriber } from "@/lib/types";

export default function AdminSubscribersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "subscribers", { page }],
    queryFn: () => apiGet<Paginated<Subscriber>>("/newsletter", { page, limit: 25 }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/newsletter/${id}`),
    onSuccess: () => {
      toast.success("Subscriber removed");
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscribers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  const copyEmails = async () => {
    if (!data?.items.length) return;
    try {
      await navigator.clipboard.writeText(data.items.map((s) => s.email).join(", "));
      toast.success(`Copied ${data.items.length} ${data.items.length === 1 ? "email" : "emails"}`);
    } catch {
      toast.error("Couldn't copy. Your browser blocked clipboard access.");
    }
  };

  return (
    <div>
      <PageHeading
        title="Newsletter subscribers"
        description={data ? `${data.meta.total} ${data.meta.total === 1 ? "person gets" : "people get"} event news by email.` : "People who signed up for event news."}
        actions={
          data?.items.length ? (
            <Button variant="outline" size="lg" onClick={copyEmails}>
              <Copy /> Copy emails on this page
            </Button>
          ) : null
        }
      />

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load subscribers.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState icon={Newspaper} title="No subscribers yet" description="People who sign up in the site footer will appear here." />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <a href={`mailto:${s.email}`} className="hover:text-primary">
                        {s.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={remove.isPending && remove.variables === s.id}
                            aria-label={`Remove ${s.email}`}
                          >
                            <Trash2 />
                          </Button>
                        }
                        title={`Remove ${s.email}?`}
                        description="They'll stop getting the newsletter. They can subscribe again any time."
                        confirmLabel="Remove"
                        onConfirm={() => remove.mutateAsync(s.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="subscribers" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
