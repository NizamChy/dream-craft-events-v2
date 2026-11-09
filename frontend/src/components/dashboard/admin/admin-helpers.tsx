"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-9"
      />
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Approve / decline dialog with an optional note that is shown to the
 * requester. Stays open while the request runs and on error.
 */
export function DecisionDialog({
  decision,
  title,
  description,
  noteHint,
  onSubmit,
  trigger,
}: {
  decision: "APPROVED" | "REJECTED";
  title: string;
  description: string;
  noteHint: string;
  onSubmit: (note: string) => Promise<unknown>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const approve = decision === "APPROVED";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) setNote("");
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" variant={approve ? "default" : "outline"}>
            {approve ? <Check /> : <X />}
            {approve ? "Approve" : "Decline"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="decision-note">Note to the requester (optional)</FieldLabel>
          <Textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={4} />
          <FieldDescription>{noteHint}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={approve ? "default" : "destructive"}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onSubmit(note.trim());
                setOpen(false);
                setNote("");
              } catch {
                // caller shows the toast
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {approve ? "Approve request" : "Decline request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
