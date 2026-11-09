"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarPlus, Clock, Loader2, Megaphone, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeading } from "@/components/dashboard/page-heading";
import { handleFormError } from "@/components/dashboard/user/form-utils";
import { useAuth } from "@/components/providers/auth-provider";
import { ErrorState } from "@/components/shared/empty-state";
import { RequestBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OrganizerRequest } from "@/lib/types";

const schema = z.object({
  company: z.string().trim().min(2, "Company / brand name is required").max(120),
  experience: z.string().trim().min(1, "Tell us about your experience").max(120),
  skills: z.string().trim().min(3, "List a few skills").max(300),
  message: z.string().trim().max(1000, "Keep it under 1000 characters"),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["company", "experience", "skills", "message"] as const;
const KEY = ["organizer-requests", "me"] as const;

const PERKS = [
  { icon: CalendarPlus, title: "Publish events", text: "Create events with seat limits, Standard and VIP pricing." },
  { icon: Ticket, title: "Sell tickets", text: "Attendees pay online and get QR tickets automatically." },
  { icon: Megaphone, title: "Reach our audience", text: "Your events appear in search, categories and the homepage." },
];

function RequestForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { company: "", experience: "", skills: "", message: "" },
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: (v: Values) => apiPost<{ request: OrganizerRequest }>("/organizer-requests", { ...v, message: v.message || undefined }),
    onSuccess: ({ request }) => {
      queryClient.setQueryData(KEY, { request });
      toast.success("Application sent. We'll review it shortly.");
      onDone();
    },
    onError: (err) => handleFormError(err, setError, FIELDS),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Apply to become an organizer</h2>
      <p className="mt-1 text-sm text-muted-foreground">Our team usually reviews applications within two working days.</p>
      <FieldGroup className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.company}>
            <FieldLabel htmlFor="company">Company or brand</FieldLabel>
            <Input id="company" autoComplete="organization" aria-invalid={!!errors.company} {...register("company")} />
            <FieldError errors={[errors.company]} />
          </Field>
          <Field data-invalid={!!errors.experience}>
            <FieldLabel htmlFor="experience">Experience</FieldLabel>
            <Input id="experience" placeholder="e.g. 3 years, 20+ events" aria-invalid={!!errors.experience} {...register("experience")} />
            <FieldError errors={[errors.experience]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.skills}>
          <FieldLabel htmlFor="skills">Skills</FieldLabel>
          <Input id="skills" placeholder="Conferences, concerts, logistics, sponsorship…" aria-invalid={!!errors.skills} {...register("skills")} />
          <FieldError errors={[errors.skills]} />
        </Field>
        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="message">Anything else? (optional)</FieldLabel>
          <Textarea id="message" rows={4} placeholder="Tell us about the events you plan to run" aria-invalid={!!errors.message} {...register("message")} />
          <FieldError errors={[errors.message]} />
        </Field>
        <div>
          <Button type="submit" size="xl" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Send application
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export default function BecomeOrganizerPage() {
  const { user, refetch: refetchUser } = useAuth();
  const [reapplying, setReapplying] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<{ request: OrganizerRequest | null }>("/organizer-requests/me"),
  });
  const request = data?.request ?? null;

  // The API reads the role from the database, so refreshing the user is enough
  // to unlock organizer pages once an application is approved.
  const approvedButStale = request?.status === "APPROVED" && user?.role === "USER";
  useEffect(() => {
    if (approvedButStale) refetchUser();
  }, [approvedButStale, refetchUser]);

  const isOrganizer = user?.role === "ORGANIZER" || user?.role === "ADMIN";

  let body: React.ReactNode;
  if (isOrganizer) {
    body = (
      <div className="rounded-2xl border bg-card p-6">
        <BadgeCheck className="size-8 text-success" />
        <h2 className="mt-3 text-lg font-semibold">You&apos;re an organizer</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create your first event or manage the ones you&apos;ve already published.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/dashboard/manage/events/new">Create an event</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard/manage/events">My events</Link>
          </Button>
        </div>
      </div>
    );
  } else if (isLoading) {
    body = <Skeleton className="h-80 rounded-2xl" />;
  } else if (isError) {
    body = <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  } else if (!request || (request.status === "REJECTED" && reapplying)) {
    body = <RequestForm onDone={() => setReapplying(false)} />;
  } else {
    body = (
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your application</h2>
          <RequestBadge status={request.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{request.company}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="font-medium">{formatDate(request.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Experience</dt>
            <dd className="font-medium">{request.experience}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Skills</dt>
            <dd className="font-medium">{request.skills}</dd>
          </div>
        </dl>

        {request.status === "PENDING" && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-muted p-3 text-sm">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            We&apos;re reviewing your application. You&apos;ll see the decision here.
          </p>
        )}
        {request.status === "APPROVED" && (
          <p className="mt-5 rounded-xl bg-success/10 p-3 text-sm">Approved! Your organizer tools are being unlocked…</p>
        )}
        {request.adminNote && (
          <div className="mt-4 rounded-xl border p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Note from our team</p>
            <p className="mt-1">{request.adminNote}</p>
          </div>
        )}
        {request.status === "REJECTED" && (
          <Button size="lg" className="mt-5" onClick={() => setReapplying(true)}>
            Apply again
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeading title="Become an organizer" description="Host your own events on Dream Craft and sell tickets to thousands of attendees." />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>{body}</div>
        <ul className="space-y-4">
          {PERKS.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-2xl border bg-card p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="size-4" />
              </span>
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
