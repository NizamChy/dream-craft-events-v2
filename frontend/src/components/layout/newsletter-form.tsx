"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, errorMessage } from "@/lib/api";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: () => apiPost<{ message: string }>("/newsletter", { email }),
    onSuccess: (res) => {
      toast.success(res.message);
      setEmail("");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex w-full max-w-md gap-2"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 border-white/15 bg-white/5 text-white placeholder:text-white/40"
      />
      <Button type="submit" size="xl" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="animate-spin" />}
        Subscribe
      </Button>
    </form>
  );
}
