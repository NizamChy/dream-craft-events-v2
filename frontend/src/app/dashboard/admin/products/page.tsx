"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ListSkeleton, SearchInput, useDebouncedValue } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, TableCard } from "@/components/dashboard/page-heading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { ImageUpload } from "@/components/shared/image-upload";
import { Pagination } from "@/components/shared/pagination";
import { Pill } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import { formatMoney, fromCents, toCents } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Keep the name under 100 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Keep the description under 2000 characters"),
  price: z
    .string()
    .trim()
    .min(1, "Enter a price")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter a price greater than 0, like 24.99")
    .refine((v) => Number(v) <= 1_000_000, "Price can't be more than ৳10,00,000"),
  stock: z
    .string()
    .trim()
    .min(1, "Enter the stock count")
    .refine((v) => /^\d+$/.test(v), "Stock must be a whole number")
    .refine((v) => Number(v) <= 1_000_000, "Stock is too large"),
  image: z.string().min(1, "Upload a product image"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;
type FieldName = keyof FormValues;

const EMPTY: FormValues = { name: "", description: "", price: "", stock: "0", image: "", isActive: true };

function toForm(p: Product): FormValues {
  return {
    name: p.name,
    description: p.description,
    price: fromCents(p.priceCents),
    stock: String(p.stock),
    image: p.image,
    isActive: p.isActive,
  };
}

function ProductDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product ? toForm(product) : EMPTY,
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        name: v.name,
        description: v.description,
        priceCents: toCents(v.price),
        stock: Number(v.stock),
        image: v.image,
        isActive: v.isActive,
      };
      return product
        ? apiPatch<{ product: Product }>(`/products/${product.id}`, body)
        : apiPost<{ product: Product }>("/products", body);
    },
    onSuccess: (res) => {
      toast.success(product ? `Saved ${res.product.name}` : `${res.product.name} added to the shop`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          const name: FieldName | null =
            field === "priceCents" ? "price" : field in EMPTY ? (field as FieldName) : null;
          if (name) form.setError(name, { message });
        }
      }
      toast.error(errorMessage(err, "Couldn't save the product."));
    },
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add a product"}</DialogTitle>
          <DialogDescription>
            {product ? "Changes appear in the shop straight away." : "Hidden products are saved but not shown in the shop."}
          </DialogDescription>
        </DialogHeader>

        <form id="product-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup className="grid gap-5 sm:grid-cols-[200px_1fr]">
            <Field data-invalid={!!errors.image}>
              <FieldLabel htmlFor="product-image">Image</FieldLabel>
              <Controller
                control={form.control}
                name="image"
                render={({ field }) => (
                  <ImageUpload
                    id="product-image"
                    value={field.value}
                    onChange={(url) => field.onChange(url)}
                    invalid={!!errors.image}
                    aspect="aspect-square"
                  />
                )}
              />
              <FieldError errors={[errors.image]} />
            </Field>

            <div className="flex flex-col gap-5">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="product-name">Name</FieldLabel>
                <Input id="product-name" aria-invalid={!!errors.name} {...form.register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!errors.price}>
                  <FieldLabel htmlFor="product-price">Price (৳)</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">৳</span>
                    <Input
                      id="product-price"
                      inputMode="decimal"
                      placeholder="24.99"
                      className="pl-6"
                      aria-invalid={!!errors.price}
                      {...form.register("price")}
                    />
                  </div>
                  <FieldError errors={[errors.price]} />
                </Field>
                <Field data-invalid={!!errors.stock}>
                  <FieldLabel htmlFor="product-stock">In stock</FieldLabel>
                  <Input id="product-stock" inputMode="numeric" aria-invalid={!!errors.stock} {...form.register("stock")} />
                  <FieldError errors={[errors.stock]} />
                </Field>
              </div>
            </div>

            <Field data-invalid={!!errors.description} className="sm:col-span-2">
              <FieldLabel htmlFor="product-description">Description</FieldLabel>
              <Textarea id="product-description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>

            <Field orientation="horizontal" className="sm:col-span-2">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch id="product-active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <div>
                <FieldLabel htmlFor="product-active">Show in the shop</FieldLabel>
                <FieldDescription>Turn off to hide the product without deleting it.</FieldDescription>
              </div>
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {product ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  // Bumped each time the editor opens so the form remounts with fresh values.
  const [editorKey, setEditorKey] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "products", { search: debounced, page }],
    queryFn: () => apiGet<Paginated<Product>>("/products/manage/list", { search: debounced, sort: "newest", page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const toggle = useMutation({
    mutationFn: (p: Product) =>
      apiPatch<{ product: Product }>(`/products/${p.id}`, {
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        image: p.image,
        stock: p.stock,
        isActive: !p.isActive,
      }),
    onSuccess: (res) => {
      toast.success(res.product.isActive ? `${res.product.name} is visible in the shop` : `${res.product.name} is hidden from the shop`);
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openEditor = (p: Product | null) => {
    setEditing(p);
    setEditorKey((k) => k + 1);
    setDialogOpen(true);
  };

  const data = query.data;

  return (
    <div>
      <PageHeading
        title="Products"
        description="Manage what's for sale in the shop."
        actions={
          <Button size="lg" onClick={() => openEditor(null)}>
            <Plus /> Add product
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search products"
        />
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load products.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={Package}
          title={debounced ? "No products match your search" : "No products yet"}
          description={debounced ? "Try a different name." : "Add your first product to open the shop."}
          action={
            !debounced && (
              <Button onClick={() => openEditor(null)}>
                <Plus /> Add product
              </Button>
            )
          }
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>In shop</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => {
                  const busy = (toggle.isPending && toggle.variables?.id === p.id) || (remove.isPending && remove.variables === p.id);
                  return (
                    <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-64 truncate font-medium">{p.name}</p>
                            <p className="max-w-64 truncate text-xs text-muted-foreground">{p.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{formatMoney(p.priceCents)}</TableCell>
                      <TableCell className="tabular-nums">
                        {p.stock === 0 ? <Pill tone="danger">Out of stock</Pill> : p.stock <= 5 ? <Pill tone="warning">{p.stock} left</Pill> : p.stock}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.isActive}
                          disabled={busy}
                          onCheckedChange={() => toggle.mutate(p)}
                          aria-label={p.isActive ? `Hide ${p.name}` : `Show ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditor(p)} aria-label={`Edit ${p.name}`}>
                            <Pencil />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${p.name}`}>
                                <Trash2 />
                              </Button>
                            }
                            title={`Delete ${p.name}?`}
                            description="It's removed from the shop. Past orders keep their copy of the item. To keep it for later, hide it instead."
                            confirmLabel="Delete product"
                            onConfirm={() => remove.mutateAsync(p.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="products" onPageChange={setPage} />
        </>
      )}

      <ProductDialog
        key={editorKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />
    </div>
  );
}
