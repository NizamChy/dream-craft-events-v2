"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { apiGet, errorMessage } from "@/lib/api";
import type { Role } from "@/lib/types";

const ROLE_INFO: Record<Role, { label: string; description: string; icon: typeof UserRound }> = {
  ADMIN: { label: "Admin", description: "Users, shop, orders and approvals", icon: ShieldCheck },
  ORGANIZER: { label: "Organizer", description: "Create events and track sales", icon: Ticket },
  USER: { label: "Attendee", description: "Book tickets and shop", icon: UserRound },
};

type DemoAccounts = { enabled: boolean; accounts: { role: Role; email: string; password: string }[] };

export function DemoLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const { demoLogin } = useAuth();
  const [pending, setPending] = useState<Role | null>(null);
  const { data } = useQuery({ queryKey: ["auth", "demo-accounts"], queryFn: () => apiGet<DemoAccounts>("/auth/demo-accounts"), staleTime: Infinity });

  if (!data?.enabled) return null;

  return (
    <section aria-labelledby="demo-heading" className="mt-8 rounded-2xl border border-dashed p-4">
      <h2 id="demo-heading" className="text-sm font-semibold">
        Try a demo account
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">One click signs you in with sample data. Password for all: {data.accounts[0]?.password}</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {data.accounts.map((a) => {
          const info = ROLE_INFO[a.role];
          const Icon = info.icon;
          return (
            <button
              key={a.role}
              type="button"
              disabled={pending !== null}
              onClick={async () => {
                setPending(a.role);
                try {
                  const user = await demoLogin(a.role);
                  toast.success(`Signed in as ${user.firstName} (${info.label})`);
                  onSignedIn();
                } catch (err) {
                  toast.error(errorMessage(err));
                  setPending(null);
                }
              }}
              className="flex w-full min-w-0 items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                {pending === a.role ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">Continue as {info.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.email}, {info.description.toLowerCase()}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
