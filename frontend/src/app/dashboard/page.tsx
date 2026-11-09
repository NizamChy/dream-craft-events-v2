"use client";

import { AdminOverview } from "@/components/dashboard/overview/admin-overview";
import { OrganizerOverview } from "@/components/dashboard/overview/organizer-overview";
import { UserOverview } from "@/components/dashboard/overview/user-overview";
import { useAuth } from "@/components/providers/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "ADMIN") return <AdminOverview />;
  if (user.role === "ORGANIZER") return <OrganizerOverview />;
  return <UserOverview />;
}
