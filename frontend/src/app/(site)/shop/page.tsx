import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { Paginated, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Party shop",
  description: "Balloons, confetti, lighting, tents and everything else your celebration needs, delivered across Bangladesh.",
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
];

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const sp = await searchParams;
  const sort = typeof sp.sort === "string" && SORTS.some((s) => s.value === sp.sort) ? sp.sort : "newest";
  const data = await serverGet<Paginated<Product>>("/products", { sort, limit: 48 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Party shop</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">Everything your celebration needs, from balloons to stage lighting. Delivered in 2–4 days.</p>
        </div>
        <nav aria-label="Sort products" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={s.value === "newest" ? "/shop" : `/shop?sort=${s.value}`}
              aria-current={sort === s.value ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary",
                sort === s.value ? "border-primary bg-accent font-medium text-accent-foreground" : "bg-card",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {!data ? (
        <EmptyState icon={PackageOpen} title="Couldn't load the shop" description="The shop service didn't respond. Refresh the page to try again." />
      ) : data.items.length === 0 ? (
        <EmptyState icon={PackageOpen} title="The shop is restocking" description="New party supplies are on their way. Check back soon." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((p, i) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="relative aspect-square bg-muted">
                <Image src={p.image} alt={p.name} fill sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw" className="object-cover" preload={i < 4} />
                {p.stock === 0 ? (
                  <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">Out of stock</span>
                ) : p.stock <= 10 ? (
                  <span className="absolute top-3 left-3 rounded-full bg-marigold px-2.5 py-1 text-xs font-semibold text-marigold-foreground">
                    Only {p.stock} left
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="leading-snug font-semibold">{p.name}</h2>
                  <p className="font-display text-lg font-bold">{formatMoney(p.priceCents)}</p>
                </div>
                <p className="mt-1.5 mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                <AddToCartButton product={p} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
