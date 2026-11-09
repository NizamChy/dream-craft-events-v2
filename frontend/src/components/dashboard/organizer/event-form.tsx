"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { handleFormError, toLocalInput } from "@/components/dashboard/user/form-utils";
import { useAuth } from "@/components/providers/auth-provider";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPatch, apiPost } from "@/lib/api";
import { CATEGORY_LABELS, fromCents, toCents } from "@/lib/format";
import type { EventCategory, EventItem } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as [EventCategory, ...EventCategory[]];

const price = z
  .string()
  .trim()
  .min(1, "Price is required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount in taka, e.g. 500")
  .refine((v) => Number(v) <= 1_000_000, "Price is too high");

const list = z
  .string()
  .refine((v) => splitList(v).length <= 20, "Up to 20 names")
  .refine((v) => splitList(v).every((s) => s.length <= 80), "Each name must be under 80 characters");

const schema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
    summary: z.string().trim().min(10, "Summary must be at least 10 characters").max(200),
    description: z.string().trim().min(30, "Description must be at least 30 characters").max(5000),
    category: z.enum(CATEGORIES, { error: "Choose a category" }),
    venue: z.string().trim().min(2, "Venue is required").max(120),
    city: z.string().trim().min(2, "City is required").max(80),
    startsAt: z.string().min(1, "Start date is required"),
    endsAt: z.string(),
    image: z.string().min(1, "Event image is required"),
    speakers: list,
    sponsors: list,
    totalSeats: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "At least 1 seat")
      .refine((v) => Number(v) <= 100_000, "At most 100,000 seats"),
    standardPrice: price,
    vipPrice: price,
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
  })
  .refine((d) => !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt), { message: "End time must be after start time", path: ["endsAt"] })
  .refine((d) => Number(d.vipPrice) >= Number(d.standardPrice), { message: "VIP price should not be lower than the standard price", path: ["vipPrice"] });

type Values = z.infer<typeof schema>;

