import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { safeRedirect } from "@/lib/access";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { redirect } = await searchParams;
  return <RegisterForm redirectTo={safeRedirect(typeof redirect === "string" ? redirect : null)} />;
}
