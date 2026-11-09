"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Declined" },
  { value: "ALL", label: "All" },
];

export function RequestStatusTabs({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatusFilter)} className="mb-5">
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
