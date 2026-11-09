"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPost, errorMessage } from "@/lib/api";
import { fullName } from "@/lib/format";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  subject: z.string().trim().min(3, "Enter a subject").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(3000),
});
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const { user } = useAuth();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", subject: "", message: "" } });
  const { errors } = form.formState;

  useEffect(() => {
    if (user) {
      if (!form.getValues("name")) form.setValue("name", fullName(user));
      if (!form.getValues("email")) form.setValue("email", user.email);
    }
  }, [user, form]);

  const send = useMutation({
    mutationFn: (v: Values) => apiPost("/contact", v),
    onSuccess: () => toast.success("Message sent"),
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in form.getValues()) form.setError(field as keyof Values, { message });
        }
      }
      toast.error(errorMessage(err));
    },
  });

  if (send.isSuccess) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CircleCheck className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-2xl font-bold">Thanks, we got your message</h2>
        <p className="mt-2 text-muted-foreground">We reply to every message within one working day.</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            form.reset({ name: form.getValues("name"), email: form.getValues("email"), subject: "", message: "" });
            send.reset();
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => send.mutate(v))} className="rounded-2xl border bg-card p-5 sm:p-6">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="c-name">Name</FieldLabel>
            <Input id="c-name" autoComplete="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="c-email">Email</FieldLabel>
            <Input id="c-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.subject}>
          <FieldLabel htmlFor="c-subject">Subject</FieldLabel>
          <Input id="c-subject" aria-invalid={!!errors.subject} {...form.register("subject")} />
          <FieldError errors={[errors.subject]} />
        </Field>
        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="c-message">Message</FieldLabel>
          <Textarea id="c-message" rows={6} aria-invalid={!!errors.message} {...form.register("message")} />
          <FieldError errors={[errors.message]} />
        </Field>
        <Button type="submit" size="xl" className="w-full sm:w-auto sm:justify-self-start" disabled={send.isPending}>
          {send.isPending && <Loader2 className="animate-spin" />}
          Send message
        </Button>
      </FieldGroup>
    </form>
  );
}
