"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/dashboard/page-heading";
import { ListSkeleton } from "@/components/dashboard/user/list-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { OrderBadge, PaymentBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";

export default function MyOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "me", page],
    queryFn: () => apiGet<Paginated<Order>>("/orders/me", { page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  async function cancel(id: string) {
    try {
      await apiPost(`/orders/${id}/cancel`);
      toast.success("Order cancelled");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  return (
    <>
      <PageHeading
        title="Shop orders"
        description="Track party supplies you've ordered from the Dream Craft shop."
        actions={
          <Button asChild size="lg">
            <Link href="/shop">Visit the shop</Link>
          </Button>
        }
      />

      {isLoading ? (
        <ListSkeleton className="h-36" />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Balloons, lights, tents and more. Everything you order shows up here."
          action={
            <Button asChild size="lg">
              <Link href="/shop">Browse the party shop</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((o) => {
              const unpaid = o.paymentStatus !== "PAID" && o.status !== "CANCELLED";
              const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
              return (
                <li key={o.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{o.code}</p>
                      <p className="text-sm text-muted-foreground">
                        Ordered {formatDate(o.createdAt)}, {itemCount} item{itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <OrderBadge status={o.status} />
                      {o.paymentStatus !== "PAID" && <PaymentBadge status={o.paymentStatus} />}
                    </div>
                  </div>

                  <ul className="mt-4 flex flex-wrap gap-3">
                    {o.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2.5 rounded-xl bg-muted/50 py-1.5 pr-3 pl-1.5">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Image src={item.image} alt="" fill sizes="40px" className="object-cover" />
                        </div>
                        <div className="text-sm">
                          <p className="line-clamp-1 font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatMoney(item.priceCents)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Total <span className="font-display text-lg font-bold text-foreground">{formatMoney(o.totalCents)}</span>
                    </p>
                    {unpaid && (
                      <div className="flex gap-2">
                        <Button asChild size="lg">
                          <Link href={`/checkout/order/${o.id}`}>Pay now</Link>
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="lg">
                              Cancel order
                            </Button>
                          }
                          title="Cancel this order?"
                          description="The order will be cancelled. You haven't been charged."
                          confirmLabel="Cancel order"
                          onConfirm={() => cancel(o.id)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} label="orders" />
        </>
      )}
    </>
  );
}
