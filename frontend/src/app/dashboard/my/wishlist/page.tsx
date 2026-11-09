"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EventCard } from "@/components/events/event-card";
import { PageHeading } from "@/components/dashboard/page-heading";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, errorMessage } from "@/lib/api";
import type { WishlistItem } from "@/lib/types";

export default function WishlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => apiGet<{ items: WishlistItem[] }>("/wishlist"),
  });

  const remove = useMutation({
    mutationFn: (eventId: string) => apiDelete(`/wishlist/${eventId}`),
    onSuccess: () => {
      toast.success("Removed from your wishlist");
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeading title="Wishlist" description="Events you've saved for later. Book before the seats run out." />

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any event page to save it here."
          action={
            <Button asChild size="lg">
              <Link href="/events">Explore events</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <li key={item.eventId} className="relative">
              <EventCard event={item.event} />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 rounded-full bg-background/90 backdrop-blur hover:bg-background"
                aria-label={`Remove ${item.event.title} from wishlist`}
                disabled={remove.isPending && remove.variables === item.eventId}
                onClick={() => remove.mutate(item.eventId)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
