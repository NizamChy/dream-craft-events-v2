"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCart } from "@/stores/cart";

export function AddToCartButton({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines.find((l) => l.productId === product.id)?.quantity ?? 0);
  const router = useRouter();
  const hydrated = useHydrated();

  const outOfStock = product.stock <= 0;
  const atLimit = hydrated && inCart >= product.stock;

  return (
    <Button
      className="w-full"
      size="lg"
      variant={hydrated && inCart > 0 ? "secondary" : "default"}
      disabled={outOfStock || atLimit}
      onClick={() => {
        add(product);
        toast.success(`${product.name} added to your cart`, { action: { label: "View cart", onClick: () => router.push("/cart") } });
      }}
    >
      {outOfStock ? (
        "Out of stock"
      ) : atLimit ? (
        "All available stock in cart"
      ) : hydrated && inCart > 0 ? (
        <>
          <Check /> In cart ({inCart}), add another
        </>
      ) : (
        <>
          <ShoppingBag /> Add to cart
        </>
      )}
    </Button>
  );
}
