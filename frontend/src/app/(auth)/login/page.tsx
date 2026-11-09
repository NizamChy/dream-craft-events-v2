import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirect } from "@/lib/access";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={safeRedirect(typeof redirect === "string" ? redirect : null)} />;
}
