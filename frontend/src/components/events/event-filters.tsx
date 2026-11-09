"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS } from "@/lib/format";
import type { EventCategory } from "@/lib/types";

const ALL = "all";

export function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("search") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  // Debounced search.
  useEffect(() => {
    if ((params.get("search") ?? "") === search) return;
    const t = setTimeout(() => update({ search: search.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = params.has("search") || params.has("category") || params.has("sort");

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event, venue or city"
          className="h-10 pl-9"
          aria-label="Search events"
        />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={params.get("category") ?? ALL} onValueChange={(v) => update({ category: v })}>
          <SelectTrigger className="h-10! w-44" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("sort") ?? "date"} onValueChange={(v) => update({ sort: v === "date" ? null : v })}>
          <SelectTrigger className="h-10! w-40" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Soonest first</SelectItem>
            <SelectItem value="newest">Recently added</SelectItem>
            <SelectItem value="price-asc">Price: low to high</SelectItem>
            <SelectItem value="price-desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={params.get("when") === "past" ? "past" : "upcoming"} onValueChange={(v) => update({ when: v === "upcoming" ? null : v })}>
          <TabsList className="h-10">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>

        {hasFilters && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setSearch("");
              update({ search: null, category: null, sort: null });
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
