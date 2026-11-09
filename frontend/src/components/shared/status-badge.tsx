import { ORDER_LABELS, PAYMENT_LABELS, REQUEST_LABELS } from "@/lib/format";
import type { OrderStatus, PaymentStatus, RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-marigold/20 text-[#8a5a00] dark:text-marigold",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-chart-5/12 text-chart-5",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const paymentTone: Record<PaymentStatus, Tone> = { PENDING: "warning", PAID: "success", FAILED: "danger", CANCELLED: "neutral" };
const orderTone: Record<OrderStatus, Tone> = { PENDING: "warning", PROCESSING: "info", SHIPPED: "info", DELIVERED: "success", CANCELLED: "neutral" };
const requestTone: Record<RequestStatus, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Pill tone={paymentTone[status]}>{PAYMENT_LABELS[status]}</Pill>;
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Pill tone={orderTone[status]}>{ORDER_LABELS[status]}</Pill>;
export const RequestBadge = ({ status }: { status: RequestStatus }) => <Pill tone={requestTone[status]}>{REQUEST_LABELS[status]}</Pill>;
