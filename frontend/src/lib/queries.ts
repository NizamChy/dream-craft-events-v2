import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Booking, Order } from "@/lib/types";

/*
 * Shared query definitions. Every page that reads a single booking or order
 * must use these, so the cache entry under a given key always has the same
 * shape (the entity itself, not the `{ booking }` response wrapper).
 */
export const bookingQuery = (id: string) =>
  queryOptions({
    queryKey: ["bookings", "detail", id],
    queryFn: () => apiGet<{ booking: Booking }>(`/bookings/${id}`).then((r) => r.booking),
  });

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "detail", id],
    queryFn: () => apiGet<{ order: Order }>(`/orders/${id}`).then((r) => r.order),
  });
