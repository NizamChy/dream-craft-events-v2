"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { apiDelete, apiGet, apiPut, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function WishlistButton({ eventId, slug }: { eventId: string; slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ["wishlist", "event", eventId];

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => apiGet<{ inWishlist: boolean }>(`/events/${eventId}`),
    enabled: !!user,
    select: (d) => d.inWishlist,
  });

  const toggle = useMutation({
    mutationFn: (add: boolean) => (add ? apiPut(`/wishlist/${eventId}`) : apiDelete(`/wishlist/${eventId}`)),
    onMutate: async (add) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, (old: { inWishlist: boolean } | undefined) => ({ ...(old ?? {}), inWishlist: add }));
    },
    onSuccess: (_d, add) => {
      toast.success(add ? "Saved to your wishlist" : "Removed from your wishlist");
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const saved = !!data;
  return (
    <Button
      variant="outline"
      size="lg"
      aria-pressed={saved}
      onClick={() => {
        if (!user) return router.push(`/login?redirect=${encodeURIComponent(`/events/${slug}`)}`);
        toggle.mutate(!saved);
      }}
    >
      <Heart className={cn(saved && "fill-primary text-primary")} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
