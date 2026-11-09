import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="ticket mt-10 w-full max-w-sm rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border [--notch-y:50%]">
        <p className="font-display text-7xl font-bold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold">This page isn&apos;t on the guest list</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be old, or the event may have been removed.</p>
      </div>
      <div className="mt-8 flex gap-2">
        <Button asChild size="lg">
          <Link href="/events">Browse events</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
