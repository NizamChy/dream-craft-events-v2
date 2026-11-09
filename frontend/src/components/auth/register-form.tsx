"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name").max(50),
    lastName: z.string().trim().min(1, "Enter your last name").max(50),
    email: z.string().trim().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use 72 characters or fewer")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-1.5 text-muted-foreground">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>

      <form
        noValidate
        className="mt-8"
        onSubmit={form.handleSubmit(async ({ firstName, lastName, email, password }) => {
          const v = { firstName, lastName, email, password };
          setFormError(null);
          try {
            const user = await signUp(v);
            toast.success(`Welcome, ${user.firstName}! Your account is ready.`);
            router.replace(redirectTo);
            router.refresh();
          } catch (err) {
            if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
              for (const [field, message] of Object.entries(err.fieldErrors)) {
                if (field in v) form.setError(field as keyof Values, { message });
              }
            } else {
              setFormError(errorMessage(err));
            }
          }
        })}
      >
        <FieldGroup className="gap-4">
          {formError && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!errors.firstName}>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} {...form.register("firstName")} />
              <FieldError errors={[errors.firstName]} />
            </Field>
            <Field data-invalid={!!errors.lastName}>
              <FieldLabel htmlFor="lastName">Last name</FieldLabel>
              <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...form.register("lastName")} />
              <FieldError errors={[errors.lastName]} />
            </Field>
          </div>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            {errors.password ? <FieldError errors={[errors.password]} /> : <FieldDescription>At least 8 characters with a letter and a number.</FieldDescription>}
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...form.register("confirmPassword")} />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