function splitList(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Server field names → form field names. */
const SERVER_FIELD: Record<string, keyof Values> = {
  standardPriceCents: "standardPrice",
  vipPriceCents: "vipPrice",
};
const FIELDS = [
  "title",
  "summary",
  "description",
  "category",
  "venue",
  "city",
  "startsAt",
  "endsAt",
  "image",
  "speakers",
  "sponsors",
  "totalSeats",
  "standardPrice",
  "vipPrice",
] as const;

function defaults(e?: EventItem): Values {
  return {
    title: e?.title ?? "",
    summary: e?.summary ?? "",
    description: e?.description ?? "",
    category: e?.category ?? "TECHNOLOGY",
    venue: e?.venue ?? "",
    city: e?.city ?? "",
    startsAt: toLocalInput(e?.startsAt),
    endsAt: toLocalInput(e?.endsAt),
    image: e?.image ?? "",
    speakers: e?.speakers.join(", ") ?? "",
    sponsors: e?.sponsors.join(", ") ?? "",
    totalSeats: e ? String(e.totalSeats) : "100",
    standardPrice: e ? fromCents(e.standardPriceCents) : "",
    vipPrice: e ? fromCents(e.vipPriceCents) : "",
    isPublished: e?.isPublished ?? true,
    isFeatured: e?.isFeatured ?? false,
  };
}

export function EventForm({ event }: { event?: EventItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { register, handleSubmit, control, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(event),
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        title: v.title,
        summary: v.summary,
        description: v.description,
        category: v.category,
        venue: v.venue,
        city: v.city,
        startsAt: new Date(v.startsAt).toISOString(),
        endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
        image: v.image,
        speakers: splitList(v.speakers),
        sponsors: splitList(v.sponsors),
        totalSeats: Number(v.totalSeats),
        standardPriceCents: toCents(v.standardPrice),
        vipPriceCents: toCents(v.vipPrice),
        isPublished: v.isPublished,
        ...(isAdmin ? { isFeatured: v.isFeatured } : {}),
      };
      return event ? apiPatch<{ event: EventItem }>(`/events/${event.id}`, body) : apiPost<{ event: EventItem }>("/events", body);
    },
    onSuccess: async () => {
      toast.success(event ? "Event updated" : "Event created");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      router.push("/dashboard/manage/events");
    },
    onError: (err) => {
      // The API reports prices as …Cents; map those onto the taka inputs.
      const mapped =
        err instanceof ApiError
          ? new ApiError(err.status, err.message, Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [SERVER_FIELD[k] ?? k, m])))
          : err;
      handleFormError(mapped, setError, FIELDS);
    },
  });

  const soldNote = event && event.seatsSold > 0 ? `${event.seatsSold} already sold, so it can't go below that.` : undefined;

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Basics</h2>
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={!!errors.summary}>
              <FieldLabel htmlFor="summary">Summary</FieldLabel>
              <Input id="summary" placeholder="One line that appears on event cards" aria-invalid={!!errors.summary} {...register("summary")} />
              <FieldError errors={[errors.summary]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={7} aria-invalid={!!errors.description} {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            <Field data-invalid={!!errors.category}>
              <FieldLabel htmlFor="category">Category</FieldLabel>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.category]} />
            </Field>
          </FieldGroup>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">When and where</h2>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.startsAt}>
                <FieldLabel htmlFor="startsAt">Starts</FieldLabel>
                <Input id="startsAt" type="datetime-local" aria-invalid={!!errors.startsAt} {...register("startsAt")} />
                <FieldError errors={[errors.startsAt]} />
              </Field>
              <Field data-invalid={!!errors.endsAt}>
                <FieldLabel htmlFor="endsAt">Ends (optional)</FieldLabel>
                <Input id="endsAt" type="datetime-local" aria-invalid={!!errors.endsAt} {...register("endsAt")} />
                <FieldError errors={[errors.endsAt]} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.venue}>
                <FieldLabel htmlFor="venue">Venue</FieldLabel>
                <Input id="venue" aria-invalid={!!errors.venue} {...register("venue")} />
                <FieldError errors={[errors.venue]} />
              </Field>
              <Field data-invalid={!!errors.city}>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
                <FieldError errors={[errors.city]} />
              </Field>
            </div>
          </FieldGroup>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Tickets</h2>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={!!errors.totalSeats}>
                <FieldLabel htmlFor="totalSeats">Total seats</FieldLabel>
                <Input id="totalSeats" inputMode="numeric" aria-invalid={!!errors.totalSeats} {...register("totalSeats")} />
                {soldNote && !errors.totalSeats && <FieldDescription>{soldNote}</FieldDescription>}
                <FieldError errors={[errors.totalSeats]} />
              </Field>
              <Field data-invalid={!!errors.standardPrice}>
                <FieldLabel htmlFor="standardPrice">Standard price (৳)</FieldLabel>
                <Input id="standardPrice" inputMode="decimal" placeholder="0 for free" aria-invalid={!!errors.standardPrice} {...register("standardPrice")} />
                <FieldError errors={[errors.standardPrice]} />
              </Field>
              <Field data-invalid={!!errors.vipPrice}>
                <FieldLabel htmlFor="vipPrice">VIP price (৳)</FieldLabel>
                <Input id="vipPrice" inputMode="decimal" aria-invalid={!!errors.vipPrice} {...register("vipPrice")} />
                <FieldError errors={[errors.vipPrice]} />
              </Field>
            </div>
          </FieldGroup>
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">People</h2>
          <FieldGroup>
            <Field data-invalid={!!errors.speakers}>
              <FieldLabel htmlFor="speakers">Speakers / performers</FieldLabel>
              <Input id="speakers" placeholder="Separate names with commas" aria-invalid={!!errors.speakers} {...register("speakers")} />
              <FieldError errors={[errors.speakers]} />
            </Field>
            <Field data-invalid={!!errors.sponsors}>
              <FieldLabel htmlFor="sponsors">Sponsors</FieldLabel>
              <Input id="sponsors" placeholder="Separate names with commas" aria-invalid={!!errors.sponsors} {...register("sponsors")} />
              <FieldError errors={[errors.sponsors]} />
            </Field>
          </FieldGroup>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-2xl border bg-card p-5">
          <Field data-invalid={!!errors.image}>
            <FieldLabel htmlFor="image">Cover image</FieldLabel>
            <Controller
              control={control}
              name="image"
              render={({ field }) => <ImageUpload id="image" value={field.value} onChange={field.onChange} invalid={!!errors.image} />}
            />
            <FieldError errors={[errors.image]} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="isPublished">Published</FieldLabel>
                  <FieldDescription>Drafts are only visible to you.</FieldDescription>
                </FieldContent>
                <Switch id="isPublished" checked={field.value} onCheckedChange={field.onChange} />
              </Field>
            )}
          />
          {isAdmin && (
            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="isFeatured">Featured</FieldLabel>
                    <FieldDescription>Show on the homepage.</FieldDescription>
                  </FieldContent>
                  <Switch id="isFeatured" checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
          )}
        </section>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {event ? "Save changes" : "Create event"}
          </Button>
          <Button type="button" variant="outline" size="xl" asChild>
            <Link href="/dashboard/manage/events">Cancel</Link>
          </Button>
        </div>
      </aside>
    </form>
  );
}
