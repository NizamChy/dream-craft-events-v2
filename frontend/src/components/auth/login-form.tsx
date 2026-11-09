"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DemoLogin } from "@/components/auth/demo-login";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const goNext = () => {
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1.5 text-muted-foreground">
        New here?{" "}
        <Link href={`/register${redirectTo !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      <form
        noValidate
        className="mt-8"
        onSubmit={form.handleSubmit(async (v) => {
          setFormError(null);
          try {
            await login(v.email, v.password);
            goNext();
          } catch (err) {
            setFormError(errorMessage(err));
          }
        })}
      >
        <FieldGroup className="gap-4">
          {formError && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <FieldError errors={[errors.password]} />
          </Field>
          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </FieldGroup>
      </form>

      <DemoLogin onSignedIn={goNext} />
    </>
  );
}
