"use client";

import { ArrowUpRight, CalendarDays, MapPin, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { Pill } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatContext, ChatEventCard, ChatItem, ChatQuote, ChatReply } from "./chat-types";

type Lang = NonNullable<ChatContext["lang"]>;
const COPY: Record<Lang, { from: string; soldOut: string; total: string }> = {
  en: { from: "from", soldOut: "Sold out", total: "Estimated total" },
  bn: { from: "শুরু", soldOut: "টিকেট শেষ", total: "আনুমানিক মোট" },
  banglish: { from: "shuru", soldOut: "Sold out", total: "Mot estimate" },
};

/** Renders the bot's tiny markdown subset: **bold**, *emphasis* and line breaks. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className={cn("block", /^(•|\d+\.|[০-৯]+\.)\s/.test(line) && "pl-1")}>
          {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <em key={j} className="not-italic font-medium text-primary">
                {part.slice(1, -1)}
              </em>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
          {!line && " "}
        </span>
      ))}
    </>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" });

function EventRow({ event, lang, onNavigate }: { event: ChatEventCard; lang: Lang; onNavigate: () => void }) {
  const soldOut = event.seatsLeft <= 0;
  return (
    <Link
      href={`/events/${event.slug}`}
      onClick={onNavigate}
      className="group flex gap-3 rounded-xl border bg-background p-2 outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={event.image} alt="" fill sizes="64px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-sm font-semibold group-hover:text-primary">{event.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3 shrink-0" />
          {shortDate(event.startsAt)}
          <span aria-hidden>·</span>
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{event.city}</span>
        </p>
        <p className="mt-1 text-xs">
          {soldOut ? (
            <span className="font-medium text-destructive">{COPY[lang].soldOut}</span>
          ) : (
            <>
              <span className="text-muted-foreground">{COPY[lang].from} </span>
              <span className="font-semibold">{formatMoney(event.standardPriceCents)}</span>
            </>
          )}
        </p>
      </div>
      <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
    </Link>
  );
}

function ItemRow({ item, onNavigate }: { item: ChatItem; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group flex items-start justify-between gap-3 rounded-xl border bg-background px-3 py-2.5 outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold group-hover:text-primary">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      <Pill tone={item.tone} className="mt-0.5">
        {item.status}
      </Pill>
    </Link>
  );
}

function QuoteCard({ quote, lang }: { quote: ChatQuote; lang: Lang }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <ul className="divide-y text-sm">
        {quote.lines.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="text-muted-foreground">{l.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{formatMoney(l.amountCents)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 bg-accent/60 px-3 py-2.5">
        <span className="text-sm font-semibold">{COPY[lang].total}</span>
        <span className="font-display text-lg font-bold text-primary tabular-nums">{formatMoney(quote.totalCents)}</span>
      </div>
    </div>
  );
}

export function BotMessage({ reply, onNavigate }: { reply: ChatReply; onNavigate: () => void }) {
  const lang = reply.context?.lang ?? "en";
  const hasExtras = reply.events?.length || reply.items?.length || reply.quote || reply.actions?.length;
  return (
    <div className="flex max-w-[92%] flex-col gap-2">
      <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
        <RichText text={reply.text} />
      </div>
      {hasExtras ? (
        <div className="flex flex-col gap-2">
          {reply.events?.map((e) => <EventRow key={e.slug} event={e} lang={lang} onNavigate={onNavigate} />)}
          {reply.items?.map((it) => <ItemRow key={`${it.title}-${it.subtitle}`} item={it} onNavigate={onNavigate} />)}
          {reply.quote && <QuoteCard quote={reply.quote} lang={lang} />}
          {reply.actions?.length ? (
            <div className="flex flex-wrap gap-2">
              {reply.actions.map((a, i) => (
                <Button key={a.href + a.label} asChild size="sm" variant={i === 0 ? "default" : "outline"}>
                  <Link href={a.href} onClick={onNavigate}>
                    {a.label}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]">
      {text}
    </div>
  );
}

export function ErrorMessage({ text, onRetry, disabled }: { text: string; onRetry: () => void; disabled: boolean }) {
  return (
    <div className="flex max-w-[92%] flex-col items-start gap-2 rounded-2xl rounded-tl-md border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm">
      <span>{text}</span>
      <Button size="xs" variant="outline" onClick={onRetry} disabled={disabled}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-4 py-3" role="status" aria-label="Assistant is typing">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}
