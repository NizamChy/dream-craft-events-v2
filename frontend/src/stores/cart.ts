"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  stock: number;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const MAX_PER_LINE = 50;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product, quantity = 1) =>
        set((state) => {
          const limit = Math.min(product.stock, MAX_PER_LINE);
          const existing = state.lines.find((l) => l.productId === product.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === product.id ? { ...l, stock: product.stock, priceCents: product.priceCents, quantity: Math.min(l.quantity + quantity, limit) } : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: product.image,
                priceCents: product.priceCents,
                stock: product.stock,
                quantity: Math.min(quantity, limit),
              },
            ],
          };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(0, Math.min(quantity, l.stock, MAX_PER_LINE)) } : l))
            .filter((l) => l.quantity > 0),
        })),
      remove: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: "dce-cart", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
