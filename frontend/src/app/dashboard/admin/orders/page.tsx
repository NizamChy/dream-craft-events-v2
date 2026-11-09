"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCheck, Loader2, MapPin, Package, Phone, ShoppingBag, Truck } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton, SearchInput, useDebouncedValue } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, TableCard } from "@/components/dashboard/page-heading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { OrderBadge, PaymentBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPatch, errorMessage } from "@/lib/api";
import { ORDER_LABELS, formatDate, formatDateTime, formatMoney, fullName } from "@/lib/format";
import type { Order, OrderStatus, Paginated } from "@/lib/types";

const STATUSES: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

/** Mirrors the backend's allowed fulfilment transitions. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const ACTION: Record<Exclude<OrderStatus, "PENDING">, { label: string; icon: typeof Truck }> = {
  PROCESSING: { label: "Start processing", icon: Package },
  SHIPPED: { label: "Mark as shipped", icon: Truck },
  DELIVERED: { label: "Mark as delivered", icon: CheckCheck },
  CANCELLED: { label: "Cancel order", icon: Ban },
};

function ManageOrder({ order, onUpdate }: { order: Order; onUpdate: (status: OrderStatus) => Promise<unknown> }) {
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const next = NEXT[order.status];
  const forward = next.filter((s) => s !== "CANCELLED") as Exclude<OrderStatus, "PENDING" | "CANCELLED">[];
  const canCancel = next.includes("CANCELLED");
  const unpaid = order.paymentStatus !== "PAID";
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  const run = async (status: OrderStatus) => {
    setPending(status);
    try {
      await onUpdate(status);
    } catch {
      // toast shown by the mutation
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">{order.code}</DialogTitle>
          <DialogDescription>
            Placed {formatDateTime(order.createdAt)} by {fullName(order.user) || "a deleted user"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <PaymentBadge status={order.paymentStatus} />
          <OrderBadge status={order.status} />
        </div>

        <ul className="divide-y rounded-xl border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.image && <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatMoney(item.priceCents)}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">{formatMoney(item.priceCents * item.quantity)}</p>
            </li>
          ))}
          <li className="flex justify-between p-3 text-sm font-semibold">
            <span>
              Total, {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="tabular-nums">{formatMoney(order.totalCents)}</span>
          </li>
        </ul>

        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt>
              <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-label="Delivery address" />
            </dt>
            <dd className="whitespace-pre-line">{order.shippingAddress}</dd>
          </div>
          <div className="flex gap-2">
            <dt>
              <Phone className="mt-0.5 size-4 text-muted-foreground" aria-label="Phone" />
            </dt>
            <dd>
              <a href={`tel:${order.phone}`} className="hover:text-primary">
                {order.phone}
              </a>
            </dd>
          </div>
          {order.transactionId && (
            <p className="text-xs text-muted-foreground">
              Transaction <span className="font-mono">{order.transactionId}</span>
              {order.paidAt && `, paid ${formatDateTime(order.paidAt)}`}
            </p>
          )}
        </dl>

        {next.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            This order is {ORDER_LABELS[order.status].toLowerCase()}. There&apos;s nothing more to do.
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            {unpaid && forward.length > 0 && (
              <p className="text-sm text-muted-foreground">
                This order hasn&apos;t been paid yet, so it can&apos;t be fulfilled. You can still cancel it.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {canCancel && (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={!!pending}>
                      <Ban /> Cancel order
                    </Button>
                  }
                  title={`Cancel order ${order.code}?`}
                  description={
                    order.paymentStatus === "PAID"
                      ? "The items go back into stock. Refund the customer separately."
                      : "The customer won't be able to pay for it any more."
                  }
                  confirmLabel="Cancel order"
                  destructive
                  onConfirm={() => onUpdate("CANCELLED")}
                />
              )}
              {forward.map((s) => {
                const Icon = ACTION[s].icon;
                return (
                  <Button key={s} disabled={!!pending || unpaid} onClick={() => run(s)}>
                    {pending === s ? <Loader2 className="animate-spin" /> : <Icon />}
                    {ACTION[s].label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ["admin", "orders", { search: debounced, status, page }],
    queryFn: () =>
      apiGet<Paginated<Order>>("/orders", { search: debounced, status: status === "ALL" ? undefined : status, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => apiPatch<{ order: Order }>(`/orders/${id}/status`, { status }),
    onSuccess: (res) => {
      toast.success(`Order ${res.order.code} is now ${ORDER_LABELS[res.order.status].toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;
  const filtered = !!debounced || status !== "ALL";

  return (
    <div>
      <PageHeading title="Orders" description="Shop orders from every customer. Move paid orders through fulfilment." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by order code or email"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as OrderStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load orders.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={ShoppingBag}
          title={filtered ? "No orders match" : "No orders yet"}
          description={filtered ? "Try a different code, email or status." : "Orders from the shop will appear here."}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden md:table-cell">Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-medium">{o.code}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="font-medium">{fullName(o.user) || "Deleted user"}</p>
                      <p className="max-w-48 truncate text-xs text-muted-foreground">{o.user?.email}</p>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{o.items.reduce((n, i) => n + i.quantity, 0)}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatMoney(o.totalCents)}</TableCell>
                    <TableCell>
                      <PaymentBadge status={o.paymentStatus} />
                    </TableCell>
                    <TableCell>
                      <OrderBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ManageOrder order={o} onUpdate={(s) => update.mutateAsync({ id: o.id, status: s })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="orders" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
