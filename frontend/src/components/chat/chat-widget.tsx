"use client";

import { MessageCircle, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiPost, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BotMessage, ErrorMessage, RichText, TypingIndicator, UserMessage } from "./chat-message";
import type { ChatContext, ChatMessage, ChatReply } from "./chat-types";

const STORAGE_KEY = "dc-chat-v1";
const MAX_LENGTH = 500;
const MAX_STORED = 60;

const STARTERS = ["Ei mashe ki event ache?", "300 joner biye, koto porbe?", "Amar ticket dekhao", "এই সপ্তাহে কী আছে?", "Refund policy?"];

interface Stored {
  messages: ChatMessage[];
  context: ChatContext;
}

function load(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (Array.isArray(parsed.messages)) return { messages: parsed.messages, context: parsed.context ?? {} };
    }
  } catch {
    /* storage blocked or corrupt — start fresh */
  }
  return { messages: [], context: {} };
}

function save(state: Stored) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-MAX_STORED) }));
  } catch {
    /* ignore */
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isSmallScreen = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Stored>({ messages: [], context: {} });
  const [restored, setRestored] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Restore the conversation after hydration (sessionStorage is client only).
  useEffect(() => {
    setState(load());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) save(state);
  }, [state, restored]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.messages.length, pending, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The panel covers the whole screen on phones; stop the page behind it from scrolling.
  useEffect(() => {
    if (!open || !isSmallScreen()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const send = useCallback(
    async (raw: string, { echo = true }: { echo?: boolean } = {}) => {
      const message = raw.trim().slice(0, MAX_LENGTH);
      if (!message || pending) return;
      setInput("");
      setState((s) => ({
        ...s,
        // A retry replaces the failed bubble instead of repeating the question.
        messages: [...s.messages.filter((m) => m.role !== "error"), ...(echo ? [{ id: uid(), role: "user" as const, text: message }] : [])],
      }));
      setPending(true);
      try {
        const [reply] = await Promise.all([apiPost<ChatReply>("/chat", { message, context: state.context }), wait(450)]);
        setState((s) => ({ messages: [...s.messages, { id: uid(), role: "bot", reply }], context: reply.context ?? {} }));
      } catch (err) {
        setState((s) => ({
          ...s,
          messages: [...s.messages, { id: uid(), role: "error", text: errorMessage(err, "Couldn't reach the assistant. Please try again."), retry: message }],
        }));
      } finally {
        setPending(false);
        if (!isSmallScreen()) inputRef.current?.focus();
      }
    },
    [pending, state.context],
  );

  const reset = () => {
    setState({ messages: [], context: {} });
    setInput("");
    inputRef.current?.focus();
  };

  // On phones the panel is full screen, so get out of the way after following a link.
  const onNavigate = () => {
    if (isSmallScreen()) setOpen(false);
  };

  const last = state.messages.at(-1);
  const suggestions = pending ? [] : !last ? STARTERS : last.role === "bot" ? (last.reply.suggestions ?? []) : [];
  const firstName = user?.firstName;

  return (
    <>
      {/* Launcher */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open chat assistant"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        className={cn(
          "group fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-primary py-3 pr-4 pl-3.5 text-primary-foreground shadow-lg shadow-primary/30 outline-none transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 focus-visible:ring-4 focus-visible:ring-ring/40 sm:right-6 sm:bottom-6 print:hidden",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <span className="relative">
          <MessageCircle className="size-5.5" />
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-primary bg-marigold" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Ask us</span>
      </button>

      {/* Panel */}
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-card text-card-foreground shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-200 sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border print:hidden"
        >
          <header className="flex items-center gap-3 border-b bg-ink px-4 py-3 text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate font-display text-base leading-tight font-semibold">
                Dream Craft Assistant
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-white/65">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                Demo mode · English, বাংলা, Banglish
              </p>
            </div>
            {state.messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon-sm" variant="ghost" onClick={reset} aria-label="Start a new chat" className="text-white/80 hover:bg-white/10 hover:text-white">
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New chat</TooltipContent>
              </Tooltip>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label="Close chat"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X />
            </Button>
          </header>

          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-relevant="additions">
            {/* Welcome (never stored, so it greets the current user by name) */}
            <div className="flex max-w-[92%] flex-col gap-2">
              <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                <RichText
                  text={`${firstName ? `Hi ${firstName}! 👋` : "Hi! 👋"} Ami Dream Craft-er assistant.\nEvent khuja, biye ba party-r khoroch hishab, apnar ticket-er status — jekono proshno korun. English, বাংলা ba Banglish, jekono bhashay likhte paren.`}
                />
              </div>
            </div>

            {state.messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.text} />
              ) : m.role === "bot" ? (
                <BotMessage key={m.id} reply={m.reply} onNavigate={onNavigate} />
              ) : (
                <ErrorMessage key={m.id} text={m.text} disabled={pending} onRetry={() => send(m.retry, { echo: false })} />
              ),
            )}
            {pending && <TypingIndicator />}
          </div>

          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="shrink-0 rounded-full border border-primary/25 bg-accent/50 px-3 py-1.5 text-xs font-medium text-accent-foreground outline-none transition-colors hover:border-primary/50 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-end gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor={`${titleId}-input`} className="sr-only">
              Message
            </label>
            <textarea
              id={`${titleId}-input`}
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={MAX_LENGTH}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Apnar proshno likhun…"
              className="field-sizing-content max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
            />
            <Button type="submit" size="icon-lg" className="size-10 rounded-xl" disabled={!input.trim() || pending} aria-label="Send message">
              <SendHorizontal />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
