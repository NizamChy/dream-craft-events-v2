"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiGet, apiPost, errorMessage } from "@/lib/api";
import { GUEST_LABELS, MEDIA_LABELS, formatMoney } from "@/lib/format";
import type { PlanPrefill } from "@/lib/plan-prefill";
import type { CustomEventRequest, GuestRange, MediaPackage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Pricing = {
  pricing: { guestRange: Record<GuestRange, number>; mediaPackage: Record<MediaPackage, number>; catering: number };
  eventTypes: string[];
};

function minDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const schema = z.object({
  eventType: z.string().min(1, "Select an event type"),
  eventDate: z
    .string()
    .min(1, "Select the event date")
    .refine((v) => v >= minDateString(), "Please choose a date at least 7 days from today"),
  location: z.string().trim().min(3, "Enter the event location").max(200),
  guestRange: z.enum(["UP_TO_250", "UP_TO_500", "UP_TO_1000"]),
  mediaPackage: z.enum(["NONE", "PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_AND_VIDEO"]),
  catering: z.boolean(),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(30)
    .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number"),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
});
type Values = z.infer<typeof schema>;

const GUESTS: GuestRange[] = ["UP_TO_250", "UP_TO_500", "UP_TO_1000"];
const MEDIA: MediaPackage[] = ["NONE", "PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_AND_VIDEO"];

export function PlanEventForm({ initial = {} }: { initial?: PlanPrefill }) {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["custom-events", "pricing"], queryFn: () => apiGet<Pricing>("/custom-events/pricing"), staleTime: Infinity });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: "", eventDate: "", location: "", guestRange: "UP_TO_250", mediaPackage: "NONE", catering: false, phone: "", notes: "", ...initial },
  });
  const { errors } = form.formState;
  const [guestRange, mediaPackage, catering] = useWatch({ control: form.control, name: ["guestRange", "mediaPackage", "catering"] });

  const submit = useMutation({
    mutationFn: (v: Values) =>
      apiPost<{ request: CustomEventRequest }>("/custom-events", {
        ...v,
        eventDate: new Date(`${v.eventDate}T12:00:00`).toISOString(),
        notes: v.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Request sent. We'll get back to you within 2 working days.");
      void queryClient.invalidateQueries({ queryKey: ["custom-events", "me"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in form.getValues()) form.setError(field as keyof Values, { message });
        }
      }
      toast.error(errorMessage(err));
    },
  });

  if (isLoading || !data) return <Skeleton className="h-[640px] rounded-2xl" />;

  const p = data.pricing;
  const total = p.guestRange[guestRange] + p.mediaPackage[mediaPackage] + (catering ? p.catering : 0);

  if (submit.isSuccess) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CircleCheck className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-2xl font-bold">Your request is in</h2>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Our planners will review the details and send you a confirmed quote. You can follow its status from your dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/dashboard/my/custom-events">View my requests</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              form.reset();
              submit.reset();
            }}
          >
            Plan another event
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <FieldGroup className="gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.eventType}>
              <FieldLabel htmlFor="eventType">Type of event</FieldLabel>
              <Controller
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="eventType" className="w-full" aria-invalid={!!errors.eventType}>
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.eventTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.eventType]} />
            </Field>
            <Field data-invalid={!!errors.eventDate}>
              <FieldLabel htmlFor="eventDate">Date</FieldLabel>
              <Input id="eventDate" type="date" min={minDateString()} aria-invalid={!!errors.eventDate} {...form.register("eventDate")} />
              <FieldError errors={[errors.eventDate]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.location}>
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <Input id="location" placeholder="Venue or area, city" aria-invalid={!!errors.location} {...form.register("location")} />
            <FieldError errors={[errors.location]} />
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Guests</FieldLegend>
            <Controller
              control={form.control}
              name="guestRange"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-3">
                  {GUESTS.map((g) => (
                    <OptionCard key={g} id={`guest-${g}`} value={g} selected={field.value === g} label={GUEST_LABELS[g]} price={formatMoney(p.guestRange[g])} />
                  ))}
                </RadioGroup>
              )}
            />
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Photo and video</FieldLegend>
            <Controller
              control={form.control}
              name="mediaPackage"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                  {MEDIA.map((m) => (
                    <OptionCard
                      key={m}
                      id={`media-${m}`}
                      value={m}
                      selected={field.value === m}
                      label={MEDIA_LABELS[m]}
                      price={p.mediaPackage[m] ? `+${formatMoney(p.mediaPackage[m])}` : "Included"}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </FieldSet>

          <Controller
            control={form.control}
            name="catering"
            render={({ field }) => (
              <Field orientation="horizontal" className="rounded-xl border p-3">
                <Checkbox id="catering" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                <FieldLabel htmlFor="catering" className="flex-1 font-normal">
                  Add catering for all guests
                </FieldLabel>
                <span className="text-sm text-muted-foreground">+{formatMoney(p.catering)}</span>
              </Field>
            )}
          />

          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="plan-phone">Phone</FieldLabel>
            <Input id="plan-phone" type="tel" placeholder="+8801…" aria-invalid={!!errors.phone} {...form.register("phone")} />
            <FieldDescription>Our planner will call you to confirm the details.</FieldDescription>
            <FieldError errors={[errors.phone]} />
          </Field>

          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="notes">Anything else we should know? (optional)</FieldLabel>
            <Textarea id="notes" rows={3} placeholder="Theme, colours, timing, special requests" aria-invalid={!!errors.notes} {...form.register("notes")} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FieldGroup>
      </div>

      <aside className="h-fit rounded-2xl bg-ink p-5 text-white lg:sticky lg:top-24">
        <h2 className="font-semibold">Your estimate</h2>
        <dl className="mt-4 space-y-2 text-sm text-white/75">
          <div className="flex justify-between gap-3">
            <dt>{GUEST_LABELS[guestRange]}</dt>
            <dd className="tabular-nums">{formatMoney(p.guestRange[guestRange])}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{MEDIA_LABELS[mediaPackage]}</dt>
            <dd className="tabular-nums">{formatMoney(p.mediaPackage[mediaPackage])}</dd>
          </div>
          {catering && (
            <div className="flex justify-between gap-3">
              <dt>Catering</dt>
              <dd className="tabular-nums">{formatMoney(p.catering)}</dd>
            </div>
          )}
        </dl>
        <div className="perforation my-4 opacity-40" aria-hidden />
        <p className="text-sm text-white/75">Estimated total</p>
        <p className="font-display text-4xl font-bold tabular-nums" aria-live="polite">
          {formatMoney(total)}
        </p>
        <p className="mt-2 text-xs text-white/60">Final price is confirmed by our planner. You don&apos;t pay anything now.</p>

        {authLoading ? null : user ? (
          <Button type="submit" size="xl" className="mt-5 w-full" disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="animate-spin" />}
            Send request
          </Button>
        ) : (
          <Button asChild size="xl" className="mt-5 w-full">
            <Link href="/login?redirect=/plan-your-event">Sign in to send request</Link>
          </Button>
        )}
      </aside>
    </form>
  );
}

function OptionCard({ id, value, selected, label, price }: { id: string; value: string; selected: boolean; label: string; price: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        selected ? "border-primary bg-accent/60" : "hover:border-foreground/30",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{price}</span>
      </span>
    </label>
  );
}
