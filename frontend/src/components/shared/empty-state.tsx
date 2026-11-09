import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-medium text-destructive">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium text-foreground underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}
