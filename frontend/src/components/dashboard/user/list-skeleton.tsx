import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 4, className = "h-24" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`w-full rounded-2xl ${className}`} />
      ))}
    </div>
  );
}
