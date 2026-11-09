import type { EventCategory, GuestRange, MediaPackage, OrderStatus, PaymentStatus, RequestStatus, Role } from "./types";

// Money is stored as integer poisha (1 BDT = 100 poisha). Shown in taka with
// South Asian digit grouping: ৳1,50,000.
const taka = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const formatMoney = (poisha: number) => `৳${taka.format(poisha / 100)}`;

/** Compact form for chart axes: ৳850, ৳12k, ৳1.5L (lakh). */
export function formatMoneyShort(poisha: number) {
  const t = poisha / 100;
  if (Math.abs(t) >= 100_000) return `৳${+(t / 100_000).toFixed(1)}L`;
  if (Math.abs(t) >= 1_000) return `৳${+(t / 1_000).toFixed(1)}k`;
  return `৳${Math.round(t)}`;
}

// Every date is shown in Bangladesh time, so server-rendered HTML (UTC on the
// host) and the browser always agree, wherever the visitor is.
export const TIME_ZONE = "Asia/Dhaka";

export const formatDate = (iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: TIME_ZONE, ...opts });

export const formatDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-US", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const formatTime = (iso: string | Date) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

export function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, day: "2-digit" }),
    month: d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, month: "short" }),
    weekday: d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, weekday: "short" }),
    year: Number(d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, year: "numeric" })),
  };
}

export const fullName = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : "");

export const initials = (u?: { firstName: string; lastName: string } | null) =>
  u ? `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() : "?";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  TECHNOLOGY: "Technology",
  BUSINESS: "Business",
  MUSIC: "Music",
  ARTS: "Arts & culture",
  HEALTH: "Health & fitness",
  FOOD: "Food & drink",
  EDUCATION: "Education",
  SPORTS: "Sports",
  ENTERTAINMENT: "Entertainment",
  OTHER: "Other",
};

export const ROLE_LABELS: Record<Role, string> = { USER: "Member", ORGANIZER: "Organizer", ADMIN: "Admin" };

export const GUEST_LABELS: Record<GuestRange, string> = {
  UP_TO_250: "Up to 250 guests",
  UP_TO_500: "Up to 500 guests",
  UP_TO_1000: "Up to 1,000 guests",
};

export const MEDIA_LABELS: Record<MediaPackage, string> = {
  NONE: "No photo or video",
  PHOTOGRAPHY: "Photography",
  VIDEOGRAPHY: "Videography",
  PHOTO_AND_VIDEO: "Photography + videography",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  FAILED: "Payment failed",
  CANCELLED: "Cancelled",
};

export const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const REQUEST_LABELS: Record<RequestStatus, string> = { PENDING: "Under review", APPROVED: "Approved", REJECTED: "Declined" };

/** Converts a taka amount from a form input to integer poisha. */
export const toCents = (value: string | number) => Math.round(Number(value) * 100);
export const fromCents = (cents: number) => (cents / 100).toString();
