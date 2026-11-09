import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Rounded magenta tile with a geometric "D" and a marigold sparkle. */
export function LogoMark({ className }: { className?: string }) {
  const gradient = `dc-logo-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9 shrink-0", className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec2a7c" />
          <stop offset="1" stopColor="#a10d4d" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradient})`} />
      <path fill="#fff" fillRule="evenodd" d="M10.5 10H18a10 10 0 0 1 0 20h-7.5zM15.6 15.1v9.8H18a4.9 4.9 0 0 0 0-9.8z" />
      <path fill="#ffb627" d="M31 5.5c.5 2.4 1.4 3.4 4 4-2.6.6-3.5 1.6-4 4-.5-2.4-1.4-3.4-4-4 2.6-.6 3.5-1.6 4-4z" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Dream Craft Events — home"
      className={cn("flex items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 outline-none", className)}
    >
      <LogoMark />
      <span className="font-display leading-none">
        <span className={cn("block text-[1.2rem] font-extrabold tracking-[-0.02em]", inverted ? "text-white" : "text-foreground")}>
          Dream Craft
        </span>
        <span
          className={cn(
            "mt-[3px] block text-[0.6rem] font-bold tracking-[0.32em] uppercase",
            inverted ? "text-[#ff6fa6]" : "text-primary dark:text-[#ff6fa6]",
          )}
        >
          Events
        </span>
      </span>
    </Link>
  );
}
