"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading } from "@/components/dashboard/page-heading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Pill } from "@/components/shared/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { apiDelete, apiGet, apiPatch, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ContactMessage, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessagesResponse = Paginated<ContactMessage> & { unread: number };

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState("");

  const query = useQuery({
    queryKey: ["admin", "messages", { page }],
    queryFn: () => apiGet<MessagesResponse>("/contact", { page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const markRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) => apiPatch(`/contact/${id}`, { isRead }),
    onSuccess: (_res, vars) => {
      if (!vars.isRead) toast.success("Marked as unread");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/contact/${id}`),
    onSuccess: () => {
      toast.success("Message deleted");
      setOpenId("");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  const handleOpen = (id: string) => {
    setOpenId(id);
    const msg = data?.items.find((m) => m.id === id);
    if (msg && !msg.isRead) markRead.mutate({ id, isRead: true });
  };

  return (
    <div>
      <PageHeading
        title="Messages"
        description={
          data
            ? data.unread
              ? `${data.unread} unread ${data.unread === 1 ? "message" : "messages"} from the contact form.`
              : "You're all caught up."
            : "Messages sent through the contact form."
        }
      />

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load messages.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState icon={Inbox} title="No messages" description="When someone uses the contact form, their message lands here." />
      ) : (
        <>
          <Accordion type="single" collapsible value={openId} onValueChange={handleOpen} className="rounded-2xl border bg-card">
            {data.items.map((m) => (
              <AccordionItem key={m.id} value={m.id} className="px-4 sm:px-5">
                <AccordionTrigger className="items-center gap-3 hover:no-underline">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", m.isRead ? "bg-transparent" : "bg-primary")}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={cn("truncate", !m.isRead && "font-semibold")}>{m.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                      </div>
                      <p className={cn("truncate text-sm", m.isRead ? "text-muted-foreground" : "text-foreground")}>{m.subject}</p>
                    </div>
                    {!m.isRead && (
                      <Pill tone="info" className="hidden sm:inline-flex">
                        New
                      </Pill>
                    )}
                    <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{formatDateTime(m.createdAt)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-1 text-xs text-muted-foreground md:hidden">{formatDateTime(m.createdAt)}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{m.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                        <Reply /> Reply by email
                      </a>
                    </Button>
                    {m.isRead ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markRead.isPending}
                        onClick={() => {
                          setOpenId("");
                          markRead.mutate({ id: m.id, isRead: false });
                        }}
                      >
                        <Mail /> Mark unread
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        <MailOpen /> Marking read…
                      </Button>
                    )}
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 /> Delete
                        </Button>
                      }
                      title="Delete this message?"
                      description={`The message from ${m.name} is removed permanently.`}
                      confirmLabel="Delete message"
                      onConfirm={() => remove.mutateAsync(m.id)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            label="messages"
            onPageChange={(p) => {
              setOpenId("");
              setPage(p);
            }}
          />
        </>
      )}
    </div>
  );
}
