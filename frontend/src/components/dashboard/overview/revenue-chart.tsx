"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatMoney, formatMoneyShort } from "@/lib/format";

export interface RevenuePoint {
  month: string;
  tickets: number;
  shop?: number;
}

const config = {
  tickets: { label: "Ticket sales", color: "var(--chart-1)" },
  shop: { label: "Shop sales", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Monthly revenue (values in cents) as a stacked bar chart. */
export function RevenueChart({ data, showShop = true }: { data: RevenuePoint[]; showShop?: boolean }) {
  const rows = data.map((d) => ({ month: d.month, tickets: d.tickets / 100, shop: (d.shop ?? 0) / 100 }));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatMoneyShort(v * 100)} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value, name) => (
            <div className="flex w-full justify-between gap-4">
              <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? name}</span>
              <span className="font-medium tabular-nums">{formatMoney(Number(value) * 100)}</span>
            </div>
          )} />}
        />
        {showShop && <ChartLegend content={<ChartLegendContent />} />}
        <Bar dataKey="tickets" stackId="a" fill="var(--color-tickets)" radius={showShop ? [0, 0, 4, 4] : 4} />
        {showShop && <Bar dataKey="shop" stackId="a" fill="var(--color-shop)" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ChartContainer>
  );
}
