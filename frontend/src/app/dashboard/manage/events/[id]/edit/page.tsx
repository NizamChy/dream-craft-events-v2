"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeading } from "@/components/dashboard/page-heading";
import { EventForm } from "@/components/dashboard/organizer/event-form";
import { ErrorState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, errorMessage } from "@/lib/api";
import type { EventItem } from "@/lib/types";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["events", "edit", id],
    queryFn: () => apiGet<{ event: EventItem }>(`/events/${id}`),
    // Always start editing from fresh data.
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <>
      <PageHeading title="Edit event" description={data?.event.title ?? "Update the details of your event."} />
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Skeleton className="h-[640px] rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={errorMessage(error, "Couldn't load this event.")} onRetry={() => void refetch()} />
      ) : (
        <EventForm key={data.event.id} event={data.event} />
      )}
    </>
  );
}
