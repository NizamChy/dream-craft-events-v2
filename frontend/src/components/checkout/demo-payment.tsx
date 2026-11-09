"use client";

import { CreditCard, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

/**
 * Stand-in for a hosted payment page (SSLCommerz, Stripe Checkout, bKash...).
 * Nothing is charged: the backend marks the payment as paid or declined
 * depending on which button is used.
 */
export function DemoPayment({
  amountCents,
  pending,
  failedBefore,
  onPay,
}: {
  amountCents: number;
  pending: "success" | "fail" | null;
  failedBefore?: boolean;
  onPay: (outcome: "success" | "fail") => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Payment</h2>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Demo gateway
        </span>
      </div>

      {failedBefore && (
        <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Your last payment attempt was declined. No money was taken, so you can try again.
        </p>
      )}

      <div className="mt-4 rounded-xl bg-ink p-4 text-white">
        <div className="flex items-center justify-between text-white/70">
          <CreditCard className="size-6" />
          <span className="text-xs">Test card</span>
        </div>
        <p className="mt-5 font-display text-lg tracking-widest tabular-nums">4242 4242 4242 4242</p>
        <div className="mt-3 flex gap-6 text-xs text-white/70">
          <span>Expires 12/30</span>
          <span>CVC 123</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        This is a demo checkout. No real card is charged. Use the second button to see how a declined payment is handled.
      </p>

      <Button size="xl" className="mt-5 w-full" disabled={pending !== null} onClick={() => onPay("success")}>
        {pending === "success" && <Loader2 className="animate-spin" />}
        Pay {formatMoney(amountCents)}
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-muted-foreground" disabled={pending !== null} onClick={() => onPay("fail")}>
        {pending === "fail" && <Loader2 className="animate-spin" />}
        Simulate a declined payment
      </Button>
    </div>
  );
}
