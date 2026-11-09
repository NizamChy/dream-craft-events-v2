"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  label = "results",
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1 && total === undefined) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm">
      <p className="text-muted-foreground">
        {total !== undefined ? `${total} ${label}` : null}
        {totalPages > 1 ? `${total !== undefined ? ", " : ""}page ${page} of ${totalPages}` : null}
      </p>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeft /> Previous
          </Button>
          <Button variant="outline" size="lg" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
