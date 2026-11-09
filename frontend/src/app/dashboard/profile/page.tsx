"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeading } from "@/components/dashboard/page-heading";
import { handleFormError } from "@/components/dashboard/user/form-utils";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPatch, apiPut, errorMessage } from "@/lib/api";
import type { Review, User } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------- Profile ----------------

const optional = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  phone: optional(30),
  city: optional(80),
  country: optional(80),
  address: optional(200),
  bio: optional(500),
  avatar: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;
const PROFILE_FIELDS = ["firstName", "lastName", "phone", "city", "country", "address", "bio", "avatar"] as const;

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      city: user.city ?? "",
      country: user.country ?? "",
      address: user.address ?? "",
      bio: user.bio ?? "",
      avatar: user.avatar ?? "",
    },
  });
  const { register, handleSubmit, control, setError, formState } = form;
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) => {
      const nullable = (v: string) => (v.trim() ? v.trim() : null);
      return apiPatch<{ user: User }>("/auth/me", {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: nullable(values.phone),
        city: nullable(values.city),
        country: nullable(values.country),
        address: nullable(values.address),
        bio: nullable(values.bio),
        avatar: nullable(values.avatar),
      });
    },
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      form.reset(form.getValues());
      toast.success("Profile saved");
    },
    onError: (err) => handleFormError(err, setError, PROFILE_FIELDS),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-8 lg:grid-cols-[200px_1fr]" noValidate>
      <div>
        <p className="mb-2 text-sm font-medium">Profile photo</p>
        <Controller
          control={control}
          name="avatar"
          render={({ field }) => <ImageUpload value={field.value} onChange={field.onChange} aspect="aspect-square" id="avatar" />}
        />
      </div>

      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.firstName}>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} {...register("firstName")} />
            <FieldError errors={[errors.firstName]} />
          </Field>
          <Field data-invalid={!!errors.lastName}>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...register("lastName")} />
            <FieldError errors={[errors.lastName]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={user.email} disabled readOnly />
          <FieldDescription>Your email is used to sign in and can&apos;t be changed here.</FieldDescription>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input id="phone" type="tel" autoComplete="tel" placeholder="+8801…" aria-invalid={!!errors.phone} {...register("phone")} />
            <FieldError errors={[errors.phone]} />
          </Field>
          <Field data-invalid={!!errors.city}>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <Input id="city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register("city")} />
            <FieldError errors={[errors.city]} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.address}>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Input id="address" autoComplete="street-address" aria-invalid={!!errors.address} {...register("address")} />
            <FieldError errors={[errors.address]} />
          </Field>
          <Field data-invalid={!!errors.country}>
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <Input id="country" autoComplete="country-name" aria-invalid={!!errors.country} {...register("country")} />
            <FieldError errors={[errors.country]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.bio}>
          <FieldLabel htmlFor="bio">Bio</FieldLabel>
          <Textarea id="bio" rows={4} placeholder="A few words about you" aria-invalid={!!errors.bio} {...register("bio")} />
          <FieldError errors={[errors.bio]} />
        </Field>

        <div>
          <Button type="submit" size="xl" disabled={mutation.isPending || !formState.isDirty}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Save profile
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

// ---------------- Password ----------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use at most 72 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordForm() {
  const { setUser } = useAuth();
  const { register, handleSubmit, setError, reset, formState } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: (v: PasswordValues) =>
      apiPatch<{ message: string; user: User }>("/auth/password", { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: (res) => {
      setUser(res.user);
      reset();
      toast.success("Password updated. You've been signed out on other devices.");
    },
    onError: (err) => handleFormError(err, setError, ["currentPassword", "newPassword"] as const),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="max-w-md" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.currentPassword}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input id="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register("currentPassword")} />
          <FieldError errors={[errors.currentPassword]} />
        </Field>
        <Field data-invalid={!!errors.newPassword}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register("newPassword")} />
          <FieldDescription>At least 8 characters with a letter and a number.</FieldDescription>
          <FieldError errors={[errors.newPassword]} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
        <div>
          <Button type="submit" size="xl" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

// ---------------- Review ----------------

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().min(10, "Write at least 10 characters").max(600, "Keep it under 600 characters"),
});
type ReviewValues = z.infer<typeof reviewSchema>;

function StarPicker({ value, onChange, invalid }: { value: number; onChange: (v: number) => void; invalid?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label="Rating" aria-invalid={invalid} className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-md p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Star className={cn("size-7 transition-colors", n <= shown ? "fill-marigold text-marigold" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews", "me"],
    queryFn: () => apiGet<{ review: Review | null }>("/reviews/me"),
  });
  const review = data?.review ?? null;

  const { control, register, handleSubmit, setError, reset, formState } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "" },
  });
  const { errors } = formState;

  useEffect(() => {
    if (review) reset({ rating: review.rating, comment: review.comment });
  }, [review, reset]);

  const save = useMutation({
    mutationFn: (v: ReviewValues) => apiPut<{ review: Review }>("/reviews/me", v),
    onSuccess: () => {
      toast.success(review ? "Review updated" : "Thanks! Your review is published.");
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (err) => handleFormError(err, setError, ["rating", "comment"] as const),
  });

  if (isLoading) return <Skeleton className="h-56 max-w-xl rounded-2xl" />;
  if (isError)
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load your review.{" "}
        <button className="underline" onClick={() => void refetch()}>
          Try again
        </button>
      </p>
    );

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-xl" noValidate>
      <FieldGroup>
        <p className="text-muted-foreground">
          Tell other guests how your experience with Dream Craft went. Approved reviews appear on the home page.
        </p>
        <Field data-invalid={!!errors.rating}>
          <FieldLabel>Your rating</FieldLabel>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => <StarPicker value={field.value} onChange={field.onChange} invalid={!!errors.rating} />}
          />
          <FieldError errors={[errors.rating]} />
        </Field>
        <Field data-invalid={!!errors.comment}>
          <FieldLabel htmlFor="comment">Your review</FieldLabel>
          <Textarea id="comment" rows={5} placeholder="What did you enjoy? What could be better?" aria-invalid={!!errors.comment} {...register("comment")} />
          <FieldError errors={[errors.comment]} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="xl" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {review ? "Update review" : "Publish review"}
          </Button>
          {review && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="outline" size="xl">
                  Delete review
                </Button>
              }
              title="Delete your review?"
              description="Your review will be removed from the site. You can write a new one anytime."
              confirmLabel="Delete review"
              onConfirm={async () => {
                try {
                  await apiDelete("/reviews/me");
                  reset({ rating: 0, comment: "" });
                  toast.success("Review deleted");
                  await queryClient.invalidateQueries({ queryKey: ["reviews"] });
                } catch (err) {
                  toast.error(errorMessage(err));
                  throw err;
                }
              }}
            />
          )}
        </div>
      </FieldGroup>
    </form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <PageHeading title="Profile & settings" description="Manage your personal details, password and review." />
      <Tabs defaultValue="profile" className="gap-6">
        <TabsList className="h-10! w-full sm:w-fit">
          <TabsTrigger value="profile" className="px-4">
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="px-4">
            Password
          </TabsTrigger>
          <TabsTrigger value="review" className="px-4">
            My review
          </TabsTrigger>
        </TabsList>
        <div className="rounded-2xl border bg-card p-5 sm:p-8">
          <TabsContent value="profile">
            <ProfileForm user={user} />
          </TabsContent>
          <TabsContent value="password">
            <PasswordForm />
          </TabsContent>
          <TabsContent value="review">
            <ReviewForm />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
