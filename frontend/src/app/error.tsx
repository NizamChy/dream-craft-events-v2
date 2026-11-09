"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold">Something went wrong on this page</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page couldn&apos;t finish loading. Try again, and if it keeps happening, check that the API server is running.
      </p>
      <div className="mt-6 flex gap-2">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
