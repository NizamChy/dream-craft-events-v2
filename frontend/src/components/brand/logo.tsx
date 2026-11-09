import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <path
        fill="var(--primary)"
        d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z"
      />
      <path fill="var(--marigold)" d="m16 9 1.9 4.2 4.6.4-3.5 3 1 4.5L16 18.8l-4 2.3 1-4.5-3.5-3 4.6-.4z" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 outline-none", className)}>
      <LogoMark />
      <span className={cn("font-display text-lg leading-none font-bold tracking-tight", inverted ? "text-white" : "text-foreground")}>
        Dream Craft
        <span className={cn("block text-[0.7rem] font-medium tracking-normal", inverted ? "text-white/60" : "text-muted-foreground")}>
          Events
        </span>
      </span>
    </Link>
  );
}
