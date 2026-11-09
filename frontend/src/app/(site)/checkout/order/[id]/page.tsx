"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { DemoPayment } from "@/components/checkout/demo-payment";
import { ErrorState } from "@/components/shared/empty-state";
import { OrderBadge, PaymentBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiPost, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { orderQuery } from "@/lib/queries";
import type { Order } from "@/lib/types";

export default function OrderCheckoutPage({ params }: PageProps<"/checkout/order/[id]">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const query = orderQuery(id);

  const { data: order, isLoading, error, refetch } = useQuery(query);

  const pay = useMutation({
    mutationFn: (outcome: "success" | "fail") => apiPost<{ order: Order }>(`/orders/${id}/pay`, { outcome }),
    onSuccess: ({ order }) => {
      queryClient.setQueryData(query.queryKey, order);
      void queryClient.invalidateQueries({ queryKey: ["orders", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment successful. We're preparing your order.");
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      if (err instanceof ApiError && err.status === 402) void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState message={error ? errorMessage(error) : "We couldn't find this order"} onRetry={() => void refetch()} />
      </div>
    );
  }

  const paid = order.paymentStatus === "PAID";
  const payable = order.status !== "CANCELLED" && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {paid ? (
        <div className="mb-8 flex items-start gap-3">
          <CircleCheck className="mt-1 size-8 shrink-0 text-success" />
          <div>
            <h1 className="text-3xl font-bold">Order confirmed</h1>
            <p className="mt-1 text-muted-foreground">We&apos;ll deliver to {order.shippingAddress} within 2–4 days.</p>
          </div>
        </div>
      ) : (
        <h1 className="mb-8 text-3xl font-bold">Pay for your order</h1>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <p className="text-sm text-muted-foreground">Order {order.code}</p>
              <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              <PaymentBadge status={order.paymentStatus} />
              <OrderBadge status={order.status} />
            </div>
          </div>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 p-5">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(item.priceCents)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatMoney(item.priceCents * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Deliver to</dt>
              <dd className="max-w-[60%] text-right">{order.shippingAddress}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{order.phone}</dd>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd className="font-display text-xl tabular-nums">{formatMoney(order.totalCents)}</dd>
            </div>
          </dl>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {payable ? (
            <DemoPayment
              amountCents={order.totalCents}
              failedBefore={order.paymentStatus === "FAILED"}
              pending={pay.isPending ? (pay.variables ?? null) : null}
              onPay={(outcome) => pay.mutate(outcome)}
            />
          ) : (
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                {paid ? `Paid on ${formatDateTime(order.paidAt!)}` : "This order was cancelled and can no longer be paid."}
              </p>
              <Button asChild size="xl" className="w-full">
                <Link href="/dashboard/my/orders">
                  <Package /> Track my orders
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/shop">Keep shopping</Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
