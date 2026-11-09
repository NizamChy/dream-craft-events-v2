import type { EventCategory, GuestRange, MediaPackage } from "@/lib/types";

/** Mirrors backend/src/modules/chat/chat.service.ts. */
export interface ChatContext {
  lang?: "en" | "bn" | "banglish";
  awaiting?: "guests";
  quote?: { eventType: string; guests?: number; media?: MediaPackage; catering?: boolean };
}

export interface ChatEventCard {
  slug: string;
  title: string;
  image: string;
  category: EventCategory;
  venue: string;
  city: string;
  startsAt: string;
  standardPriceCents: number;
  vipPriceCents: number;
  seatsLeft: number;
}

export interface ChatItem {
  title: string;
  subtitle: string;
  status: string;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  href: string;
}

export interface ChatQuote {
  eventType: string;
  guestRange: GuestRange;
  lines: { label: string; amountCents: number }[];
  totalCents: number;
  href: string;
}

export interface ChatReply {
  text: string;
  events?: ChatEventCard[];
  items?: ChatItem[];
  quote?: ChatQuote;
  actions?: { label: string; href: string }[];
  suggestions?: string[];
  context: ChatContext;
}

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bot"; reply: ChatReply }
  | { id: string; role: "error"; text: string; retry: string };
