"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPost, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { cartCount, cartTotal, useCart } from "@/stores/cart";

const schema = z.object({
  shippingAddress: z.string().trim().min(5, "Enter your full delivery address"),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
});
type FormValues = z.infer<typeof schema>;

export default function CartPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { lines, setQuantity, remove, clear } = useCart();
  const hydrated = useHydrated();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { shippingAddress: "", phone: "" },
  });

  useEffect(() => {
    if (user) {
      const address = [user.address, user.city].filter(Boolean).join(", ");
      if (address && !form.getValues("shippingAddress")) form.setValue("shippingAddress", address);
      if (user.phone && !form.getValues("phone")) form.setValue("phone", user.phone);
    }
  }, [user, form]);

  const placeOrder = useMutation({
    mutationFn: (values: FormValues) =>
      apiPost<{ order: Order }>("/orders", { ...values, items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) }),
    onSuccess: ({ order }) => {
      clear();
      router.push(`/checkout/order/${order.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field === "shippingAddress" || field === "phone") form.setError(field, { message });
        }
      }
      toast.error(errorMessage(err));
    },
  });

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-bold">Your cart</h1>

      {lines.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Balloons, confetti and lights are a click away."
          action={
            <Button asChild size="lg">
              <Link href="/shop">Visit the party shop</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <ul className="divide-y rounded-2xl border bg-card">
            {lines.map((l) => (
              <li key={l.productId} className="flex gap-4 p-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
                  <Image src={l.image} alt="" fill sizes="96px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{l.name}</p>
                    <p className="font-semibold tabular-nums">{formatMoney(l.priceCents * l.quantity)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatMoney(l.priceCents)} each</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1 rounded-lg border p-0.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => setQuantity(l.productId, l.quantity - 1)} aria-label={`Fewer ${l.name}`}>
                        <Minus />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium tabular-nums">{l.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setQuantity(l.productId, l.quantity + 1)}
                        disabled={l.quantity >= l.stock}
                        aria-label={`More ${l.name}`}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(l.productId)}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items ({cartCount(lines)})</dt>
                <dd className="tabular-nums">{formatMoney(cartTotal(lines))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>Free</dd>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="font-display text-2xl tabular-nums">{formatMoney(cartTotal(lines))}</dd>
              </div>
            </dl>

            {user ? (
              <form onSubmit={form.handleSubmit((v) => placeOrder.mutate(v))} className="mt-6" noValidate>
                <FieldGroup className="gap-4">
                  <Field data-invalid={!!form.formState.errors.shippingAddress}>
                    <FieldLabel htmlFor="shippingAddress">Delivery address</FieldLabel>
                    <Textarea id="shippingAddress" rows={2} aria-invalid={!!form.formState.errors.shippingAddress} {...form.register("shippingAddress")} />
                    <FieldError errors={[form.formState.errors.shippingAddress]} />
                  </Field>
                  <Field data-invalid={!!form.formState.errors.phone}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" type="tel" placeholder="+8801…" aria-invalid={!!form.formState.errors.phone} {...form.register("phone")} />
                    <FieldError errors={[form.formState.errors.phone]} />
                  </Field>
                </FieldGroup>
                <Button type="submit" size="xl" className="mt-5 w-full" disabled={placeOrder.isPending}>
                  {placeOrder.isPending && <Loader2 className="animate-spin" />}
                  Continue to payment
                </Button>
              </form>
            ) : (
              <Button asChild size="xl" className="mt-6 w-full">
                <Link href="/login?redirect=/cart">Sign in to check out</Link>
              </Button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
